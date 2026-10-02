export function validateBillingConfirmation(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      !(url.hostname === "admin.shopify.com" || /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(url.hostname))) {
    throw new Error("Shopify returned an invalid billing confirmation URL.");
  }
  return url.href;
}

export async function submitBilling(formData, { shopify, fetch, search = "" }) {
  if (!shopify?.idToken) throw new Error("Open this app inside Shopify admin to manage your plan.");
  // A fresh App Bridge token avoids redirecting a POST through session-token login.
  const token = await shopify.idToken();
  if (!token) throw new Error("Your Shopify session could not be verified. Reopen the app and try again.");
  const response = await fetch(`/app/api/status${search}`, {
    method: "POST", body: formData, redirect: "error", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Shopify authentication interrupted billing. Reopen the app and try again.");
  }
  const result = await response.json();
  if (!response.ok || !result?.ok) throw new Error(result?.error || "The billing request failed.");
  if (result.confirmationUrl) result.confirmationUrl = validateBillingConfirmation(result.confirmationUrl);
  return result;
}
