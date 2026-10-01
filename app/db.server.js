import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for Prisma.");
}

const target = process.env.VSN_DB_TARGET || "neon";
if (target !== "local-sqlite" && target !== "neon") {
  throw new Error("VSN_DB_TARGET must be local-sqlite or neon.");
}
if (target === "local-sqlite" && (process.env.NODE_ENV === "production" || !connectionString.startsWith("file:"))) {
  throw new Error("Local SQLite requires a file: DATABASE_URL outside production.");
}
if (target === "neon" && !/^postgres(?:ql)?:\/\//.test(connectionString)) {
  throw new Error("Neon runtime requires a PostgreSQL DATABASE_URL.");
}
const LocalPrismaClient = target === "local-sqlite"
  ? createRequire(import.meta.url)(resolve("prisma/generated/sqlite-client/index.js")).PrismaClient
  : null;

export function createPrismaClient() {
  if (target === "local-sqlite") {
    return new LocalPrismaClient({ log: ["error"] });
  }
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}
