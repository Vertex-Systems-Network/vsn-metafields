// Deployment identity wins over the bundler's production optimization flag.
export function billingIsTest(env) {
  if (env.APP_ENV === "production") return false;
  if (["staging", "development", "local", "test"].includes(env.APP_ENV)) return true;
  if (env.APP_ENV) throw new Error("Unrecognized billing environment.");
  return env.NODE_ENV !== "production";
}

export function billingReturnUrl(shop, apiKey, planId) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop) ||
      !/^[a-z0-9]+$/i.test(apiKey || "") ||
      !/^(starter|growth|pro)-plan$/.test(planId || "")) {
    throw new Error("Shopify billing identity is not configured.");
  }
  const url = new URL(`https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/i, "")}/apps/${apiKey}/app/packages`);
  url.searchParams.set("billing_return", "1");
  url.searchParams.set("requested_plan", planId);
  return url.href;
}
