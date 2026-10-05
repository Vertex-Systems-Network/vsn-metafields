export function validateBillingConfirmation(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !(
      url.hostname === "admin.shopify.com" ||
      /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(url.hostname)
    )
  ) {
    throw new Error("Shopify returned an invalid billing confirmation URL.");
  }

  if (
    url.hostname.endsWith(".myshopify.com") &&
    url.pathname.startsWith("/admin/charges/")
  ) {
    const storeHandle = url.hostname.slice(0, -".myshopify.com".length);
    const modernAdminUrl = new URL(
      `https://admin.shopify.com/store/${storeHandle}${url.pathname.slice("/admin".length)}`,
    );
    modernAdminUrl.search = url.search;
    modernAdminUrl.hash = url.hash;
    return modernAdminUrl.href;
  }

  return url.href;
}

export function openBillingApproval(value, open) {
  const confirmationUrl = validateBillingConfirmation(value);
  const opened = open(confirmationUrl, "_top");

  if (!opened) {
    throw new Error(
      "Shopify plan approval could not open automatically. Use the Shopify approval link shown below.",
    );
  }

  return confirmationUrl;
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
