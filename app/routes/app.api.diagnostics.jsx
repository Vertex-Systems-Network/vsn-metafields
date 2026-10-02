import process from "node:process";
import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { featureDiagnostics } from "../diagnostics.server";
import { featureJson, featureError } from "../feature-request.server";
import { createPrismaClient } from "../db.server";
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  let db;
  try {
    const hasPlan = await hasActivePlan(admin);
    db = createPrismaClient();
    // Only reachability and job count are exposed; credentials/session content never leave the server.
    const count = await db.metafieldJob.count({
      where: { shop: session.shop, expiresAt: { gt: new Date() } },
    });
    const diagnostics = await featureDiagnostics(admin, hasPlan, {
      database: "reachable",
      environment:
        process.env.APP_ENV ||
        (process.env.VSN_DB_TARGET === "local-sqlite" ? "local" : "unknown"),
    });
    return featureJson({
      ok: true,
      diagnostics: { ...diagnostics, importJobCount: count },
    });
  } catch (error) {
    return featureError(error);
  } finally {
    if (db) await db.$disconnect();
  }
};
