import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { redactCustomerJobs } from "../bulk-values.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  const db = createPrismaClient();
  try {
    await redactCustomerJobs(db, shop, payload);
  } finally {
    await db.$disconnect();
  }
  return new Response();
};
