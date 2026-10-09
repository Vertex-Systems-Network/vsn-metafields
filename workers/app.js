import { createRequestHandler } from "react-router";
import * as build from "../build/server/index.js";
import { createPrismaClient } from "../app/db.server.js";
import { purgeExpiredJobs } from "../app/bulk-values.server.js";
import { purgeCompletedRequests } from "../app/privacy-requests.server.js";

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
        const completedRequestsRemoved = await purgeCompletedRequests(db);
        console.info("[vsn-retention]", JSON.stringify({ removed, completedRequestsRemoved }));
      } finally {
        await db.$disconnect();
      }
    })());
  },
};
