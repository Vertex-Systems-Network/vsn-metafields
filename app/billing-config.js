export const PRO_PLAN = Object.freeze({
  id: "pro-plan",
  name: "pro-plan",
  amount: 55,
  currencyCode: "USD",
  interval: "EVERY_30_DAYS",
  trialDays: 5,
});

const tier = (id, label, amount, description, limits, features = {}) =>
  Object.freeze({
    id,
    name: id,
    label,
    amount,
    description,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: 5,
    limits: Object.freeze(limits),
    features: Object.freeze({
      publicMetaobjects: false,
      retryImports: false,
      ...features,
    }),
  });
export const PLANS = Object.freeze([
  tier(
    "starter-plan",
    "Starter",
    19,
    "For a focused store getting its content organized.",
    { importRows: 5, listItems: 8, metaobjectFields: 2 },
  ),
  tier(
    "growth-plan",
    "Growth",
    35,
    "More room for richer content and regular imports.",
    { importRows: 20, listItems: 32, metaobjectFields: 5 },
  ),
  tier(
    PRO_PLAN.id,
    "Pro",
    PRO_PLAN.amount,
    "The full workspace for a complex catalog.",
    { importRows: 100, listItems: 128, metaobjectFields: 25 },
    { publicMetaobjects: true, retryImports: true },
  ),
]);
export const PLAN_BY_ID = Object.freeze(
  Object.fromEntries(PLANS.map((p) => [p.id, p])),
);

// ACTIVE is verified by Shopify. Preserve the prior any-active-subscription
// contract for older provider names; a client cannot choose its entitlement.
export function planFromSubscriptions(subscriptions) {
  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  if (!active.length) return null;
  return active.reduce((best, s) => {
    const plan = PLAN_BY_ID[s.name] || PLAN_BY_ID[PRO_PLAN.id];
    return !best || plan.amount > best.amount ? plan : best;
  }, null);
}
