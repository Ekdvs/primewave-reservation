import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const pw = await bcrypt.hash("Password@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@primewave.lk" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@primewave.lk",
      passwordHash: pw,
      role: "ADMIN",
      department: "Operations",
    },
  });

  await prisma.user.upsert({
    where: { email: "member@primewave.lk" },
    update: {},
    create: {
      name: "Member One",
      email: "member@primewave.lk",
      passwordHash: pw,
      role: "MEMBER",
      department: "Engineering",
    },
  });

  const names = ["Meeting Room", "Lab", "Vehicle", "Projector"];
  const cats: Record<string, string> = {};

  for (const name of names) {
    const category = await prisma.resourceCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    cats[name] = category.id;
  }

  const resources = [
    {
      name: "Boardroom A",
      location: "Floor 3",
      capacity: 12,
      category: "Meeting Room",
      requiresApproval: false,
    },
    {
      name: "Training Lab 1",
      location: "Floor 2",
      capacity: 30,
      category: "Lab",
      requiresApproval: true,
    },
    {
      name: "Company Van",
      location: "Basement",
      capacity: 8,
      category: "Vehicle",
      requiresApproval: true,
      maxDurationMins: 480,
    },
    {
      name: "Portable Projector",
      location: "Store Room",
      capacity: null,
      category: "Projector",
      requiresApproval: false,
    },
  ];

  for (const resource of resources) {
    const { category, ...data } = resource;

    const existing = await prisma.resource.findFirst({
      where: {
        name: resource.name,
        location: resource.location,
      },
    });

    if (!existing) {
      await prisma.resource.create({
        data: {
          ...data,
          categoryId: cats[category],
        },
      });
    }
  }

  console.log("Seed completed successfully.");
  console.log("Admin: admin@primewave.lk");
  console.log("Password: Password@123");
  console.log("Member: member@primewave.lk");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
