import {
  PaymentStatus,
  PaymentType,
  type Milestone,
  type Payment,
  type Project,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { getPaymentProvider } from "./payments/index.js";
import type {
  PaymentIntentStatus,
  TransferStatus,
} from "./payments/types.js";

export class EscrowError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "EscrowError";
  }
}

type ProjectWithMilestones = Project & { milestones: Milestone[] };

export interface FundEscrowResult {
  payment: Payment;
  project: ProjectWithMilestones;
  clientSecret: string | null;
  alreadyFunded: boolean;
}

export interface ReleaseMilestoneResult {
  payment: Payment | null;
  milestone: Milestone;
  project: ProjectWithMilestones;
  alreadyReleased: boolean;
}

function toPaymentStatus(
  status: PaymentIntentStatus | TransferStatus,
): PaymentStatus {
  switch (status) {
    case "succeeded":
    case "paid":
      return PaymentStatus.SUCCEEDED;
    case "processing":
    case "pending":
      return PaymentStatus.PROCESSING;
    case "requires_payment_method":
    case "requires_confirmation":
      return PaymentStatus.REQUIRES_PAYMENT_METHOD;
    case "canceled":
      return PaymentStatus.CANCELED;
    default:
      return PaymentStatus.FAILED;
  }
}

function resolveEscrowAmount(
  project: ProjectWithMilestones,
  amountCents?: number,
): number {
  if (amountCents !== undefined) return amountCents;
  if (project.totalEscrow > 0) return project.totalEscrow;
  return project.milestones.reduce(
    (total, milestone) => total + milestone.amount,
    0,
  );
}

async function getProjectWithMilestones(
  projectId: string,
): Promise<ProjectWithMilestones> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { milestones: true },
  });
  if (!project) {
    throw new EscrowError("Project not found", 404);
  }
  return project;
}

/**
 * Simulates the client funding escrow (Stripe PaymentIntent). On success the
 * project moves to ACTIVE and the funded amount is stored on the project.
 * Safe to call twice: a succeeded escrow payment is returned unchanged.
 */
export async function fundEscrow(
  projectId: string,
  amountCents?: number,
): Promise<FundEscrowResult> {
  const project = await getProjectWithMilestones(projectId);

  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    throw new EscrowError(
      `Cannot fund a ${project.status.toLowerCase()} project`,
      409,
    );
  }

  const existing = await prisma.payment.findFirst({
    where: {
      projectId,
      type: PaymentType.ESCROW_FUNDING,
      status: {
        in: [
          PaymentStatus.SUCCEEDED,
          PaymentStatus.PROCESSING,
          PaymentStatus.REQUIRES_PAYMENT_METHOD,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      payment: existing,
      project,
      clientSecret: existing.clientSecret,
      alreadyFunded: existing.status === PaymentStatus.SUCCEEDED,
    };
  }

  const amount = resolveEscrowAmount(project, amountCents);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new EscrowError(
      "Escrow amount must be a positive integer number of cents",
      400,
    );
  }

  const intent = await getPaymentProvider().createEscrowPaymentIntent({
    projectId,
    amountCents: amount,
    currency: process.env.STRIPE_CURRENCY ?? "usd",
  });

  const payment = await prisma.payment.create({
    data: {
      projectId,
      provider: intent.provider,
      type: PaymentType.ESCROW_FUNDING,
      status: toPaymentStatus(intent.status),
      providerRef: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      clientSecret: intent.clientSecret,
      metadata: intent.metadata,
    },
  });

  if (intent.status !== "succeeded") {
    // Real Stripe: the client must confirm the PaymentIntent with Stripe.js
    // before escrow can be considered funded.
    return {
      payment,
      project,
      clientSecret: intent.clientSecret,
      alreadyFunded: false,
    };
  }

  const fundedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      totalEscrow: amount,
      status: "ACTIVE",
    },
    include: { milestones: true },
  });

  return {
    payment,
    project: fundedProject,
    clientSecret: intent.clientSecret,
    alreadyFunded: false,
  };
}

/**
 * Simulates releasing one milestone from escrow to the builder (Stripe
 * transfer). The milestone only becomes RELEASED after the transfer succeeds,
 * and the project completes when every milestone has been released.
 */
export async function releaseMilestone(
  milestoneId: string,
): Promise<ReleaseMilestoneResult> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: true },
  });
  if (!milestone) {
    throw new EscrowError("Milestone not found", 404);
  }

  const project = await getProjectWithMilestones(milestone.projectId);

  if (
    milestone.status === "RELEASED" ||
    milestone.status === "COMPLETED"
  ) {
    const existing = await prisma.payment.findFirst({
      where: {
        milestoneId,
        type: PaymentType.MILESTONE_TRANSFER,
        status: PaymentStatus.SUCCEEDED,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      payment: existing,
      milestone,
      project,
      alreadyReleased: true,
    };
  }

  if (project.status !== "ACTIVE") {
    throw new EscrowError(
      "Project escrow must be funded (status ACTIVE) before releasing a milestone",
      409,
    );
  }

  if (!Number.isInteger(milestone.amount) || milestone.amount <= 0) {
    throw new EscrowError("Milestone amount must be a positive integer", 400);
  }

  const transfer = await getPaymentProvider().createMilestoneTransfer({
    projectId: milestone.projectId,
    milestoneId: milestone.id,
    amountCents: milestone.amount,
    currency: process.env.STRIPE_CURRENCY ?? "usd",
  });

  const payment = await prisma.payment.create({
    data: {
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      provider: transfer.provider,
      type: PaymentType.MILESTONE_TRANSFER,
      status: toPaymentStatus(transfer.status),
      providerRef: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      metadata: transfer.metadata,
    },
  });

  if (transfer.status !== "paid") {
    return {
      payment,
      milestone,
      project,
      alreadyReleased: false,
    };
  }

  const releasedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  const allMilestones = await prisma.milestone.findMany({
    where: { projectId: milestone.projectId },
  });
  const allReleased = allMilestones.every(
    (item) => item.status === "RELEASED" || item.status === "COMPLETED",
  );

  if (allReleased) {
    await prisma.project.update({
      where: { id: milestone.projectId },
      data: { status: "COMPLETED" },
    });
  }

  const updatedProject = await getProjectWithMilestones(milestone.projectId);

  return {
    payment,
    milestone: releasedMilestone,
    project: updatedProject,
    alreadyReleased: false,
  };
}
