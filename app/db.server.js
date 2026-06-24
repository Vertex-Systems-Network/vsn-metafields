import { PrismaClient } from "@prisma/client";

const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ["error"],
});

// Handle disconnection and reconnect
prisma.$connect().catch((e) => {
  console.error("Prisma connection error:", e);
});

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;