import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { recordDataRequest } from "../privacy-requests.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  const db = createPrismaClient();
  try {
    await recordDataRequest(db, shop, payload);
  } finally {
    await db.$disconnect();
  }
  return new Response();
};
