// Shopify metaobjectUpdate does not expose an expected-version argument.
// Serialize writes for the same shop and entry BEFORE the updatedAt read.
// PostgreSQL transaction advisory locks work across staging Worker instances;
// local SQLite uses a process-local queue (development only).
const localQueues = new Map();

async function withLocalQueue(key, mutate) {
  const previous = localQueues.get(key) || Promise.resolve();
  let unlock;
  const current = new Promise((resolve) => { unlock = resolve; });
  localQueues.set(key, current);
  await previous;
  try {
    return await mutate();
  } finally {
    unlock();
    if (localQueues.get(key) === current) localQueues.delete(key);
  }
}

async function defaultDbFactory() {
  const { createPrismaClient } = await import("./db.server.js");
  return createPrismaClient();
}

export async function withMetaobjectEntryLock(
  shop,
  entryId,
  mutate,
  { target = process.env.VSN_DB_TARGET || "neon", dbFactory = defaultDbFactory } = {},
) {
  if (
    typeof shop !== "string" ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop) ||
    typeof entryId !== "string" ||
    !/^gid:\/\/shopify\/Metaobject\/[0-9]+$/.test(entryId) ||
    typeof mutate !== "function"
  )
    throw new RangeError("Invalid shop or metaobject entry for guarded update.");

  if (target === "local-sqlite")
    return withLocalQueue(shop + ":" + entryId, mutate);

  if (target !== "neon")
    throw new RangeError("Unsupported database target for metaobject update.");

  const db = await dbFactory();
  try {
    return await db.$transaction(
      async (transaction) => {
        // Transaction-scoped lock works behind Neon's transactional pooler.
        // hashtext collisions can serialize unrelated entries, not bypass a lock.
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${shop}), hashtext(${entryId}))::text AS held`;
        return mutate();
      },
      { maxWait: 10000, timeout: 30000 },
    );
  } finally {
    await db.$disconnect();
  }
}
