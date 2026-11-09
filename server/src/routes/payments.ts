import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import {
  EscrowError,
  fundEscrow,
  releaseMilestone,
} from "../services/escrow.js";
import { getPaymentProviderInfo } from "../services/payments/index.js";

export const paymentsRouter = Router();

function sendError(res: import("express").Response, error: unknown): void {
  if (error instanceof EscrowError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error("[payments]", error);
  res.status(500).json({ error: (error as Error).message });
}

/** Current provider mode, useful for a dev/test toggle in the UI. */
paymentsRouter.get("/config", (_req, res) => {
  res.json(getPaymentProviderInfo());
});

/** Payment audit trail, newest first. Optional ?projectId= filter. */
paymentsRouter.get("/", async (req, res) => {
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  const payments = await prisma.payment.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ payments });
});

/**
 * POST /api/payments/escrow/fund
 * Body: { projectId: string, amountCents?: number }
 * Creates a mock PaymentIntent (or Stripe intent) and activates the project.
 */
paymentsRouter.post("/escrow/fund", async (req, res) => {
  try {
    const { projectId, amountCents } = (req.body ?? {}) as {
      projectId?: string;
      amountCents?: number;
    };

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const result = await fundEscrow(projectId, amountCents);
    res.status(result.alreadyFunded ? 200 : 201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * POST /api/payments/milestones/release
 * Body: { milestoneId: string }
 * Creates a mock transfer (or Stripe transfer) and releases the milestone.
 */
paymentsRouter.post("/milestones/release", async (req, res) => {
  try {
    const { milestoneId } = (req.body ?? {}) as { milestoneId?: string };

    if (!milestoneId) {
      res.status(400).json({ error: "milestoneId is required" });
      return;
    }

    const result = await releaseMilestone(milestoneId);
    res.status(result.alreadyReleased ? 200 : 201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});
