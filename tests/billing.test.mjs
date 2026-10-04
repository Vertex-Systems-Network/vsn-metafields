import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  billingIsTest,
  billingReturnUrl,
} from "../app/billing-environment.server.js";
import {
  openBillingApproval,
  reserveBillingApproval,
  submitBilling,
  validateBillingConfirmation,
} from "../app/billing-client.js";

test("approved Shopify confirmation opens in the top window", () => {
  const calls = [];
  openBillingApproval("https://admin.shopify.com/store/example/charges/123", (...args) => calls.push(args));
  assert.deepEqual(calls, [["https://admin.shopify.com/store/example/charges/123", "_top"]]);
  assert.throws(() => openBillingApproval("https://evil.example/charge", (...args) => calls.push(args)), /invalid/);
  assert.equal(calls.length, 1);
});
test("reserved merchant-click tab navigates to validated Shopify approval", () => {
  const calls = [];
  const pending = {
    closed: false,
    opener: {},
    location: { replace: (url) => calls.push(url) },
    focus: () => calls.push("focus"),
  };
  assert.equal(reserveBillingApproval((...args) => {
    assert.deepEqual(args, ["about:blank", "_blank"]);
    return pending;
  }), pending);
  assert.equal(pending.opener, null);
  openBillingApproval("https://example.myshopify.com/admin/charges/123", () => {
    throw new Error("unexpected fallback");
  }, pending);
  assert.deepEqual(calls, ["https://example.myshopify.com/admin/charges/123", "focus"]);
  assert.throws(() => openBillingApproval("https://evil.example/", () => {}, pending), /invalid/);
  assert.equal(calls.length, 2);
});

import {
  PRO_PLAN,
  PLAN_BY_ID,
  planFromSubscriptions,
} from "../app/billing-config.js";

test("staging optimized builds create only test billing; explicit live remains real", () => {
  assert.equal(
    billingIsTest({ APP_ENV: "staging", NODE_ENV: "production" }),
    true,
  );
  assert.equal(
    billingIsTest({ APP_ENV: "production", NODE_ENV: "development" }),
    false,
  );
  assert.equal(billingIsTest({ NODE_ENV: "production" }), false);
  assert.equal(billingIsTest({ NODE_ENV: "development" }), true);
  assert.throws(() => billingIsTest({ APP_ENV: "typo" }), /environment/);
  assert.equal(
    billingReturnUrl("example.myshopify.com", "abc123", "starter-plan"),
    "https://admin.shopify.com/store/example/apps/abc123/app/packages?billing_return=1&requested_plan=starter-plan",
  );
  assert.throws(() => billingReturnUrl("attacker.com", "abc123", "starter-plan"), /identity/);
  assert.throws(() => billingReturnUrl("example.myshopify.com", "abc123", "../../admin"), /identity/);
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
      return Response.json({
        ok: true,
        confirmationUrl: "https://admin.shopify.com/store/example/charges/123",
        test: true,
      });
    },
    search: "?embedded=1",
  });
  assert.equal(result.test, true);
  assert.equal(calls, 1);
});

test("billing auth/HTML/API errors are visible and never automatically repeat mutations", async () => {
  await assert.rejects(
    submitBilling(new FormData(), { shopify: null }),
    /inside Shopify/,
  );
  for (const response of [
    new Response("login"),
    Response.json({ ok: false, error: "Access denied" }, { status: 403 }),
  ]) {
    let calls = 0;
    await assert.rejects(
      submitBilling(new FormData(), {
        shopify: { idToken: async () => "test" },
        fetch: async () => {
          calls++;
          return response;
        },
      }),
      /authentication|Access denied/,
    );
    assert.equal(calls, 1);
  }
  for (const url of [
    "javascript:alert(1)",
    "https://evil.com",
    "https://admin.shopify.com.evil.com",
    "https://user@admin.shopify.com",
  ]) {
    assert.throws(() => validateBillingConfirmation(url), /invalid/);
  }
});

// Load the actual JSX-free server route with only its authentication dependency mocked.
function route(
  admin,
  env = {
    APP_ENV: "staging",
    NODE_ENV: "production",
    SHOPIFY_API_KEY: "abc123",
  },
) {
  const source = readFileSync(
    new URL("../app/routes/app.api.status.jsx", import.meta.url),
    "utf8",
  )
    .replace(/^import .*;\n/gm, "")
    .replace(/export const /g, "const ");
  return new Function(
    "authenticate",
    "PRO_PLAN",
    "PLAN_BY_ID",
    "planFromSubscriptions",
    "billingIsTest",
    "billingReturnUrl",
    "validateBillingConfirmation",
    "process",
    `${source}\nreturn { action, loader };`,
  )(
    {
      admin: async () => ({
        admin,
        session: { shop: "example.myshopify.com" },
      }),
    },
    PRO_PLAN,
    PLAN_BY_ID,
    planFromSubscriptions,
    billingIsTest,
    billingReturnUrl,
    validateBillingConfirmation,
    { env },
  );
}
function createRequest(plan = PRO_PLAN.id) {
  const body = new FormData();
  body.set("actionType", "create");
  body.set("plan", plan);
  body.set("amount", "0");
  body.set("trialDays", "999");
  body.set("host", "untrusted-host");
  body.set("shop", "attacker.myshopify.com");
  return new Request("https://staging.example/app/api/status", {
    method: "POST",
    body,
  });
}

test("actual billing route uses staging test mode and authenticated return identity", async () => {
  let variables;
  const admin = {
    graphql: async (_, options) => {
      if (!options)
        return Response.json({
          data: { currentAppInstallation: { activeSubscriptions: [] } },
        });
      variables = options.variables;
      return Response.json({
        data: {
          appSubscriptionCreate: {
            confirmationUrl: "https://example.myshopify.com/admin/charges/1",
            userErrors: [],
          },
        },
      });
    },
  };
  const response = await route(admin).action({ request: createRequest() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).test, true);
  assert.equal(variables.test, true);
  assert.equal(
    variables.returnUrl,
    "https://admin.shopify.com/store/example/apps/abc123/app/packages?billing_return=1&requested_plan=pro-plan",
  );
  assert.equal(variables.trialDays, 5);
  assert.equal(
    variables.lineItems[0].plan.appRecurringPricingDetails.price.amount,
    55,
  );
});

test("each configured tier charges its server price and a plan switch has no new trial", async () => {
  for (const selected of Object.values(PLAN_BY_ID)) {
    let variables;
    const admin = {
      graphql: async (_, options) => {
        if (!options)
          return Response.json({
            data: {
              currentAppInstallation: {
                activeSubscriptions: [
                  { name: "previous-plan", status: "ACTIVE" },
                ],
              },
            },
          });
        variables = options.variables;
        return Response.json({
          data: {
            appSubscriptionCreate: {
              confirmationUrl: "https://example.myshopify.com/admin/charges/1",
              userErrors: [],
            },
          },
        });
      },
    };
    assert.equal(
      (await route(admin).action({ request: createRequest(selected.id) }))
        .status,
      200,
    );
    assert.equal(variables.name, selected.name);
    assert.equal(new URL(variables.returnUrl).searchParams.get("requested_plan"), selected.id);
    assert.equal(variables.trialDays, 0);
    assert.equal(
      variables.lineItems[0].plan.appRecurringPricingDetails.price.amount,
      selected.amount,
    );
    assert.equal(
      variables.lineItems[0].plan.appRecurringPricingDetails.price.currencyCode,
      "USD",
    );
  }
});

test("status reads active and recent Shopify requests in one query without a billing mutation", async () => {
  let calls = 0;
  const admin = {
    graphql: async (query, options) => {
      calls++;
      assert.match(query, /allSubscriptions\(first: 5, reverse: true, sortKey: CREATED_AT\)/);
      assert.match(query, /activeSubscriptions/);
      assert.equal(options, undefined);
      return Response.json({
        data: { currentAppInstallation: {
          activeSubscriptions: [{ id: "gid://shopify/AppSubscription/1", name: PRO_PLAN.name, status: "ACTIVE", test: true }],
          allSubscriptions: { nodes: [
            { id: "gid://shopify/AppSubscription/2", name: "starter-plan", status: "PENDING", test: true, createdAt: "2026-10-04T10:00:00Z" },
            { id: "gid://shopify/AppSubscription/1", name: PRO_PLAN.name, status: "ACTIVE", test: true, createdAt: "2026-10-03T10:00:00Z" },
          ] },
        } },
      });
    },
  };
  const response = await route(admin).loader({ request: new Request("https://staging.example/app/api/status") });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.plan.id, PRO_PLAN.id);
  assert.equal(payload.recentSubscriptions[0].status, "PENDING");
  assert.equal(calls, 1);
});
test("an unknown client-selected tier is rejected before any subscription query or write", async () => {
  let calls = 0;
  const admin = {
    graphql: async () => {
      calls++;
      throw new Error("Should not query");
    },
  };
  assert.equal(
    (await route(admin).action({ request: createRequest("attacker-plan") }))
      .status,
    400,
  );
  assert.equal(calls, 0);
});

test("actual billing route fails closed on query errors, duplicate plans and mutation errors", async () => {
  for (const [query, mutation, expected] of [
    [{ data: {} }, null, 500],
    [
      {
        data: {
          currentAppInstallation: {
            activeSubscriptions: [{ name: PRO_PLAN.name, status: "ACTIVE" }],
          },
        },
      },
      null,
      409,
    ],
    [
      { data: { currentAppInstallation: { activeSubscriptions: [] } } },
      { errors: [{ message: "Billing unavailable" }] },
      400,
    ],
  ]) {
    let writes = 0;
    const admin = {
      graphql: async (_, options) => {
        if (options) writes++;
        return Response.json(options ? mutation : query);
      },
    };
    const response = await route(admin).action({ request: createRequest() });
    assert.equal(response.status, expected);
    assert.equal(writes, mutation ? 1 : 0);
    if (mutation)
      assert.equal((await response.json()).error, "Billing unavailable");
  }
});
