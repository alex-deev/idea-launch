import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECTS = [
  {
    id: "project-123",
    title: "Idea Launch Marketplace",
    totalEscrow: 100000,
    status: "SCOPING" as const,
    milestones: [
      { id: "milestone-1", stageNumber: 1, title: "Agreement", amount: 25000, releasePercent: 0, status: "PLANNED" as const },
      { id: "milestone-2", stageNumber: 2, title: "Initial Demo", amount: 25000, releasePercent: 30, status: "PLANNED" as const },
      { id: "milestone-3", stageNumber: 3, title: "Final Demo", amount: 25000, releasePercent: 40, status: "PLANNED" as const },
      { id: "milestone-4", stageNumber: 4, title: "Deployment", amount: 25000, releasePercent: 30, status: "PLANNED" as const },
    ],
  },
  {
    id: "project-456",
    title: "Analytics Dashboard",
    totalEscrow: 150000,
    status: "OPEN_FOR_BIDS" as const,
    milestones: [
      { id: "milestone-5", stageNumber: 1, title: "Agreement", amount: 37500, releasePercent: 0, status: "PLANNED" as const },
      { id: "milestone-6", stageNumber: 2, title: "Initial Demo", amount: 37500, releasePercent: 30, status: "PLANNED" as const },
      { id: "milestone-7", stageNumber: 3, title: "Final Demo", amount: 37500, releasePercent: 40, status: "PLANNED" as const },
      { id: "milestone-8", stageNumber: 4, title: "Deployment", amount: 37500, releasePercent: 30, status: "PLANNED" as const },
    ],
  },
  {
    id: "project-789",
    title: "Mobile Companion App",
    totalEscrow: 80000,
    status: "ACTIVE" as const,
    milestones: [
      { id: "milestone-9", stageNumber: 1, title: "Agreement", amount: 20000, releasePercent: 0, status: "RELEASED" as const },
      { id: "milestone-10", stageNumber: 2, title: "Initial Demo", amount: 20000, releasePercent: 30, status: "IN_PROGRESS" as const },
      { id: "milestone-11", stageNumber: 3, title: "Final Demo", amount: 20000, releasePercent: 40, status: "PLANNED" as const },
      { id: "milestone-12", stageNumber: 4, title: "Deployment", amount: 20000, releasePercent: 30, status: "PLANNED" as const },
    ],
  {
    id: "project-999",
    title: "Client Portal Redesign",
    totalEscrow: 60000,
    status: "SCOPING" as const,
    builderId: null,
    milestones: [
      { id: "milestone-13", stageNumber: 1, title: "Agreement", amount: 15000, releasePercent: 0, status: "PLANNED" as const },
      { id: "milestone-14", stageNumber: 2, title: "Initial Demo", amount: 15000, releasePercent: 30, status: "PLANNED" as const },
      { id: "milestone-15", stageNumber: 3, title: "Final Demo", amount: 15000, releasePercent: 40, status: "PLANNED" as const },
      { id: "milestone-16", stageNumber: 4, title: "Deployment", amount: 15000, releasePercent: 30, status: "PLANNED" as const },
    ],
  },
];
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
    },
  });

  const builderUser = await prisma.user.create({
    data: {
      id: "builder-user",
      name: "Builder User",
      email: "builder@example.com",
      role: "BUILDER",
    },
  });

  for (const project of PROJECTS) {
    await prisma.project.create({
      data: {
        id: project.id,
        title: project.title,
        totalEscrow: project.totalEscrow,
        status: project.status,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        clientId: clientUser.id,
        builderId: (project as { builderId?: string | null }).builderId ?? builderUser.id,
        milestones: {
          create: project.milestones,
        },
      },
    });
  }

  console.log(`Seed completed: ${PROJECTS.length} projects.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
