import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";

export const action = async ({ request }) => {
  const { payload, session } = await authenticate.webhook(request);
  const current = payload.current;

  if (session) {
    const db = createPrismaClient();
    try {
      await db.session.update({
        where: {
          id: session.id,
        },
        data: {
          scope: current.toString(),
        },
      });
    } finally {
      await db.$disconnect();
    }
  }

  return new Response();
};
