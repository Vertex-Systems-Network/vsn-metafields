#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

const { Pool } = pg;
const API_VERSION = "2026-07";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function fail(message) {
  throw new Error(message);
}

function safeOAuthError(payload, fallback) {
  if (typeof payload?.error === "string" && payload.error) {
    return payload.error;
  }
  return fallback;
}

function emitEnv(name, value) {
  const path = process.env.GITHUB_ENV;
  if (!path) return;
  fs.appendFileSync(path, `${name}=${value}\n`, "utf8");
}

async function subscriptionProbe(shop, accessToken) {
  const response = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
        "User-Agent": "vsn-metafields-production-token-refresh/1.0",
      },
      body: JSON.stringify({
        query: `
          query ProductionTokenRefreshProbe {
            currentAppInstallation {
              id
              activeSubscriptions {
                id
                status
                test
              }
            }
          }
        `,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const body = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(body);
  } catch {
    payload = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      activeSubscriptionCount: null,
    };
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    fail(`Admin GraphQL returned query errors for ${shop}.`);
  }

  const subscriptions =
    payload?.data?.currentAppInstallation?.activeSubscriptions;
  if (!Array.isArray(subscriptions)) {
    fail(`Admin GraphQL activeSubscriptions was unavailable for ${shop}.`);
  }

  return {
    ok: true,
    status: response.status,
    activeSubscriptionCount: subscriptions.length,
  };
}

async function refreshOfflineToken({
  shop,
  refreshToken,
  clientId,
  clientSecret,
}) {
  let lastStatus = null;
  let lastError = "refresh_failed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "vsn-metafields-production-token-refresh/1.0",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      const body = await response.text();
      let payload = {};
      try {
        payload = JSON.parse(body);
      } catch {
        payload = {};
      }

      if (response.ok) {
        const accessToken = String(payload?.access_token ?? "");
        const nextRefreshToken = String(payload?.refresh_token ?? "");
        const expiresIn = Number(payload?.expires_in);
        const refreshExpiresIn = Number(payload?.refresh_token_expires_in);
        const scope =
          typeof payload?.scope === "string" && payload.scope
            ? payload.scope
            : null;

        if (
          !accessToken ||
          !nextRefreshToken ||
          !Number.isFinite(expiresIn) ||
          expiresIn <= 0 ||
          !Number.isFinite(refreshExpiresIn) ||
          refreshExpiresIn <= 0
        ) {
          fail(`Offline token refresh returned an incomplete token pair for ${shop}.`);
        }

        return {
          accessToken,
          refreshToken: nextRefreshToken,
          expiresIn,
          refreshExpiresIn,
          scope,
        };
      }

      lastStatus = response.status;
      lastError = safeOAuthError(payload, "refresh_failed");

      if (response.status === 401) {
        fail(
          `Stored production refresh token is no longer active for ${shop}; merchant re-authorization is required.`
        );
      }

      if (response.status !== 429 && response.status < 500) {
        fail(
          `Offline token refresh failed for ${shop}: HTTP ${response.status} ${lastError}.`
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("merchant re-authorization")
      ) {
        throw error;
      }
      if (
        error instanceof Error &&
        error.message.startsWith("Offline token refresh failed")
      ) {
        throw error;
      }
      lastError = error instanceof Error ? error.name : "transport_error";
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  fail(
    `Offline token refresh failed after ${MAX_ATTEMPTS} attempts for ${shop}: HTTP ${lastStatus ?? "transport"} ${lastError}.`
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const clientId = process.env.SHOPIFY_API_KEY || "";
  const clientSecret = process.env.SHOPIFY_API_SECRET || "";

  if (
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://")
  ) {
    fail("DATABASE_URL must be a PostgreSQL connection string.");
  }
  if (!clientId || !clientSecret) {
    fail("SHOPIFY_API_KEY and SHOPIFY_API_SECRET are required.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });

  let refreshed = 0;
  let unchanged = 0;

  try {
    const result = await pool.query(
      `SELECT "id", "shop", "accessToken", "expires", "refreshToken",
              "refreshTokenExpires", "scope"
       FROM "Session"
       WHERE "isOnline" = false
       ORDER BY "shop", "id"`
    );

    if (result.rows.length === 0) {
      fail("No offline production Shopify sessions were found.");
    }

    for (const row of result.rows) {
      const shop = String(row.shop || "");
      const accessToken = String(row.accessToken || "");
      const refreshToken = String(row.refreshToken || "");
      const expiresAt = row.expires ? new Date(row.expires) : null;
      const refreshExpiresAt = row.refreshTokenExpires
        ? new Date(row.refreshTokenExpires)
        : null;

      if (
        !shop.endsWith(".myshopify.com") ||
        !accessToken ||
        !refreshToken ||
        !expiresAt ||
        Number.isNaN(expiresAt.getTime()) ||
        !refreshExpiresAt ||
        Number.isNaN(refreshExpiresAt.getTime())
      ) {
        fail(`Expiring production offline token metadata is incomplete for ${shop || "unknown shop"}.`);
      }

      const now = Date.now();
      if (refreshExpiresAt.getTime() <= now) {
        fail(
          `Stored production refresh token has expired for ${shop}; merchant re-authorization is required.`
        );
      }

      const accessTokenFresh =
        expiresAt.getTime() - now > REFRESH_MARGIN_MS;

      if (accessTokenFresh) {
        const probe = await subscriptionProbe(shop, accessToken);
        if (probe.ok) {
          unchanged += 1;
          console.log(
            `production_offline_token_refresh_status=${shop}:still_valid`
          );
          continue;
        }
        if (probe.status !== 401) {
          fail(
            `Existing production offline token failed validation for ${shop}: HTTP ${probe.status}.`
          );
        }
      }

      const rotated = await refreshOfflineToken({
        shop,
        refreshToken,
        clientId,
        clientSecret,
      });

      const verify = await subscriptionProbe(shop, rotated.accessToken);
      if (!verify.ok) {
        fail(
          `Refreshed production offline token failed verification for ${shop}: HTTP ${verify.status}.`
        );
      }

      const nextExpiresAt = new Date(Date.now() + rotated.expiresIn * 1000);
      const nextRefreshExpiresAt = new Date(
        Date.now() + rotated.refreshExpiresIn * 1000
      );

      const updated = await pool.query(
        `UPDATE "Session"
         SET "accessToken" = $1,
             "expires" = $2,
             "refreshToken" = $3,
             "refreshTokenExpires" = $4,
             "scope" = COALESCE($5, "scope")
         WHERE "id" = $6
           AND "refreshToken" = $7
           AND "isOnline" = false
         RETURNING "id"`,
        [
          rotated.accessToken,
          nextExpiresAt,
          rotated.refreshToken,
          nextRefreshExpiresAt,
          rotated.scope,
          row.id,
          refreshToken,
        ]
      );

      if (updated.rowCount !== 1) {
        fail(
          `Refreshed token pair could not be atomically persisted for ${shop}; stop and reconcile Session state before retrying.`
        );
      }

      refreshed += 1;
      console.log(
        `production_offline_token_refresh_status=${shop}:refreshed_and_verified`
      );
      console.log(
        `production_offline_subscription_count=${shop}:${verify.activeSubscriptionCount}`
      );
    }

    const finalState = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE "accessToken" IS NOT NULL
                  AND "accessToken" <> ''
                  AND "expires" IS NOT NULL
                  AND "expires" > NOW()
                  AND "refreshToken" IS NOT NULL
                  AND "refreshToken" <> ''
                  AND "refreshTokenExpires" IS NOT NULL
                  AND "refreshTokenExpires" > NOW()
              )::int AS ready
       FROM "Session"
       WHERE "isOnline" = false`
    );

    const total = Number(finalState.rows[0]?.total ?? 0);
    const ready = Number(finalState.rows[0]?.ready ?? 0);
    if (total === 0 || total !== ready) {
      fail(
        `Production offline token refresh incomplete: ${ready}/${total} sessions are currently valid.`
      );
    }

    emitEnv(
      "SESSION_CREDENTIAL_REFRESH_PERFORMED",
      refreshed > 0 ? "true" : "false"
    );

    console.log(`production_offline_tokens_refreshed=${refreshed}`);
    console.log(`production_offline_tokens_unchanged=${unchanged}`);
    console.log(`production_offline_tokens_ready=${ready}/${total}`);
    console.log("production_offline_token_refresh=pass");
    console.log("production_token_credentials_logged=false");
    console.log("production_billing_mutation_performed=false");
    console.log("production_subscription_mutation_performed=false");
    console.log("production_schema_mutation_performed=false");
    console.log("production_merchant_reinstall_required=false");
  } finally {
    await pool.end();
  }
}

await main();
