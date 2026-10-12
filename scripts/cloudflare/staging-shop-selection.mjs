const PRODUCTION_SHOP = "vertex-systems-network.myshopify.com";
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function normalizeExpectedStagingShop(value) {
  const shop = String(value || "").trim().toLowerCase();
  if (!SHOP_DOMAIN_PATTERN.test(shop) || shop === PRODUCTION_SHOP) {
    throw new Error("STAGING_SHOP must name the isolated non-production Shopify store.");
  }
  return shop;
}

export function resolveStagingShop(rows, expectedShop) {
  const shop = normalizeExpectedStagingShop(expectedShop);
  const sessionExists = rows.some(
    (row) => String(row.shop || "").trim().toLowerCase() === shop,
  );

  if (!sessionExists) {
    throw new Error(`No Shopify session exists for the configured Staging shop: ${shop}.`);
  }

  return shop;
}
