import { Router } from "express";

import { prisma } from "../lib/prisma.js";

export const projectsRouter = Router();

const BUILDER_PROJECT_LIMIT = 3;

function toProjectSummary(project: any) {
  return project;
}

projectsRouter.get("/", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const role = typeof req.query.role === "string" ? req.query.role : "CLIENT";

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const where =
    role === "BUILDER" ? { builderId: userId } : { clientId: userId };

  const projects = await prisma.project.findMany({
    where,
    include: {
      milestones: { orderBy: { stageNumber: "asc" } },
      client: { select: { id: true, name: true, email: true } },
      builder: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ projects });
});

projectsRouter.get("/:id", async (req, res) => {
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
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project });
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

  const milestoneData = (milestones ?? []).map((milestone, index) => ({
    stageNumber: index + 1,
    title: milestone.title,
    amount: milestone.amount,
    releasePercent: milestone.releasePercent ?? 0,
  }));

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      builderId: builderId ?? null,
      totalEscrow:
        totalEscrow ??
        milestoneData.reduce((sum, milestone) => sum + milestone.amount, 0),
      milestones: { create: milestoneData },
    },
    include: {
      milestones: { orderBy: { stageNumber: "asc" } },
      client: { select: { id: true, name: true, email: true } },
      builder: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json({ project });
});

export { toProjectSummary };
