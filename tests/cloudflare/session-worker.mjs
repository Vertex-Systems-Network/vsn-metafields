import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(_request, env) {
    if (!env.DATABASE_URL) {
      return json({ ok: false, error: "DATABASE_URL missing" }, 500);
    }

    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter, log: ["error"] });
    const storage = new PrismaSessionStorage(prisma, {
      connectionRetries: 1,
      connectionRetryIntervalMs: 10,
    });

    const sessionId = "offline_ci-workerd-smoke.myshopify.com";
    const session = {
      id: sessionId,
      shop: "ci-workerd-smoke.myshopify.com",
      state: "workerd-ci-state",
      isOnline: false,
      scope: "read_products,write_products",
      expires: null,
      accessToken: "ci-placeholder-token",
      refreshToken: null,
      refreshTokenExpires: null,
      toObject() {
        return {
          id: this.id,
          shop: this.shop,
          state: this.state,
          isOnline: this.isOnline,
          scope: this.scope,
          expires: this.expires,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          refreshTokenExpires: this.refreshTokenExpires,
        };
      },
    };

    try {
      if (!(await storage.isReady())) {
        return json({ ok: false, error: "session storage not ready" }, 503);
      }

      if (!(await storage.storeSession(session))) {
        return json({ ok: false, error: "storeSession failed" }, 500);
      }

      const loaded = await storage.loadSession(sessionId);
      if (
        !loaded ||
        loaded.id !== sessionId ||
        loaded.shop !== session.shop ||
        loaded.accessToken !== session.accessToken
      ) {
        return json({ ok: false, error: "loaded session mismatch" }, 500);
      }

      if (!(await storage.deleteSession(sessionId))) {
        return json({ ok: false, error: "deleteSession failed" }, 500);
      }

      if ((await storage.loadSession(sessionId)) !== undefined) {
        return json({ ok: false, error: "session remained after delete" }, 500);
      }

      return json({
        ok: true,
        runtime: "cloudflare-workers",
        prismaAdapter: "PrismaPg",
        sessionStorage: "PrismaSessionStorage",
      });
    } finally {
      await prisma.session.deleteMany({ where: { id: sessionId } });
      await prisma.$disconnect();
    }
  },
};
