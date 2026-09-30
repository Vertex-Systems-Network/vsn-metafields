#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const { Pool } = pg;
const API_VERSION = "2026-07";
const MAX_ATTEMPTS = 3;

function fail(message) {
  throw new Error(message);
}

function parseOptionalCount(name) {
  const raw = process.env[name];
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) fail(`${name} must be a non-negative integer.`);
  return Number(raw);
}

function stablePricingDetails(details) {
  if (!details || typeof details !== "object") return null;
  if (details.__typename === "AppRecurringPricing") {
    return {
      __typename: details.__typename,
      amount: String(details.price?.amount ?? ""),
      currencyCode: String(details.price?.currencyCode ?? ""),
      interval: String(details.interval ?? ""),
    };
  }
  if (details.__typename === "AppUsagePricing") {
    return {
      __typename: details.__typename,
      amount: String(details.cappedAmount?.amount ?? ""),
      currencyCode: String(details.cappedAmount?.currencyCode ?? ""),
      terms: String(details.terms ?? ""),
    };
  }
  return { __typename: String(details.__typename ?? "unknown") };
}

async function fetchSubscriptions(shop, accessToken) {
  const query = `
    query ProductionSubscriptionSnapshot {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
          test
          trialDays
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppRecurringPricing {
                  price {
                    amount
                    currencyCode
                  }
                  interval
                }
                ... on AppUsagePricing {
                  cappedAmount {
                    amount
                    currencyCode
                  }
                  terms
                }
              }
            }
          }
        }
      }
    }
  `;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
            "User-Agent": "vsn-metafields-production-subscription-audit/1.0",
          },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`Admin GraphQL returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        throw new Error("Admin GraphQL returned query errors");
      }

      const subscriptions =
        payload?.data?.currentAppInstallation?.activeSubscriptions;
      if (!Array.isArray(subscriptions)) {
        throw new Error("Admin GraphQL activeSubscriptions is not an array");
      }
      return subscriptions;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw new Error(
    `Production subscription audit Admin GraphQL failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? "unknown error"}`
  );
}

function normalizeSubscriptions(shop, subscriptions) {
  return {
    shop,
    subscriptions: subscriptions
      .map((subscription) => ({
        id: String(subscription.id ?? ""),
        status: String(subscription.status ?? ""),
        test: Boolean(subscription.test),
        trialDays: Number(subscription.trialDays ?? 0),
        lineItems: (subscription.lineItems ?? [])
          .map((lineItem) => ({
            id: String(lineItem.id ?? ""),
            pricing: stablePricingDetails(lineItem?.plan?.pricingDetails),
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function emitOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    fail("DATABASE_URL must be a PostgreSQL connection string.");
  }

  const expectedDigest = process.env.EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST || "";
  if (expectedDigest && !/^[0-9a-f]{64}$/.test(expectedDigest)) {
    fail("EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST must be a lowercase SHA-256 digest.");
  }
  const expectedShopCount = parseOptionalCount("EXPECTED_SUBSCRIPTION_SHOP_COUNT");
  const expectedActiveCount = parseOptionalCount("EXPECTED_ACTIVE_SUBSCRIPTION_COUNT");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });

  try {
    const result = await pool.query(
      `SELECT "shop", "accessToken"
       FROM "Session"
       WHERE "isOnline" = false
         AND "accessToken" IS NOT NULL
         AND "accessToken" <> ''
       ORDER BY "shop", "id"`
    );

    if (result.rows.length === 0) {
      fail("No offline production Shopify sessions are available for subscription audit.");
    }

    const seenShops = new Set();
    const snapshot = [];

    for (const row of result.rows) {
      const shop = String(row.shop || "");
      const accessToken = String(row.accessToken || "");
      if (!shop.endsWith(".myshopify.com")) {
        fail("Production subscription audit found an invalid shop domain.");
      }
      if (!accessToken) {
        fail("Production subscription audit found an offline session without an access token.");
      }
      if (seenShops.has(shop)) {
        fail("Production subscription audit found multiple offline sessions for one shop.");
      }
      seenShops.add(shop);

      const subscriptions = await fetchSubscriptions(shop, accessToken);
      snapshot.push(normalizeSubscriptions(shop, subscriptions));
    }

    snapshot.sort((a, b) => a.shop.localeCompare(b.shop));
    const activeCount = snapshot.reduce(
      (total, entry) => total + entry.subscriptions.length,
      0
    );
    const serialized = JSON.stringify(snapshot);
    const digest = crypto.createHash("sha256").update(serialized).digest("hex");

    if (expectedShopCount !== null && snapshot.length !== expectedShopCount) {
      fail(
        `Production subscription shop count changed: expected ${expectedShopCount}, got ${snapshot.length}.`
      );
    }
    if (expectedActiveCount !== null && activeCount !== expectedActiveCount) {
      fail(
        `Production active subscription count changed: expected ${expectedActiveCount}, got ${activeCount}.`
      );
    }
    if (expectedDigest && digest !== expectedDigest) {
      fail("Production subscription snapshot digest changed.");
    }

    emitOutput("subscription_snapshot_digest", digest);
    emitOutput("subscription_shop_count", snapshot.length);
    emitOutput("subscription_active_count", activeCount);

    console.log(`production_subscription_snapshot_shop_count=${snapshot.length}`);
    console.log(`production_subscription_snapshot_active_count=${activeCount}`);
    console.log(`production_subscription_snapshot_digest=${digest}`);
    console.log("production_subscription_admin_graphql=pass");
    console.log("production_subscription_credentials_logged=false");
    if (expectedDigest) {
      console.log("production_existing_subscriptions_preserved=pass");
    }
  } finally {
    await pool.end();
  }
}

await main();
