#!/usr/bin/env node

import pg from "pg";

const { Pool } = pg;
const API_VERSION = "2026-07";
const LEGACY_REJECTION =
  "non-expiring access tokens are no longer accepted for the admin api";

function fail(message) {
  throw new Error(message);
}

function classifyForbidden(bodyText) {
  let message = "";
  try {
    const payload = JSON.parse(bodyText);
    if (typeof payload?.errors === "string") {
      message = payload.errors;
    } else if (Array.isArray(payload?.errors)) {
      message = payload.errors
        .map((item) =>
          typeof item === "string" ? item : String(item?.message ?? "")
        )
        .join(" ");
    } else if (typeof payload?.error_description === "string") {
      message = payload.error_description;
    }
  } catch {
    message = "";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes(LEGACY_REJECTION)) {
    return "legacy_non_expiring_token_rejected";
  }
  if (
    normalized.includes("access scope") ||
    normalized.includes("access denied") ||
    normalized.includes("permission")
  ) {
    return "scope_or_permission_denied";
  }
  return "unclassified_forbidden";
}

async function subscriptionProbe(shop, accessToken) {
  const response = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
        "User-Agent": "vsn-metafields-production-token-migration/1.0",
      },
      body: JSON.stringify({
        query: `
          query ProductionTokenMigrationProbe {
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
  if (response.ok) {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      fail(`Admin GraphQL returned invalid JSON for ${shop}.`);
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
      forbiddenCategory: null,
      activeSubscriptionCount: subscriptions.length,
    };
  }

  return {
    ok: false,
    status: response.status,
    forbiddenCategory:
      response.status === 403 ? classifyForbidden(body) : null,
    activeSubscriptionCount: null,
  };
}

async function exchangeLegacyOfflineToken({
  shop,
  accessToken,
  clientId,
  clientSecret,
}) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    client_id: clientId,
    client_secret: clientSecret,
    subject_token: accessToken,
    subject_token_type:
      "urn:shopify:params:oauth:token-type:offline-access-token",
    requested_token_type:
      "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: "1",
  });

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "vsn-metafields-production-token-migration/1.0",
      },
      body,
      signal: AbortSignal.timeout(15000),
    }
  );

  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const safeError =
      typeof payload?.error === "string" ? payload.error : "token_exchange_failed";
    fail(
      `Offline token exchange failed for ${shop}: HTTP ${response.status} ${safeError}.`
    );
  }

  const newAccessToken = String(payload?.access_token ?? "");
  const refreshToken = String(payload?.refresh_token ?? "");
  const expiresIn = Number(payload?.expires_in);
  const refreshExpiresIn = Number(payload?.refresh_token_expires_in);
  const scope = typeof payload?.scope === "string" ? payload.scope : null;

  if (
    !newAccessToken ||
    !refreshToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    !Number.isFinite(refreshExpiresIn) ||
    refreshExpiresIn <= 0
  ) {
    fail(`Offline token exchange returned an incomplete token pair for ${shop}.`);
  }

  return {
    accessToken: newAccessToken,
    refreshToken,
    expiresIn,
    refreshExpiresIn,
    scope,
  };
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

  let migrated = 0;
  let alreadyExpiring = 0;

  try {
    const result = await pool.query(
      `SELECT "id", "shop", "accessToken", "expires", "refreshToken",
              "refreshTokenExpires"
       FROM "Session"
       WHERE "isOnline" = false
       ORDER BY "shop", "id"`
    );

    if (result.rows.length === 0) {
      fail("No offline production Shopify sessions were found.");
    }

    for (const row of result.rows) {
      const shop = String(row.shop || "");
      const oldAccessToken = String(row.accessToken || "");
      const hasRefreshToken = Boolean(row.refreshToken);
      const hasExpires = Boolean(row.expires);
      const hasRefreshExpiry = Boolean(row.refreshTokenExpires);

      if (!shop.endsWith(".myshopify.com") || !oldAccessToken) {
        fail("Production offline session metadata is invalid.");
      }

      if (hasRefreshToken || hasExpires || hasRefreshExpiry) {
        if (!(hasRefreshToken && hasExpires && hasRefreshExpiry)) {
          fail(`Expiring token metadata is incomplete for ${shop}.`);
        }

        const probe = await subscriptionProbe(shop, oldAccessToken);
        if (!probe.ok) {
          fail(
            `Existing expiring offline token failed validation for ${shop}: HTTP ${probe.status}.`
          );
        }

        alreadyExpiring += 1;
        console.log(`production_offline_token_status=${shop}:already_expiring_valid`);
        continue;
      }

      const legacyProbe = await subscriptionProbe(shop, oldAccessToken);
      if (
        !legacyProbe.ok &&
        !(
          legacyProbe.status === 403 &&
          legacyProbe.forbiddenCategory ===
            "legacy_non_expiring_token_rejected"
        )
      ) {
        const category =
          legacyProbe.forbiddenCategory || `http_${legacyProbe.status}`;
        fail(
          `Refusing offline-token migration for ${shop}; preflight category=${category}.`
        );
      }

      console.log(
        `production_offline_token_preflight=${shop}:${
          legacyProbe.ok
            ? "legacy_token_still_valid"
            : legacyProbe.forbiddenCategory
        }`
      );

      const exchanged = await exchangeLegacyOfflineToken({
        shop,
        accessToken: oldAccessToken,
        clientId,
        clientSecret,
      });

      const verifyProbe = await subscriptionProbe(shop, exchanged.accessToken);
      if (!verifyProbe.ok) {
        fail(
          `New expiring offline token failed verification for ${shop}: HTTP ${verifyProbe.status}.`
        );
      }

      const expiresAt = new Date(Date.now() + exchanged.expiresIn * 1000);
      const refreshExpiresAt = new Date(
        Date.now() + exchanged.refreshExpiresIn * 1000
      );

      const updated = await pool.query(
        `UPDATE "Session"
         SET "accessToken" = $1,
             "refreshToken" = $2,
             "expires" = $3,
             "refreshTokenExpires" = $4,
             "scope" = COALESCE($5, "scope")
         WHERE "id" = $6
           AND "accessToken" = $7
           AND "isOnline" = false
         RETURNING "id"`,
        [
          exchanged.accessToken,
          exchanged.refreshToken,
          expiresAt,
          refreshExpiresAt,
          exchanged.scope,
          row.id,
          oldAccessToken,
        ]
      );

      if (updated.rowCount !== 1) {
        fail(
          `Token exchange succeeded but the production Session row could not be atomically updated for ${shop}. Re-running the guarded migration within Shopify's recovery window is required.`
        );
      }

      migrated += 1;
      console.log(`production_offline_token_status=${shop}:migrated_and_verified`);
      console.log(
        `production_offline_subscription_count=${shop}:${verifyProbe.activeSubscriptionCount}`
      );
    }

    const finalState = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE "refreshToken" IS NOT NULL
                  AND "refreshToken" <> ''
                  AND "expires" IS NOT NULL
                  AND "refreshTokenExpires" IS NOT NULL
              )::int AS expiring_ready
       FROM "Session"
       WHERE "isOnline" = false`
    );

    const total = Number(finalState.rows[0]?.total ?? 0);
    const expiringReady = Number(finalState.rows[0]?.expiring_ready ?? 0);
    if (total === 0 || total !== expiringReady) {
      fail(
        `Production offline token migration incomplete: ${expiringReady}/${total} sessions ready.`
      );
    }

    console.log(`production_offline_tokens_migrated=${migrated}`);
    console.log(`production_offline_tokens_already_expiring=${alreadyExpiring}`);
    console.log(`production_offline_tokens_ready=${expiringReady}/${total}`);
    console.log("production_offline_token_migration=pass");
    console.log("production_token_credentials_logged=false");
    console.log("production_billing_mutation_performed=false");
    console.log("production_shopify_reinstall_required=false");
  } finally {
    await pool.end();
  }
}

await main();
