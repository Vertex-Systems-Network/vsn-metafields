import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";

export const action = async ({ request }) => {
  const { shop, session } = await authenticate.webhook(request);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    const db = createPrismaClient();
    try {
      await db.session.deleteMany({ where: { shop } });
    } finally {
      await db.$disconnect();
    }
  }

  return new Response();
};
