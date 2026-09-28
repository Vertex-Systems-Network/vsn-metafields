import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for Prisma.");
}

export function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}
