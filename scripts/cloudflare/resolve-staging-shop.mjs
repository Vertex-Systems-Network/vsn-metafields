import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const PRODUCTION_SHOP = "vertex-systems-network.myshopify.com";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const rows = await prisma.session.findMany({
    select: { shop: true },
    distinct: ["shop"],
  });

  const shops = [...new Set(
    rows
      .map((row) => String(row.shop || "").trim().toLowerCase())
      .filter(
        (shop) =>
          shop &&
          shop !== PRODUCTION_SHOP &&
          /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop),
      ),
  )];

  if (shops.length !== 1) {
    throw new Error(
      `Expected exactly one non-production staging shop session, found ${shops.length}.`,
    );
  }

  process.stdout.write(shops[0]);
} finally {
  await prisma.$disconnect();
}
