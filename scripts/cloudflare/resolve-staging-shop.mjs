import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import process from "node:process";
import { normalizeExpectedStagingShop, resolveStagingShop } from "./staging-shop-selection.mjs";

const connectionString = process.env.DATABASE_URL;
const expectedShop = normalizeExpectedStagingShop(process.env.STAGING_SHOP);

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const rows = await prisma.session.findMany({
    where: { shop: expectedShop },
    select: { shop: true },
    take: 1,
  });
  process.stdout.write(resolveStagingShop(rows, expectedShop));
} finally {
  await prisma.$disconnect();
}
