import type { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";

import { prisma } from "./lib/prisma.js";
import { buildMilestones, resolveProjectTotal } from "./lib/milestones.js";
import {
  buildMilestonesSnapshot,
  isTerminalOfferStatus,
  normalizeOfferTerms,
  parseLongTermAmountCents,
  parseLongTermCadence,
  parseLongTermNotes,
  parseMilestoneDueDates,
  parseTotalCents,
  snapshotDeliverables,
  snapshotDueDates,
} from "./lib/offers.js";
import {
  defaultDeliverableSpec,
  inferDeliverableKindFromAppKinds,
  parseDeliverableSpec,
  validateDeliverableSubmission,
} from "./lib/deliverables.js";
import { fundEscrow, releaseMilestone } from "./services/escrow.js";
import { synthesizeScope } from "./services/synthesis.js";

type JsonRecord = Record<string, unknown>;

const BUILDER_PROJECT_LIMIT = 3;
const CLIENT_OPEN_BIDS_LIMIT = 3;
const PROBATIONARY_CAP_CENTS = 150000;

async function countBuilderAcceptedActiveProjects(builderId: string) {
  return prisma.project.count({
    where: { builderId, status: "ACTIVE" as any },
  });
}

async function assertBuilderCanTakeNewProjects(builderId: string) {
  const activeAccepted = await countBuilderAcceptedActiveProjects(builderId);
  if (activeAccepted >= BUILDER_PROJECT_LIMIT) {
    throw new Error(
      `You have ${BUILDER_PROJECT_LIMIT} accepted active projects and cannot take on new project plans right now.`,
    );
  }
}

const offerInclude = {
  builder: { select: { id: true, name: true, email: true } },
} as const;

const projectInclude = {
  milestones: { orderBy: { stageNumber: "asc" as const } },
  client: { select: { id: true, name: true, email: true } },
  builder: { select: { id: true, name: true, email: true } },
  offers: { orderBy: { submittedAt: "desc" as const }, include: offerInclude },
} as const;

function filterOffersForViewer(project: any, viewerUserId?: string | null) {
  const offers = project?.offers ?? [];
  if (!viewerUserId) return [];
  if (project.clientId === viewerUserId) return offers;
  // Builder sees only their own offer (per decision); others see none.
  return offers.filter((o: any) => o.builderId === viewerUserId);
}

function projectForViewer(project: any, viewerUserId?: string | null) {
  if (!project) return project;
  return { ...project, offers: filterOffersForViewer(project, viewerUserId) };
}

async function getProject(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId }, include: projectInclude });
}

async function emitProjectState(io: Server, projectId: string) {
  const project = await getProject(projectId);
  if (!project) return null;
  const sockets = await io.in(projectId).fetchSockets();
  for (const s of sockets) {
    const uid = (s.data.userId as string | undefined) ?? null;
    s.emit("project_updated", { project: projectForViewer(project, uid) });
    s.emit("offers_updated", {
      projectId,
      offers: filterOffersForViewer(project, uid),
      selectedOfferId: project.selectedOfferId ?? null,
    });
  }
  return project;
}

async function syncProjectMilestones(projectId: string, totalCents: number) {
  const milestones = buildMilestones(totalCents);
  await prisma.$transaction(async (tx) => {
    await tx.milestone.deleteMany({ where: { projectId } });
    await tx.milestone.createMany({
      data: milestones.map((milestone) => ({
        id: `${projectId}-stage-${milestone.stageNumber}`,
        projectId,
        stageNumber: milestone.stageNumber,
        title: milestone.title,
        amount: milestone.amount,
        releasePercent: milestone.releasePercent,
      })),
    });
  });
  return prisma.milestone.findMany({
    where: { projectId },
    orderBy: { stageNumber: "asc" },
  });
}

async function applyAcceptedOfferTerms(projectId: string, offer: any) {
  const totalCents = offer.totalCents as number;
  const blueprint = buildMilestones(totalCents);
  const dueDates = snapshotDueDates(offer.milestonesSnapshot);
  const deliverables = snapshotDeliverables(offer.milestonesSnapshot);
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        totalEscrow: totalCents,
        builderId: offer.builderId,
        acceptedOfferId: offer.id,
      },
    });
    for (let i = 0; i < blueprint.length; i++) {
      const b = blueprint[i];
      await tx.milestone.update({
        where: { projectId_stageNumber: { projectId, stageNumber: b.stageNumber } },
        data: {
          title: b.title,
          amount: b.amount,
          releasePercent: b.releasePercent,
          dueDate: dueDates[i],
          deliverableSpec: deliverables[i] as any,
        },
      });
    }
  });
}

/** Scope-derived default deliverable kind, used to prefill offer terms. */
async function projectDefaultDeliverableKind(projectId: string) {
  const scope = await prisma.message.findFirst({
    where: { projectId, type: "SCOPE_WIDGET" as any },
    orderBy: { createdAt: "desc" },
  });
  const payload = (scope?.payload ?? {}) as JsonRecord;
  return inferDeliverableKindFromAppKinds(payload.appKinds, payload.appKindOther);
}

function normalizeScopePayload(payload: unknown, totalCents: number) {
  const base =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ({ ...(payload as JsonRecord) } as JsonRecord)
      : ({} as JsonRecord);
  base.milestones = buildMilestones(totalCents).map(({ title, amount, releasePercent }) => ({
    title,
    amount,
    releasePercent,
  }));
  base.budgetCents = totalCents;
  // Preserve app kind fields (and any other scope metadata) carried in the blueprint payload.
  if (Array.isArray(base.appKinds)) {
    base.appKinds = base.appKinds.filter((v) => typeof v === "string" && v.trim()).map((v) => String(v));
  }
  if (typeof base.appKindOther === "string") {
    const other = base.appKindOther.trim();
    if (other) base.appKindOther = other;
    else delete base.appKindOther;
  }
  return base;
}

function canSendFreeformText(project: any, senderId: string | null) {
  if (!project || !senderId) return false;
  if (project.status === "ACTIVE") return true;
  if (project.status !== "OPEN_FOR_BIDS") return false;
  if (!project.selectedOfferId) return false;
  const selected = (project.offers ?? []).find((o: any) => o.id === project.selectedOfferId);
  if (!selected) return false;
  // Pre-funding negotiation chat: only client and selected builder
  if (senderId === project.clientId && selected.builderId) return true;
  if (senderId === selected.builderId) return true;
  return false;
}

async function ensureBuilderCapacity(builderId: string, excludeProjectId?: string) {
  const active = await prisma.project.count({
    where: {
      builderId,
      status: { in: ["ACTIVE", "OPEN_FOR_BIDS"] as any },
      ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
    },
  });
  if (active >= BUILDER_PROJECT_LIMIT) {
    throw new Error(`Builder already has ${BUILDER_PROJECT_LIMIT} active/open projects`);
  }
}

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    socket.data.userId = socket.handshake.auth?.userId ?? null;
    console.log(`socket connected: ${socket.id} (user: ${socket.data.userId ?? "anonymous"})`);

    socket.on("disconnect", (reason) => {
      console.log(`socket disconnected: ${socket.id} (${reason})`);
    });

    socket.on("join_project", async (data: { projectId?: string; userId?: string }) => {
      if (!data?.projectId) return;
      socket.join(data.projectId);
      const uid = (data.userId ?? socket.data.userId ?? null) as string | null;

      const project = await getProject(data.projectId);
      if (project) {
        socket.emit("project_updated", { project: projectForViewer(project, uid) });
        socket.emit("offers_updated", {
          projectId: data.projectId,
          offers: filterOffersForViewer(project, uid),
          selectedOfferId: project.selectedOfferId ?? null,
        });

        const messages = await prisma.message.findMany({
          where: { projectId: data.projectId },
          orderBy: { createdAt: "asc" },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
        });
        socket.emit("message_history", { messages });
      }
    });

    socket.on("send_message", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId || !data?.content) {
          ack?.({ ok: false, error: "projectId and content are required" });
          return;
        }

        const senderId = (data.senderId ?? socket.data.userId ?? null) as string | null;
        const TRIGGER = "[TRIGGER_SCOPE_GENERATION]";

        if (String(data.content).includes(TRIGGER)) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: data.projectId },
              select: { title: true, totalEscrow: true, clientId: true, status: true },
            });
            if (!project) {
              ack?.({ ok: false, error: "Project not found" });
              return;
            }
            if (project.status !== "SCOPING") {
              ack?.({ ok: false, error: "Scope generation is only available while scoping" });
              return;
            }
            if (senderId && project.clientId !== senderId) {
              ack?.({ ok: false, error: "Only the project client can generate scope" });
              return;
            }

            const idea =
              String(data.content).split(TRIGGER).join(" ").trim() ||
              project.title ||
              "A new software project";

            const requestedBudget = Number(data.payload?.budgetCents);
            const budgetCents =
              Number.isInteger(requestedBudget) && requestedBudget > 0
                ? requestedBudget
                : project.totalEscrow || undefined;

            const appKinds = Array.isArray(data.payload?.appKinds)
              ? (data.payload.appKinds as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
              : [];
            const appKindOther =
              typeof data.payload?.appKindOther === "string" && data.payload.appKindOther.trim()
                ? data.payload.appKindOther.trim()
                : undefined;

            const { blueprint, source } = await synthesizeScope({
              idea,
              budgetCents,
              timeline: data.payload?.timeline,
              appKinds,
              appKindOther,
            });
            console.info(`[synthesis] generated scope via ${source}`);

            const normalizedTotal = resolveProjectTotal(budgetCents, blueprint.milestones);
            const scopePayload = normalizeScopePayload(
              { ...blueprint, budgetCents: normalizedTotal, appKinds, appKindOther },
              normalizedTotal,
            );

            const message = await prisma.message.create({
              data: {
                projectId: data.projectId,
                senderId,
                type: "SCOPE_WIDGET" as any,
                content: blueprint.title,
                payload: scopePayload as any,
              },
              include: { sender: { select: { id: true, name: true, image: true } } },
            });

            io.to(data.projectId).emit("new_message", message);
            ack?.({ ok: true, message });
          } catch (error) {
            const failure = error as Error;
            console.error("[synthesis] scope generation failed:", failure);
            const systemMessage = await prisma.message.create({
              data: {
                projectId: data.projectId,
                senderId: null,
                type: "SYSTEM" as any,
                content: `Scope generation failed: ${failure.message}`,
              },
            });
            io.to(data.projectId).emit("new_message", systemMessage);
            ack?.({ ok: false, error: failure.message });
          }
          return;
        }

        const type = String(data.type ?? "TEXT");
        const project = await getProject(data.projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }

        // Enforce composer/chat gating for freeform text.
        if (type === "TEXT") {
          if (!canSendFreeformText(project, senderId)) {
            ack?.({ ok: false, error: "Chat is not available in the current project state" });
            return;
          }
        } else if (type === "WIDGET") {
          // Legacy offer widgets are not part of the Offer-driven workflow.
          ack?.({ ok: false, error: "Direct offer widgets are not supported; use offer actions" });
          return;
        }

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId,
            type: (type as any) ?? ("TEXT" as any),
            content: data.content,
            payload: data.payload ?? null,
          },
          include: { sender: { select: { id: true, name: true, image: true } } },
        });

        io.to(data.projectId).emit("new_message", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("submit_demo", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId || !data?.milestoneId) {
          ack?.({ ok: false, error: "projectId and milestoneId are required" });
          return;
        }

        const milestone = await prisma.milestone.findUnique({
          where: { id: data.milestoneId },
        });
        const senderId = (data.senderId ?? socket.data.userId ?? null) as string | null;
        const project = milestone
          ? await prisma.project.findUnique({ where: { id: milestone.projectId } })
          : null;
        if (!milestone || !project) {
          ack?.({ ok: false, error: "Milestone or project not found" });
          return;
        }
        if (project.status !== "ACTIVE") {
          ack?.({ ok: false, error: "Demos can only be submitted for active projects" });
          return;
        }
        if (senderId && project.builderId && senderId !== project.builderId) {
          ack?.({ ok: false, error: "Only the assigned builder can submit demos" });
          return;
        }
        if (milestone.status === "RELEASED" || milestone.status === "COMPLETED") {
          ack?.({ ok: false, error: "Milestone is already released/completed" });
          return;
        }

        const isDemoReviewMilestone = milestone.title === "Initial Demo" || milestone.title === "Final Demo";
        const isResubmission = milestone.status === ("CHANGES_REQUESTED" as any);
        const requiresChangeNote = isResubmission || !!milestone.currentDemoMessageId;
        if (isResubmission && !isDemoReviewMilestone) {
          ack?.({ ok: false, error: "Changes-requested resubmission is only supported for demo milestones" });
          return;
        }

        const spec = parseDeliverableSpec((milestone as any).deliverableSpec) ?? null;
        const legacyDemoUrl =
          typeof data.demoUrl === "string" && data.demoUrl.trim() ? data.demoUrl.trim() : null;

        // Typed submissions validate against the agreed spec; the legacy demoUrl
        // path stays accepted (relaxed) so older clients keep working.
        const validated = data.deliverable
          ? validateDeliverableSubmission(spec, data.deliverable, {
              resubmission: requiresChangeNote,
            })
          : legacyDemoUrl
            ? validateDeliverableSubmission(
                spec,
                {
                  title: `${milestone.title} submission`,
                  accessUrl: legacyDemoUrl,
                  instructions: data.instructions,
                  whatChanged: data.whatChanged,
                },
                { resubmission: requiresChangeNote, enforceRequired: false },
              )
            : ({ ok: false, error: "A demo link or structured deliverable is required" } as const);
        if (!validated.ok) {
          ack?.({ ok: false, error: validated.error });
          return;
        }
        const deliverable = validated.value;
        const resolvedSpec = spec ?? defaultDeliverableSpec("WEB_LINK");

        const now = new Date();
        const latePenalty =
          milestone.dueDate && now > milestone.dueDate
            ? Math.round(milestone.amount * 0.05)
            : 0;
        const revisionOverdue =
          isResubmission && milestone.revisionRequestedAt
            ? now.getTime() > new Date(milestone.revisionRequestedAt).getTime() + 24 * 60 * 60 * 1000
            : false;

        if (latePenalty > 0) {
          await prisma.milestone.update({
            where: { id: milestone.id },
            data: { latePenalty },
          });
          await prisma.project.update({
            where: { id: data.projectId },
            data: { latePenaltyTotal: { increment: latePenalty } },
          });
        }

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId,
            type: "DEMO_WIDGET" as any,
            content: deliverable.accessUrl,
            payload: {
              milestoneId: data.milestoneId,
              deliverable,
              demoUrl: deliverable.accessUrl,
              accessUrl: deliverable.accessUrl,
              latePenalty,
              revisionOverdue,
              resubmission: isResubmission,
              specVersion: 1,
              submittedAt: now.toISOString(),
              ...(data.payload ?? {}),
            },
          },
          include: { sender: { select: { id: true, name: true, image: true } } },
        });

        await prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            demoUrl: deliverable.accessUrl,
            deliverableSpec: resolvedSpec as any,
            status: "IN_PROGRESS" as any,
            currentDemoMessageId: message.id,
            // Clear review-request state on (re)submission; history remains in messages.
            revisionRequestedAt: null,
            revisionReason: null,
          } as any,
        });

        io.to(data.projectId).emit("new_message", message);
        if (isResubmission) {
          const sys = await prisma.message.create({
            data: {
              projectId: data.projectId,
              senderId,
              type: "SYSTEM" as any,
              content: revisionOverdue ? "Demo resubmitted (overdue)" : "Demo resubmitted",
            },
          });
          io.to(data.projectId).emit("new_message", sys);
        }

        const updatedMilestone = await prisma.milestone.findUnique({ where: { id: milestone.id } });
        io.to(data.projectId).emit("milestone_updated", { milestone: updatedMilestone });
        await emitProjectState(io, data.projectId);
        ack?.({ ok: true, message, latePenalty, revisionOverdue });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("reject_demo", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId || !data?.milestoneId) {
          ack?.({ ok: false, error: "projectId and milestoneId are required" });
          return;
        }
        const reason = typeof data.reason === "string" ? data.reason.trim() : "";
        if (!reason) {
          ack?.({ ok: false, error: "A rejection reason is required" });
          return;
        }

        const milestone = await prisma.milestone.findUnique({
          where: { id: data.milestoneId },
          include: { project: true },
        });
        if (!milestone || !milestone.project) {
          ack?.({ ok: false, error: "Milestone or project not found" });
          return;
        }
        const project = milestone.project;
        const actorId = (data.userId ?? socket.data.userId ?? null) as string | null;
        if (actorId && project.clientId !== actorId) {
          ack?.({ ok: false, error: "Only the project client can reject demos" });
          return;
        }
        if (project.status !== "ACTIVE") {
          ack?.({ ok: false, error: "Demos can only be reviewed for active projects" });
          return;
        }
        const isDemoReviewMilestone = milestone.title === "Initial Demo" || milestone.title === "Final Demo";
        if (!isDemoReviewMilestone) {
          ack?.({ ok: false, error: "Demo review is only available for Initial and Final Demo milestones" });
          return;
        }
        if (milestone.status === "RELEASED" || milestone.status === "COMPLETED") {
          ack?.({ ok: false, error: "Milestone is already released/completed" });
          return;
        }
        if (milestone.status === ("CHANGES_REQUESTED" as any)) {
          ack?.({ ok: false, error: "Changes have already been requested for the current demo" });
          return;
        }
        // Only the current submitted/reviewable demo can be rejected.
        if (milestone.status !== "IN_PROGRESS" || !milestone.currentDemoMessageId) {
          ack?.({ ok: false, error: "No current demo submission is available to reject" });
          return;
        }

        const now = new Date();
        const updatedMilestone = await prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            status: "CHANGES_REQUESTED" as any,
            revisionRequestedAt: now,
            revisionReason: reason,
          } as any,
        });

        const sys = await prisma.message.create({
          data: {
            projectId: project.id,
            senderId: actorId,
            type: "SYSTEM" as any,
            content: `Changes requested: ${reason}`,
          },
        });
        io.to(project.id).emit("new_message", sys);
        io.to(project.id).emit("milestone_updated", { milestone: updatedMilestone });
        await emitProjectState(io, project.id);
        ack?.({ ok: true, milestone: updatedMilestone });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("approve_milestone", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.milestoneId) {
          ack?.({ ok: false, error: "milestoneId is required" });
          return;
        }

        const milestoneRow = await prisma.milestone.findUnique({
          where: { id: data.milestoneId },
          include: { project: true },
        });
        const actorId = (data.userId ?? socket.data.userId ?? null) as string | null;
        if (!milestoneRow) {
          ack?.({ ok: false, error: "Milestone not found" });
          return;
        }
        if (actorId && milestoneRow.project.clientId !== actorId) {
          ack?.({ ok: false, error: "Only the project client can approve milestones" });
          return;
        }
        if (milestoneRow.status === ("CHANGES_REQUESTED" as any)) {
          ack?.({ ok: false, error: "Cannot approve a demo while changes are requested" });
          return;
        }
        const isDemoReviewMilestone = milestoneRow.title === "Initial Demo" || milestoneRow.title === "Final Demo";
        if (isDemoReviewMilestone) {
          if (milestoneRow.status !== "IN_PROGRESS" || !milestoneRow.currentDemoMessageId) {
            ack?.({ ok: false, error: "Only the current submitted demo can be approved" });
            return;
          }
        }

        const result = await releaseMilestone(data.milestoneId);

        if (!result.alreadyReleased) {
          const isReleased =
            result.milestone.status === "RELEASED" ||
            result.milestone.status === "COMPLETED";
          const content = isReleased
            ? `${result.milestone.title} approved and released.`
            : result.payment
              ? `${result.milestone.title} approved; transfer pending.`
              : `${result.milestone.title} approved.`;
          const sys = await prisma.message.create({
            data: {
              projectId: result.milestone.projectId,
              senderId: actorId,
              type: "SYSTEM" as any,
              content,
            },
          });
          io.to(result.milestone.projectId).emit("new_message", sys);
        }

        io.to(result.milestone.projectId).emit("milestone_updated", {
          milestone: result.milestone,
        });
        await emitProjectState(io, result.milestone.projectId);
        ack?.({ ok: true, milestone: result.milestone, payment: result.payment });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("approve_scope", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }

        const existingProject = await prisma.project.findUnique({
          where: { id: data.projectId },
          include: { milestones: { orderBy: { stageNumber: "asc" } } },
        });
        if (!existingProject) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (data.userId ?? socket.data.userId ?? null) as string | null;
        if (actorId && existingProject.clientId !== actorId) {
          ack?.({ ok: false, error: "Only the project client can approve scope" });
          return;
        }

        if (existingProject.status === "SCOPING") {
          const openBidsCount = await prisma.project.count({
            where: { clientId: existingProject.clientId, status: "OPEN_FOR_BIDS" as any },
          });
          if (openBidsCount >= CLIENT_OPEN_BIDS_LIMIT) {
            ack?.({
              ok: false,
              error: `You can have at most ${CLIENT_OPEN_BIDS_LIMIT} projects open for bids at a time (${openBidsCount}/${CLIENT_OPEN_BIDS_LIMIT} open). Accept/fund an offer or cancel an open project to free a slot, then try publishing again.`,
              code: "CLIENT_OPEN_BIDS_LIMIT_REACHED",
              openBidsCount,
              openBidsLimit: CLIENT_OPEN_BIDS_LIMIT,
            });
            return;
          }
        }

        const scopeMessage =
          (data.messageId
            ? await prisma.message.findUnique({ where: { id: data.messageId } })
            : null) ??
          (await prisma.message.findFirst({
            where: { projectId: data.projectId, type: "SCOPE_WIDGET" as any },
            orderBy: { createdAt: "desc" },
          }));

        const incomingPayload = data?.payload && typeof data.payload === "object" ? data.payload : null;
        const basePayload =
          incomingPayload ?? (scopeMessage?.payload as JsonRecord | null) ?? {};

        const totalCents = resolveProjectTotal(
          (basePayload as any).budgetCents ??
            (scopeMessage?.payload as any)?.budgetCents ??
            existingProject.totalEscrow,
          ((basePayload as any).milestones as { amount?: number }[] | undefined) ??
            existingProject.milestones,
        );
        if (!Number.isInteger(totalCents) || totalCents <= 0) {
          ack?.({ ok: false, error: "A valid project budget is required to approve scope" });
          return;
        }

        const normalizedPayload = normalizeScopePayload(basePayload, totalCents);

        if (scopeMessage) {
          const updatedMessage = await prisma.message.update({
            where: { id: scopeMessage.id },
            data: {
              payload: normalizedPayload as any,
              content: String((normalizedPayload as any).title ?? scopeMessage.content ?? "Project Scope Blueprint"),
            },
          });
          io.to(data.projectId).emit("message_updated", updatedMessage);
        }

        await syncProjectMilestones(data.projectId, totalCents);

        await prisma.project.update({
          where: { id: data.projectId },
          data: { status: "OPEN_FOR_BIDS", totalEscrow: totalCents },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: actorId,
            type: "SYSTEM" as any,
            content: "Scope approved and published. Project is now open for builder offers.",
          },
        });

        await emitProjectState(io, data.projectId);
        io.to(data.projectId).emit("new_message", message);
        const project = await getProject(data.projectId);
        ack?.({ ok: true, project: projectForViewer(project, actorId) });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    // ---- Offer workflow (V2 + V5 + V4-lite) ----

    socket.on("submit_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, builderId } = data ?? {};
        if (!projectId || !builderId) {
          ack?.({ ok: false, error: "projectId and builderId are required" });
          return;
        }
        const actorId = (socket.data.userId ?? builderId) as string;
        if (actorId !== builderId) {
          ack?.({ ok: false, error: "Builder identity mismatch" });
          return;
        }

        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        if (project.status !== "OPEN_FOR_BIDS") {
          ack?.({ ok: false, error: "Offers can only be submitted for published/open projects" });
          return;
        }
        if (builderId === project.clientId) {
          ack?.({ ok: false, error: "Client cannot submit an offer" });
          return;
        }

        await assertBuilderCanTakeNewProjects(builderId);

        const existing = await prisma.offer.findUnique({
          where: { projectId_builderId: { projectId, builderId } },
        });
        if (existing) {
          ack?.({ ok: false, error: "Builder already has an offer for this project" });
          return;
        }

        const totalCents = parseTotalCents(data.totalCents ?? data.total);
        if (!totalCents) {
          ack?.({ ok: false, error: "A valid offer total is required" });
          return;
        }

        const terms = normalizeOfferTerms(
          totalCents,
          {
            totalCents,
            longTermAmountCents: data.longTermAmountCents,
            longTermCadence: data.longTermCadence,
            longTermNotes: data.longTermNotes,
            milestoneDueDates: data.milestoneDueDates,
            milestoneDeliverables: data.milestoneDeliverables,
          },
          undefined,
          { defaultDeliverableKind: await projectDefaultDeliverableKind(projectId) },
        );

        const offer = await prisma.offer.create({
          data: {
            projectId,
            builderId,
            status: "SUBMITTED",
            totalCents: terms.totalCents,
            milestonesSnapshot: terms.milestonesSnapshot as any,
            longTermAmountCents: terms.longTermAmountCents,
            longTermCadence: terms.longTermCadence,
            longTermNotes: terms.longTermNotes,
          },
          include: offerInclude,
        });

        const sys = await prisma.message.create({
          data: {
            projectId,
            senderId: builderId,
            type: "SYSTEM" as any,
            content: "Offer submitted",
          },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true, offer });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("revise_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, builderId } = data ?? {};
        if (!projectId || !builderId) {
          ack?.({ ok: false, error: "projectId and builderId are required" });
          return;
        }
        const actorId = (socket.data.userId ?? builderId) as string;
        if (actorId !== builderId) {
          ack?.({ ok: false, error: "Builder identity mismatch" });
          return;
        }
        const offer = await prisma.offer.findUnique({
          where: { projectId_builderId: { projectId, builderId } },
        });
        if (!offer) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (offer.status !== "SUBMITTED") {
          ack?.({ ok: false, error: "Offer can only be revised while SUBMITTED" });
          return;
        }

        const totalCents = parseTotalCents(data.totalCents ?? data.total) ?? offer.totalCents;
        const terms = normalizeOfferTerms(totalCents, data, offer);

        const updated = await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: "SUBMITTED",
            totalCents: terms.totalCents,
            milestonesSnapshot: terms.milestonesSnapshot as any,
            longTermAmountCents: terms.longTermAmountCents,
            longTermCadence: terms.longTermCadence,
            longTermNotes: terms.longTermNotes,
          },
          include: offerInclude,
        });

        const sys = await prisma.message.create({
          data: {
            projectId,
            senderId: builderId,
            type: "SYSTEM" as any,
            content: "Offer revised",
          },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true, offer: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("withdraw_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, builderId } = data ?? {};
        if (!projectId || !builderId) {
          ack?.({ ok: false, error: "projectId and builderId are required" });
          return;
        }
        const actorId = (socket.data.userId ?? builderId) as string;
        if (actorId !== builderId) {
          ack?.({ ok: false, error: "Builder identity mismatch" });
          return;
        }
        const offer = await prisma.offer.findUnique({
          where: { projectId_builderId: { projectId, builderId } },
        });
        if (!offer) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (offer.status !== "SUBMITTED") {
          ack?.({ ok: false, error: "Offer can only be withdrawn while SUBMITTED" });
          return;
        }

        const updated = await prisma.offer.update({
          where: { id: offer.id },
          data: { status: "WITHDRAWN", withdrawnAt: new Date() },
          include: offerInclude,
        });

        const sys = await prisma.message.create({
          data: { projectId, senderId: builderId, type: "SYSTEM" as any, content: "Offer withdrawn" },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true, offer: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("select_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, offerId, clientId } = data ?? {};
        if (!projectId || !offerId) {
          ack?.({ ok: false, error: "projectId and offerId are required" });
          return;
        }
        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (socket.data.userId ?? clientId ?? null) as string | null;
        if (actorId !== project.clientId) {
          ack?.({ ok: false, error: "Only the project client can select an offer" });
          return;
        }
        if (project.status !== "OPEN_FOR_BIDS") {
          ack?.({ ok: false, error: "Offers can only be selected for open projects" });
          return;
        }
        if (project.acceptedOfferId) {
          ack?.({ ok: false, error: "An offer has already been accepted" });
          return;
        }
        const offer = (project.offers as any[]).find((o) => o.id === offerId);
        if (!offer) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (offer.status !== "SUBMITTED") {
          ack?.({ ok: false, error: "Only a SUBMITTED offer can be selected" });
          return;
        }
        if (project.selectedOfferId) {
          ack?.({ ok: false, error: "An offer is already selected; cancel negotiation first" });
          return;
        }

        await prisma.$transaction(async (tx) => {
          await tx.offer.update({ where: { id: offerId }, data: { status: "SELECTED" } });
          await tx.offer.updateMany({
            where: {
              projectId,
              id: { not: offerId },
              status: { in: ["SUBMITTED", "SELECTED", "FINAL"] as any },
            },
            data: { status: "BLOCKED" },
          });
          await tx.project.update({ where: { id: projectId }, data: { selectedOfferId: offerId } });
        });

        const sys = await prisma.message.create({
          data: { projectId, senderId: actorId, type: "SYSTEM" as any, content: "Offer selected for negotiation" },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("cancel_negotiation", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, clientId } = data ?? {};
        if (!projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }
        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (socket.data.userId ?? clientId ?? null) as string | null;
        if (actorId !== project.clientId) {
          ack?.({ ok: false, error: "Only the project client can cancel negotiation" });
          return;
        }
        if (!project.selectedOfferId) {
          ack?.({ ok: false, error: "No offer is currently selected" });
          return;
        }
        if (project.acceptedOfferId) {
          ack?.({ ok: false, error: "Cannot cancel negotiation after acceptance" });
          return;
        }
        const selectedId = project.selectedOfferId;
        await prisma.$transaction(async (tx) => {
          await tx.project.update({ where: { id: projectId }, data: { selectedOfferId: null } });
          // Revert selected offer to SUBMITTED retaining terms; reopen blocked offers.
          await tx.offer.update({
            where: { id: selectedId },
            data: { status: "SUBMITTED", finalizedAt: null },
          });
          await tx.offer.updateMany({
            where: { projectId, status: "BLOCKED" as any },
            data: { status: "SUBMITTED" },
          });
        });

        const sys = await prisma.message.create({
          data: { projectId, senderId: actorId, type: "SYSTEM" as any, content: "Negotiation cancelled" },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("update_offer_terms", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, offerId } = data ?? {};
        if (!projectId || !offerId) {
          ack?.({ ok: false, error: "projectId and offerId are required" });
          return;
        }
        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (socket.data.userId ?? data.actorId ?? null) as string | null;
        const offer = await prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer || offer.projectId !== projectId) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (project.selectedOfferId !== offerId) {
          ack?.({ ok: false, error: "Only the selected offer can be negotiated" });
          return;
        }
        if (offer.status !== "SELECTED" && offer.status !== "FINAL") {
          ack?.({ ok: false, error: "Offer is not in a negotiable state" });
          return;
        }
        // Builder-only term edits (client can request changes via chat).
        if (actorId !== offer.builderId) {
          ack?.({ ok: false, error: "Only the selected builder can update offer terms" });
          return;
        }

        const totalCents = parseTotalCents(data.totalCents ?? data.total) ?? offer.totalCents;
        const terms = normalizeOfferTerms(totalCents, data, offer);

        // Any term change during negotiation clears FINAL (requires re-finalization).
        const nextStatus = offer.status === "FINAL" ? "SELECTED" : offer.status;

        const updated = await prisma.offer.update({
          where: { id: offerId },
          data: {
            status: nextStatus as any,
            totalCents: terms.totalCents,
            milestonesSnapshot: terms.milestonesSnapshot as any,
            longTermAmountCents: terms.longTermAmountCents,
            longTermCadence: terms.longTermCadence,
            longTermNotes: terms.longTermNotes,
            finalizedAt: null,
          },
          include: offerInclude,
        });

        const sys = await prisma.message.create({
          data: { projectId, senderId: actorId, type: "SYSTEM" as any, content: "Offer terms updated" },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true, offer: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("mark_offer_final", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, offerId, builderId } = data ?? {};
        if (!projectId || !offerId) {
          ack?.({ ok: false, error: "projectId and offerId are required" });
          return;
        }
        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (socket.data.userId ?? builderId ?? null) as string | null;
        const offer = await prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer || offer.projectId !== projectId) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (actorId !== offer.builderId) {
          ack?.({ ok: false, error: "Only the selected builder can mark the offer final" });
          return;
        }
        if (project.selectedOfferId !== offerId) {
          ack?.({ ok: false, error: "Only the selected offer can be finalized" });
          return;
        }
        if (offer.status !== "SELECTED" && offer.status !== "FINAL") {
          ack?.({ ok: false, error: "Offer must be selected/negotiating to mark final" });
          return;
        }

        const updated = await prisma.offer.update({
          where: { id: offerId },
          data: { status: "FINAL", finalizedAt: new Date() },
          include: offerInclude,
        });
        const sys = await prisma.message.create({
          data: { projectId, senderId: actorId, type: "SYSTEM" as any, content: "Offer marked final" },
        });
        io.to(projectId).emit("new_message", sys);
        await emitProjectState(io, projectId);
        ack?.({ ok: true, offer: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("accept_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        const { projectId, offerId, clientId } = data ?? {};
        if (!projectId || !offerId) {
          ack?.({ ok: false, error: "projectId and offerId are required" });
          return;
        }
        const project = await getProject(projectId);
        if (!project) {
          ack?.({ ok: false, error: "Project not found" });
          return;
        }
        const actorId = (socket.data.userId ?? clientId ?? null) as string | null;
        if (actorId !== project.clientId) {
          ack?.({ ok: false, error: "Only the project client can accept an offer" });
          return;
        }
        if (project.status !== "OPEN_FOR_BIDS") {
          ack?.({ ok: false, error: "Offer acceptance is only available for open projects" });
          return;
        }
        if (project.acceptedOfferId) {
          ack?.({ ok: false, error: "An offer has already been accepted" });
          return;
        }
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: { builder: { select: { id: true, probationary: true } } },
        });
        if (!offer || offer.projectId !== projectId) {
          ack?.({ ok: false, error: "Offer not found" });
          return;
        }
        if (project.selectedOfferId !== offerId || offer.status !== "FINAL") {
          ack?.({ ok: false, error: "Only the selected FINAL offer can be accepted" });
          return;
        }

        const agreedTotal = offer.totalCents;
        if (offer.builder?.probationary && agreedTotal > PROBATIONARY_CAP_CENTS) {
          ack?.({ ok: false, error: "Budget exceeds $1,500 cap for probationary builders" });
          return;
        }
        await ensureBuilderCapacity(offer.builderId, projectId);

        // Apply agreed terms and resolve offers
        await applyAcceptedOfferTerms(projectId, offer);
        await prisma.$transaction(async (tx) => {
          await tx.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } });
          await tx.offer.updateMany({
            where: { projectId, id: { not: offerId }, status: { notIn: ["WITHDRAWN", "REJECTED"] as any } },
            data: { status: "REJECTED" },
          });
          await tx.project.update({ where: { id: projectId }, data: { selectedOfferId: offerId } });
        });

        const result = await fundEscrow(projectId, agreedTotal);

        const finalOffer = await prisma.offer.findUnique({ where: { id: offerId }, include: offerInclude });
        await emitProjectState(io, projectId);

        // Specific, number-free audit notification (funding status is reflected in project/payment state).
        const message = await prisma.message.create({
          data: {
            projectId,
            senderId: actorId,
            type: "SYSTEM" as any,
            content: "Offer accepted",
          },
        });
        io.to(projectId).emit("new_message", message);

        const updatedProject = await getProject(projectId);
        ack?.({
          ok: true,
          project: projectForViewer(updatedProject, actorId),
          offer: finalOffer,
          payment: result.payment,
          clientSecret: result.clientSecret,
        });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("submit_onboarding", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.userId) {
          ack?.({ ok: false, error: "userId is required" });
          return;
        }

        const ecosystems = Array.isArray(data.ecosystems)
          ? data.ecosystems.join(",")
          : String(data.ecosystems ?? "");
        const portfolioUrls = Array.isArray(data.portfolioUrls)
          ? data.portfolioUrls.join(",")
          : String(data.portfolioUrls ?? "");

        const user = await prisma.user.upsert({
          where: { id: data.userId },
          update: {
            ecosystems,
            portfolioUrls,
            rulesAccepted: Boolean(data.rulesAccepted),
            probationary: false,
          },
          create: {
            id: data.userId,
            name: data.userId === "client-user" ? "Client User" : "Builder User",
            email:
              data.userId === "client-user"
                ? "client@example.com"
                : "builder@example.com",
            role: data.userId === "client-user" ? "CLIENT" : "BUILDER",
            ecosystems,
            portfolioUrls,
            rulesAccepted: Boolean(data.rulesAccepted),
            probationary: false,
          },
        });

        ack?.({ ok: true, user });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("cancel_project", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }

        const project = await prisma.project.findUnique({
          where: { id: data.projectId },
          include: { milestones: true },
        });
        if (!project) {
          ack?.({ ok: false, error: "project not found" });
          return;
        }

        const maxReleasedStage = Math.max(
          0,
          ...project.milestones
            .filter((item) => item.status === "RELEASED" || item.status === "COMPLETED")
            .map((item) => item.stageNumber),
        );

        const refundPercent = maxReleasedStage >= 3 ? 60 : maxReleasedStage >= 2 ? 90 : 100;
        const refundAmount = Math.round(project.totalEscrow * (refundPercent / 100));

        await prisma.project.update({
          where: { id: data.projectId },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            refundPercent,
            refundAmount,
          },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.userId ?? socket.data.userId ?? null,
            type: "SYSTEM" as any,
            content: `Project cancelled. ${refundPercent}% refund issued.`,
          },
        });

        await emitProjectState(io, data.projectId);
        io.to(data.projectId).emit("new_message", message);
        const updated = await getProject(data.projectId);
        ack?.({ ok: true, project: updated, refundPercent, refundAmount });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("request_extension", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }

        const project = await prisma.project.findUnique({ where: { id: data.projectId } });
        if (!project) {
          ack?.({ ok: false, error: "project not found" });
          return;
        }
        if (project.status !== "ACTIVE") {
          ack?.({ ok: false, error: "Extensions are only available for active projects" });
          return;
        }

        const baseDeadline = project.deadline ?? new Date();
        const newDeadline = new Date(baseDeadline.getTime() + 48 * 60 * 60 * 1000);

        await prisma.project.update({
          where: { id: data.projectId },
          data: {
            extensionRequested: true,
            deadline: newDeadline,
          },
        });

        await emitProjectState(io, data.projectId);
        const updated = await getProject(data.projectId);
        ack?.({ ok: true, project: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });

    socket.on("submit_rating", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }

        const rating = Number(data.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          ack?.({ ok: false, error: "rating must be an integer from 1 to 5" });
          return;
        }

        const project = await prisma.project.findUnique({ where: { id: data.projectId } });
        if (!project) {
          ack?.({ ok: false, error: "project not found" });
          return;
        }

        if (project.status !== "COMPLETED" && project.status !== "CANCELLED") {
          ack?.({ ok: false, error: "rating is available after completion or cancellation" });
          return;
        }

        await prisma.project.update({
          where: { id: data.projectId },
          data: {
            qualityScore: rating,
            qualityFeedback: data.feedback ?? null,
          },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.userId ?? socket.data.userId ?? null,
            type: "SYSTEM" as any,
            content: `Quality rating submitted: ${rating}/5.`,
          },
        });

        await emitProjectState(io, data.projectId);
        io.to(data.projectId).emit("new_message", message);
        const updated = await getProject(data.projectId);
        ack?.({ ok: true, project: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });
  });

  return io;
}
