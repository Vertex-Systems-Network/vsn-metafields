import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";

export const action = async ({ request }) => {
  const { shop, session } = await authenticate.webhook(request);

  // Authenticated, shop-scoped cleanup is idempotent even if sessions are already gone.
  const db = createPrismaClient();
  try {
    await db.metafieldJob.deleteMany({ where: { shop } });
    if (session) {
      await db.session.deleteMany({ where: { shop } });
    }
  } finally {
    await db.$disconnect();
  }

  return new Response();
};
