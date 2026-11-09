import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
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

  await prisma.project.create({
    data: {
      id: "project-123",
      title: "Project 123",
      totalEscrow: 100000,
      status: "SCOPING",
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      clientId: clientUser.id,
      builderId: builderUser.id,
      milestones: {
        create: [
          { id: "milestone-1", stageNumber: 1, title: "Agreement", amount: 25000, releasePercent: 0, status: "PLANNED" },
          { id: "milestone-2", stageNumber: 2, title: "Initial Demo", amount: 25000, releasePercent: 30, status: "PLANNED" },
          { id: "milestone-3", stageNumber: 3, title: "Final Demo", amount: 25000, releasePercent: 40, status: "PLANNED" },
          { id: "milestone-4", stageNumber: 4, title: "Deployment", amount: 25000, releasePercent: 30, status: "PLANNED" },
        ],
      },
    },
  });

  console.log("Seed completed: project-123 with 4 milestones.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
