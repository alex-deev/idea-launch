import type { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";

import { prisma } from "./lib/prisma.js";
import { fundEscrow, releaseMilestone } from "./services/escrow.js";
import { synthesizeScope } from "./services/synthesis.js";

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

      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        include: {
          milestones: true,
          client: { select: { id: true, name: true } },
          builder: { select: { id: true, name: true } },
        },
      });
      if (project) {
        socket.emit("project_updated", { project });

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

        const TRIGGER = "[TRIGGER_SCOPE_GENERATION]";
        if (String(data.content).includes(TRIGGER)) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: data.projectId },
              select: { title: true, totalEscrow: true },
            });
            const idea =
              String(data.content).split(TRIGGER).join(" ").trim() ||
              project?.title ||
              "A new software project";

            const requestedBudget = Number(data.payload?.budgetCents);
            const budgetCents =
              Number.isInteger(requestedBudget) && requestedBudget > 0
                ? requestedBudget
                : project?.totalEscrow || undefined;

            const { blueprint, source } = await synthesizeScope({
              idea,
              budgetCents,
              timeline: data.payload?.timeline,
              preferredStack: data.payload?.preferredStack,
            });
            console.info(`[synthesis] generated scope via ${source}`);

            const message = await prisma.message.create({
              data: {
                projectId: data.projectId,
                senderId: data.senderId ?? socket.data.userId ?? null,
                type: "SCOPE_WIDGET" as any,
                content: blueprint.title,
                payload: blueprint,
              },
              include: {
                sender: { select: { id: true, name: true, image: true } },
              },
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

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.senderId ?? socket.data.userId ?? null,
            type: (data.type ?? "TEXT") as any,
            content: data.content,
            payload: data.payload ?? null,
          },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
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

        const now = new Date();
        const latePenalty =
          milestone?.dueDate && now > milestone.dueDate
            ? Math.round(milestone.amount * 0.05)
            : 0;

        if (milestone && latePenalty > 0) {
          await prisma.milestone.update({
            where: { id: milestone.id },
            data: { latePenalty },
          });
          await prisma.project.update({
            where: { id: data.projectId },
            data: { latePenaltyTotal: { increment: latePenalty } },
          });
        }

        if (milestone) {
          await prisma.milestone.update({
            where: { id: milestone.id },
            data: { demoUrl: data.demoUrl ?? null, status: "IN_PROGRESS" as any },
          });
        }

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.senderId ?? socket.data.userId ?? null,
            type: "DEMO_WIDGET" as any,
            content: data.demoUrl ?? "Demo submitted",
            payload: {
              milestoneId: data.milestoneId,
              demoUrl: data.demoUrl ?? null,
              latePenalty,
              ...(data.payload ?? {}),
            },
          },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
        });

        io.to(data.projectId).emit("new_message", message);
        if (milestone) {
          const updatedMilestone = await prisma.milestone.findUnique({
            where: { id: milestone.id },
          });
          io.to(data.projectId).emit("milestone_updated", { milestone: updatedMilestone });
        }
        ack?.({ ok: true, message, latePenalty });
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

        const result = await releaseMilestone(data.milestoneId);

        io.to(result.milestone.projectId).emit("milestone_updated", {
          milestone: result.milestone,
        });
        io.to(result.milestone.projectId).emit("project_updated", {
          project: result.project,
        });
        ack?.({
          ok: true,
          milestone: result.milestone,
          payment: result.payment,
        });
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

        if (data?.payload && (data?.messageId || true)) {
          const scopeMessageId = data.messageId;
          const where = scopeMessageId
            ? { id: scopeMessageId }
            : undefined;
          if (where) {
            const updatedMessage = await prisma.message.update({
              where,
              data: {
                payload: data.payload,
                content: data.payload.title ?? "Project Scope Blueprint",
              },
            });
            io.to(data.projectId).emit("message_updated", updatedMessage);
          }
        }

        const project = await prisma.project.update({
          where: { id: data.projectId },
          data: { status: "OPEN_FOR_BIDS" },
          include: { milestones: true },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.userId ?? socket.data.userId ?? null,
            type: "SYSTEM" as any,
            content: "Scope approved. Project is now open for bids.",
          },
        });

        io.to(data.projectId).emit("project_updated", { project });
        io.to(data.projectId).emit("new_message", message);
        ack?.({ ok: true, project });
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

    socket.on("accept_offer", async (data: any, ack?: (response: any) => void) => {
      try {
        if (!data?.projectId) {
          ack?.({ ok: false, error: "projectId is required" });
          return;
        }

        const result = await fundEscrow(data.projectId);

        io.to(data.projectId).emit("project_updated", {
          project: result.project,
        });

        if (result.payment.status === "SUCCEEDED") {
          const message = await prisma.message.create({
            data: {
              projectId: data.projectId,
              senderId: data.userId ?? socket.data.userId ?? null,
              type: "SYSTEM" as any,
              content: `Escrow funded: $${(result.payment.amount / 100).toFixed(2)}. Project is now active.`,
            },
          });
          io.to(data.projectId).emit("new_message", message);
        }

        ack?.({
          ok: true,
          project: result.project,
          payment: result.payment,
          clientSecret: result.clientSecret,
        });
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

        const updated = await prisma.project.update({
          where: { id: data.projectId },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            refundPercent,
            refundAmount,
          },
          include: { milestones: true },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.userId ?? socket.data.userId ?? null,
            type: "SYSTEM" as any,
            content: `Project cancelled. ${refundPercent}% refund issued.`,
          },
        });

        io.to(data.projectId).emit("project_updated", { project: updated });
        io.to(data.projectId).emit("new_message", message);
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

        const baseDeadline = project.deadline ?? new Date();
        const newDeadline = new Date(baseDeadline.getTime() + 48 * 60 * 60 * 1000);

        const updated = await prisma.project.update({
          where: { id: data.projectId },
          data: {
            extensionRequested: true,
            deadline: newDeadline,
          },
          include: { milestones: true },
        });

        io.to(data.projectId).emit("project_updated", { project: updated });
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

        const updated = await prisma.project.update({
          where: { id: data.projectId },
          data: {
            qualityScore: rating,
            qualityFeedback: data.feedback ?? null,
          },
          include: { milestones: true },
        });

        const message = await prisma.message.create({
          data: {
            projectId: data.projectId,
            senderId: data.userId ?? socket.data.userId ?? null,
            type: "SYSTEM" as any,
            content: `Quality rating submitted: ${rating}/5.`,
          },
        });

        io.to(data.projectId).emit("project_updated", { project: updated });
        io.to(data.projectId).emit("new_message", message);
        ack?.({ ok: true, project: updated });
      } catch (error) {
        ack?.({ ok: false, error: (error as Error).message });
      }
    });
  });

  return io;
}
