import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";

export const action = async ({ request }) => {
  const { shop } = await authenticate.webhook(request);
  const db = createPrismaClient();
  try {
    await db.metafieldJob.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
  } finally {
    await db.$disconnect();
  }
  return new Response();
};
