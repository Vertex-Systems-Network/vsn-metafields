import { planFromSubscriptions } from "./billing-config.js";

export class PlanLimitError extends Error {
  constructor(message, plan) {
    super(message);
    this.code = "plan_limit";
    this.planId = plan?.id || null;
    this.status = 403;
  }
}

export async function getPlanEntitlement(admin) {
  const response = await admin.graphql(`#graphql
    query MetafieldPlanEntitlement {
      currentAppInstallation { activeSubscriptions { name status } }
    }
  `);
  const result = await response.json();
  const subscriptions =
    result?.data?.currentAppInstallation?.activeSubscriptions;
  if (result?.errors?.length || !Array.isArray(subscriptions))
    throw new Error("Could not verify the active subscription.");
  const plan = planFromSubscriptions(subscriptions);
  if (!plan)
    throw new PlanLimitError(
      "Choose an active plan to save content or import values.",
    );
  return plan;
}

export function assertPlanCount(plan, limit, count, label) {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError(`Invalid ${label} count.`);
  if (count > plan.limits[limit])
    throw new PlanLimitError(
      `${plan.label} allows ${plan.limits[limit]} ${label}. Use a smaller selection or choose a larger plan.`,
      plan,
    );
}

export function assertPlanFeature(plan, feature, label) {
  if (plan.features?.[feature] !== true)
    throw new PlanLimitError(
      `${label} is included in Pro. Compare plans to upgrade; your existing content stays in Shopify.`,
      plan,
    );
}

export function assertListValue(plan, type, value) {
  if (!type?.startsWith("list.")) return;
  let list;
  try {
    list = JSON.parse(value);
  } catch {
    throw new RangeError("Enter a valid JSON list.");
  }
  if (!Array.isArray(list)) throw new RangeError("Enter a JSON list.");
  assertPlanCount(plan, "listItems", list.length, "items per list value");
}
