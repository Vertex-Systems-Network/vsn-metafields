import { createRequestHandler } from "react-router";
import * as build from "../build/server/index.js";
import { createPrismaClient } from "../app/db.server.js";
import { purgeExpiredJobs } from "../app/bulk-values.server.js";

const requestHandler = createRequestHandler(build, "production");

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil((async () => {
      const db = createPrismaClient();
      try {
        const removed = await purgeExpiredJobs(db);
        console.info("[vsn-import-retention]", JSON.stringify({ removed }));
      } finally {
        await db.$disconnect();
      }
    })());
  },
};
