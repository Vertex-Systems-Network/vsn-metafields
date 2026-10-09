import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { recordDataRequest, isSyntheticShopMismatch } from "../privacy-requests.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  if (isSyntheticShopMismatch(shop, payload, request.headers.get("X-Shopify-Test"))) {
    return new Response("Synthetic Shopify sample acknowledged without persistence");
  }
  const db = createPrismaClient();
  try {
    await recordDataRequest(db, shop, payload);
  } finally {
    await db.$disconnect();
  }
  return new Response();
};
