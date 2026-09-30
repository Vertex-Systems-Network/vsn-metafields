#!/usr/bin/env node

import pg from "pg";

const { Pool } = pg;

function fail(message) {
  throw new Error(message);
}

function parseExpected(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    fail(`${name} must be a non-negative integer.`);
  }
  return Number(raw);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://")
  ) {
    fail("DATABASE_URL must be a PostgreSQL connection string.");
  }

  const expectedTotal = parseExpected("EXPECTED_SESSION_COUNT", 4);
  const expectedTokenCount = parseExpected("EXPECTED_SESSION_TOKEN_COUNT", 4);
  const expectedOfflineCount = parseExpected("EXPECTED_OFFLINE_SESSION_COUNT", 2);
  const expectedOfflineReady = parseExpected("EXPECTED_OFFLINE_READY_COUNT", 2);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });

  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (
           WHERE "accessToken" IS NOT NULL AND "accessToken" <> ''
         )::int AS token_count,
         COUNT(*) FILTER (
           WHERE "isOnline" = false
         )::int AS offline_count,
         COUNT(*) FILTER (
           WHERE "isOnline" = false
             AND "accessToken" IS NOT NULL
             AND "accessToken" <> ''
             AND "expires" IS NOT NULL
             AND "refreshToken" IS NOT NULL
             AND "refreshToken" <> ''
             AND "refreshTokenExpires" IS NOT NULL
         )::int AS offline_ready_count,
         COUNT(DISTINCT "shop")::int AS distinct_shop_count
       FROM "Session"`
    );

    const row = result.rows[0] || {};
    const total = Number(row.total ?? 0);
    const tokenCount = Number(row.token_count ?? 0);
    const offlineCount = Number(row.offline_count ?? 0);
    const offlineReadyCount = Number(row.offline_ready_count ?? 0);
    const distinctShopCount = Number(row.distinct_shop_count ?? 0);

    if (total !== expectedTotal) {
      fail(`Production Session count changed: expected ${expectedTotal}, got ${total}.`);
    }
    if (tokenCount !== expectedTokenCount) {
      fail(
        `Production Session access-token coverage changed: expected ${expectedTokenCount}, got ${tokenCount}.`
      );
    }
    if (offlineCount !== expectedOfflineCount) {
      fail(
        `Production offline Session count changed: expected ${expectedOfflineCount}, got ${offlineCount}.`
      );
    }
    if (offlineReadyCount !== expectedOfflineReady) {
      fail(
        `Production expiring offline-token readiness changed: expected ${expectedOfflineReady}, got ${offlineReadyCount}.`
      );
    }
    if (distinctShopCount !== expectedOfflineCount) {
      fail(
        `Production distinct-shop count changed: expected ${expectedOfflineCount}, got ${distinctShopCount}.`
      );
    }

    console.log(`production_session_count=${total}`);
    console.log(`production_session_token_count=${tokenCount}`);
    console.log(`production_offline_session_count=${offlineCount}`);
    console.log(`production_offline_ready_count=${offlineReadyCount}`);
    console.log(`production_distinct_shop_count=${distinctShopCount}`);
    console.log("production_session_readiness=pass");
    console.log("production_session_credentials_logged=false");
  } finally {
    await pool.end();
  }
}

await main();
