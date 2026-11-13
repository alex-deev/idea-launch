import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { buildMilestones, resolveProjectTotal } from "../lib/milestones.js";

export const projectsRouter = Router();

const BUILDER_PROJECT_LIMIT = 3;

const offerInclude = {
  builder: { select: { id: true, name: true, email: true } },
} as const;

function filterOffersForViewer<T extends { builderId: string }>(
  offers: T[] | undefined,
  viewerUserId: string,
  viewerRole: string,
  clientId?: string,
) {
  if (!offers) return offers;
  if (viewerRole === "CLIENT" && viewerUserId && viewerUserId === clientId) {
    return offers;
  }
  if (viewerRole === "BUILDER" && viewerUserId) {
    return offers.filter((o) => o.builderId === viewerUserId);
  }
  // Unknown/unauthorized viewer: expose nothing sensitive (REST trusts IDs today; be conservative)
  return viewerRole === "CLIENT" || viewerRole === "BUILDER" ? [] : offers;
}

function attachFilteredOffers(project: any, viewerUserId: string, viewerRole: string) {
  if (!project) return project;
  return {
    ...project,
    offers: filterOffersForViewer(project.offers, viewerUserId, viewerRole, project.clientId),
  };
}

projectsRouter.get("/", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const role = typeof req.query.role === "string" ? req.query.role : "CLIENT";

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const available = req.query.available === "true";

  let where: any;
  if (role === "BUILDER") {
    if (available) {
      // Published/open projects available to offer on (decoupled from exclusive claim)
      where = { status: "OPEN_FOR_BIDS" };
    } else {
      // Builder's own assigned/accepted projects
      where = { builderId: userId };
    }
  } else {
    where = { clientId: userId };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      milestones: { orderBy: { stageNumber: "asc" } },
      client: { select: { id: true, name: true, email: true } },
      builder: { select: { id: true, name: true, email: true } },
      offers: {
        orderBy: { submittedAt: "desc" },
        include: offerInclude,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });

  res.json({
    projects: projects.map((p) => attachFilteredOffers(p, userId, role)),
  });
});

projectsRouter.get("/:id", async (req, res) => {
  const viewerUserId = typeof req.query.userId === "string" ? req.query.userId : "";
  const viewerRole = typeof req.query.role === "string" ? req.query.role : "";

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      milestones: { orderBy: { stageNumber: "asc" } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        include: {
          sender: { select: { id: true, name: true, image: true } },
        },
      },
      client: { select: { id: true, name: true, email: true } },
      builder: { select: { id: true, name: true, email: true } },
      offers: {
        orderBy: { submittedAt: "desc" },
        include: offerInclude,
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project: attachFilteredOffers(project, viewerUserId, viewerRole) });
});

projectsRouter.get("/:id/offers", async (req, res) => {
  const viewerUserId = typeof req.query.userId === "string" ? req.query.userId : "";
  const viewerRole = typeof req.query.role === "string" ? req.query.role : "";

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    select: { id: true, clientId: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const offers = await prisma.offer.findMany({
    where: { projectId: req.params.id },
    orderBy: { submittedAt: "desc" },
    include: offerInclude,
  });

  const filtered = filterOffersForViewer(offers, viewerUserId, viewerRole, project.clientId);
  res.json({ offers: filtered ?? [] });
});

projectsRouter.post("/", async (req, res) => {
  const {
    title,
    clientId,
    builderId,
    totalEscrow,
    milestones,
  } = (req.body ?? {}) as {
    title?: string;
    clientId?: string;
    builderId?: string;
    totalEscrow?: number;
    milestones?: { title: string; amount: number; releasePercent?: number }[];
  };

  if (!title || !clientId) {
    res.status(400).json({ error: "title and clientId are required" });
    return;
  }

  // Builder assignment is established on offer acceptance (no pre-claim). Ignore builderId on create.
  if (builderId) {
    const activeProjects = await prisma.project.count({
      where: {
        builderId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });

    if (activeProjects >= BUILDER_PROJECT_LIMIT) {
      res.status(409).json({
        error: `Builder already has ${BUILDER_PROJECT_LIMIT} active projects`,
      });
      return;
    }
  }

  const resolvedTotal = resolveProjectTotal(
    totalEscrow,
    milestones as { amount?: number }[] | undefined,
  ) || 100000;
  const milestoneData = buildMilestones(resolvedTotal);

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      builderId: null,
      totalEscrow: resolvedTotal,
      milestones: { create: milestoneData },
    },
    include: {
      milestones: { orderBy: { stageNumber: "asc" } },
      client: { select: { id: true, name: true, email: true } },
      builder: { select: { id: true, name: true, email: true } },
      offers: { include: offerInclude },
    },
  });

  res.status(201).json({ project });
});

// Claim endpoint removed: builder participation occurs via offers (see socket workflow).