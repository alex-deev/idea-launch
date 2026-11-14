import { PrismaClient } from "@prisma/client";
import { defaultDeliverableSpec, type DeliverableKind } from "../src/lib/deliverables.js";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

function snapshot(totalCents: number, kind: DeliverableKind = "WEB_LINK") {
  const initial = Math.round((totalCents * 30) / 100);
  const finalDemo = Math.round((totalCents * 40) / 100);
  const deployment = totalCents - initial - finalDemo;
  const rows = [
    { stageNumber: 1, title: "Initial Demo", amount: initial, releasePercent: 30 },
    { stageNumber: 2, title: "Final Demo", amount: finalDemo, releasePercent: 40 },
    { stageNumber: 3, title: "Deployment", amount: deployment, releasePercent: 30 },
  ];
  return rows.map((r) => ({
    ...r,
    dueDate: null as string | null,
    deliverable: defaultDeliverableSpec(kind),
  }));
}

async function main() {
  // Destructive reset (offers before projects/users)
  await prisma.offer.deleteMany();
  await prisma.message.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const clientUser = await prisma.user.create({
    data: {
      id: "client-user",
      name: "Client User",
      email: "client@example.com",
      role: "CLIENT",
      password: hashPassword("password"),
    },
  });

  const builderUser = await prisma.user.create({
    data: {
      id: "builder-user",
      name: "Builder User",
      email: "builder@example.com",
      role: "BUILDER",
      password: hashPassword("password"),
    },
  });

  const builderTwo = await prisma.user.create({
    data: {
      id: "builder-two",
      name: "Builder Two",
      email: "builder2@example.com",
      role: "BUILDER",
      password: hashPassword("password"),
    },
  });

  // 1) SCOPING (client drafting)
  await prisma.project.create({
    data: {
      id: "project-123",
      title: "Idea Launch Marketplace",
      totalEscrow: 100000,
      status: "SCOPING",
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      clientId: clientUser.id,
      milestones: {
        create: [
          { id: "milestone-1", stageNumber: 1, title: "Initial Demo", amount: 30000, releasePercent: 30, status: "PLANNED" },
          { id: "milestone-2", stageNumber: 2, title: "Final Demo", amount: 40000, releasePercent: 40, status: "PLANNED" },
          { id: "milestone-3", stageNumber: 3, title: "Deployment", amount: 30000, releasePercent: 30, status: "PLANNED" },
        ],
      },
    },
  });

  // 2) OPEN_FOR_BIDS with multiple submitted offers (compare/select demo)
  const openProject = await prisma.project.create({
    data: {
      id: "project-456",
      title: "Analytics Dashboard",
      totalEscrow: 150000,
      status: "OPEN_FOR_BIDS",
      deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      clientId: clientUser.id,
      milestones: {
        create: [
          { id: "milestone-5", stageNumber: 1, title: "Initial Demo", amount: 45000, releasePercent: 30, status: "PLANNED" },
          { id: "milestone-6", stageNumber: 2, title: "Final Demo", amount: 60000, releasePercent: 40, status: "PLANNED" },
          { id: "milestone-7", stageNumber: 3, title: "Deployment", amount: 45000, releasePercent: 30, status: "PLANNED" },
        ],
      },
    },
  });

  await prisma.offer.create({
    data: {
      projectId: openProject.id,
      builderId: builderUser.id,
      status: "SUBMITTED",
      totalCents: 150000,
      milestonesSnapshot: snapshot(150000) as any,
      longTermAmountCents: 5000,
      longTermCadence: "MONTHLY",
      longTermNotes: "Monthly maintenance & minor fixes (informational).",
    },
  });
  await prisma.offer.create({
    data: {
      projectId: openProject.id,
      builderId: builderTwo.id,
      status: "SUBMITTED",
      totalCents: 140000,
      milestonesSnapshot: snapshot(140000) as any,
      longTermAmountCents: null,
      longTermCadence: "NONE",
      longTermNotes: null,
    },
  });

  // 3) ACTIVE project with accepted offer (builder assigned)
  const activeProject = await prisma.project.create({
    data: {
      id: "project-789",
      title: "Mobile Companion App",
      totalEscrow: 80000,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientId: clientUser.id,
      builderId: builderUser.id,
      milestones: {
        create: [
          { id: "milestone-9", stageNumber: 1, title: "Initial Demo", amount: 24000, releasePercent: 30, status: "IN_PROGRESS", deliverableSpec: defaultDeliverableSpec("MOBILE_BUILD") as any },
          { id: "milestone-10", stageNumber: 2, title: "Final Demo", amount: 32000, releasePercent: 40, status: "PLANNED", deliverableSpec: defaultDeliverableSpec("MOBILE_BUILD") as any },
          { id: "milestone-11", stageNumber: 3, title: "Deployment", amount: 24000, releasePercent: 30, status: "PLANNED", deliverableSpec: defaultDeliverableSpec("MOBILE_BUILD") as any },
        ],
      },
    },
  });

  const acceptedOffer = await prisma.offer.create({
    data: {
      projectId: activeProject.id,
      builderId: builderUser.id,
      status: "ACCEPTED",
      totalCents: 80000,
      milestonesSnapshot: snapshot(80000, "MOBILE_BUILD") as any,
      longTermAmountCents: 3000,
      longTermCadence: "MONTHLY",
      longTermNotes: "Basic support (informational).",
      finalizedAt: new Date(),
    },
  });
  await prisma.project.update({
    where: { id: activeProject.id },
    data: { acceptedOfferId: acceptedOffer.id, selectedOfferId: acceptedOffer.id },
  });

  // 4) SCOPING (another draft)
  await prisma.project.create({
    data: {
      id: "project-999",
      title: "Client Portal Redesign",
      totalEscrow: 60000,
      status: "SCOPING",
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      clientId: clientUser.id,
      milestones: {
        create: [
          { id: "milestone-13", stageNumber: 1, title: "Initial Demo", amount: 18000, releasePercent: 30, status: "PLANNED" },
          { id: "milestone-14", stageNumber: 2, title: "Final Demo", amount: 24000, releasePercent: 40, status: "PLANNED" },
          { id: "milestone-15", stageNumber: 3, title: "Deployment", amount: 18000, releasePercent: 30, status: "PLANNED" },
        ],
      },
    },
  });

  console.log("Seed completed: 4 projects, 3 users, offers created for open/active projects.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });