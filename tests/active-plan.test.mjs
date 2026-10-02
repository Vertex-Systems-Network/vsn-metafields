import assert from "node:assert/strict";
import test from "node:test";
import { hasActivePlan } from "../app/active-plan.server.js";

const adminWith = (payload) => ({ graphql: async () => ({ json: async () => payload }) });

test("active Shopify subscription grants definition access, including test subscriptions", async () => {
  const admin = adminWith({ data: { currentAppInstallation: {
    activeSubscriptions: [{ status: "ACTIVE", test: true }],
  } } });
  assert.equal(await hasActivePlan(admin), true);
});

test("inactive or absent subscriptions deny definition access", async () => {
  for (const subscriptions of [[], [{ status: "CANCELLED" }]]) {
    const admin = adminWith({ data: { currentAppInstallation: {
      activeSubscriptions: subscriptions,
    } } });
    assert.equal(await hasActivePlan(admin), false);
  }
});

test("Shopify query errors and malformed responses fail closed", async () => {
  for (const result of [{ errors: [{ message: "API error" }] }, { data: {} },
    { data: { currentAppInstallation: {} } }]) {
    await assert.rejects(hasActivePlan(adminWith(result)), /Could not verify/);
  }
});
