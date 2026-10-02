import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { billingIsTest, billingReturnUrl } from "../app/billing-environment.server.js";
import { submitBilling, validateBillingConfirmation } from "../app/billing-client.js";
import { PRO_PLAN } from "../app/billing-config.js";

test("staging optimized builds create only test billing; explicit live remains real", () => {
  assert.equal(billingIsTest({ APP_ENV: "staging", NODE_ENV: "production" }), true);
  assert.equal(billingIsTest({ APP_ENV: "production", NODE_ENV: "development" }), false);
  assert.equal(billingIsTest({ NODE_ENV: "production" }), false);
  assert.equal(billingIsTest({ NODE_ENV: "development" }), true);
  assert.throws(() => billingIsTest({ APP_ENV: "typo" }), /environment/);
  assert.equal(billingReturnUrl("example.myshopify.com", "abc123"), "https://admin.shopify.com/store/example/apps/abc123");
  assert.throws(() => billingReturnUrl("attacker.com", "abc123"), /identity/);
});

test("billing POST carries a fresh token and returns approval without making another request", async () => {
  let calls = 0;
  const result = await submitBilling(new FormData(), {
    shopify: { idToken: async () => "test-session-token" },
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, "/app/api/status?embedded=1");
      assert.equal(init.headers.Authorization, "Bearer test-session-token");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      return Response.json({ ok: true, confirmationUrl: "https://admin.shopify.com/store/example/charges/123", test: true });
    }, search: "?embedded=1",
  });
  assert.equal(result.test, true);
  assert.equal(calls, 1);
});

test("billing auth/HTML/API errors are visible and never automatically repeat mutations", async () => {
  await assert.rejects(submitBilling(new FormData(), { shopify: null }), /inside Shopify/);
  for (const response of [new Response("login"), Response.json({ ok: false, error: "Access denied" }, { status: 403 })]) {
    let calls = 0;
    await assert.rejects(submitBilling(new FormData(), {
      shopify: { idToken: async () => "test" }, fetch: async () => { calls++; return response; },
    }), /authentication|Access denied/);
    assert.equal(calls, 1);
  }
  for (const url of ["javascript:alert(1)", "https://evil.com", "https://admin.shopify.com.evil.com", "https://user@admin.shopify.com"]) {
    assert.throws(() => validateBillingConfirmation(url), /invalid/);
  }
});

// Load the actual JSX-free server route with only its authentication dependency mocked.
function route(admin, env = { APP_ENV: "staging", NODE_ENV: "production", SHOPIFY_API_KEY: "abc123" }) {
  const source = readFileSync(new URL("../app/routes/app.api.status.jsx", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/export const /g, "const ");
  return new Function("authenticate", "PRO_PLAN", "billingIsTest", "billingReturnUrl", "validateBillingConfirmation", "process", `${source}\nreturn { action, loader };`)(
    { admin: async () => ({ admin, session: { shop: "example.myshopify.com" } }) },
    PRO_PLAN, billingIsTest, billingReturnUrl, validateBillingConfirmation, { env },
  );
}
function createRequest() {
  const body = new FormData(); body.set("actionType", "create"); body.set("plan", PRO_PLAN.id);
  body.set("host", "untrusted-host"); body.set("shop", "attacker.myshopify.com");
  return new Request("https://staging.example/app/api/status", { method: "POST", body });
}

test("actual billing route uses staging test mode and authenticated return identity", async () => {
  let variables;
  const admin = { graphql: async (_, options) => {
    if (!options) return Response.json({ data: { currentAppInstallation: { activeSubscriptions: [] } } });
    variables = options.variables;
    return Response.json({ data: { appSubscriptionCreate: { confirmationUrl: "https://example.myshopify.com/admin/charges/1", userErrors: [] } } });
  } };
  const response = await route(admin).action({ request: createRequest() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).test, true);
  assert.equal(variables.test, true);
  assert.equal(variables.returnUrl, "https://admin.shopify.com/store/example/apps/abc123");
  assert.equal(variables.trialDays, 5);
  assert.equal(variables.lineItems[0].plan.appRecurringPricingDetails.price.amount, 55);
});

test("actual billing route fails closed on query errors, duplicate plans and mutation errors", async () => {
  for (const [query, mutation, expected] of [
    [{ data: {} }, null, 500],
    [{ data: { currentAppInstallation: { activeSubscriptions: [{ name: PRO_PLAN.name, status: "ACTIVE" }] } } }, null, 409],
    [{ data: { currentAppInstallation: { activeSubscriptions: [] } } }, { errors: [{ message: "Billing unavailable" }] }, 400],
  ]) {
    let writes = 0;
    const admin = { graphql: async (_, options) => { if (options) writes++; return Response.json(options ? mutation : query); } };
    const response = await route(admin).action({ request: createRequest() });
    assert.equal(response.status, expected);
    assert.equal(writes, mutation ? 1 : 0);
    if (mutation) assert.equal((await response.json()).error, "Billing unavailable");
  }
});
