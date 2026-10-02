import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import {
  getPlanEntitlement,
  assertPlanCount,
  assertListValue,
} from "../plan-limits.server";
import { createPrismaClient } from "../db.server";
import {
  previewImport,
  runImportChunk,
  retryImport,
  readJob,
  publicJob,
} from "../bulk-values.server";
import { exportValueCsv } from "../bulk-csv";
import {
  featureJson,
  featureError,
  boundedJson,
} from "../feature-request.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  let db;
  try {
    if (!(await hasActivePlan(admin)))
      return featureJson(
        { ok: false, error: "An active plan is required." },
        403,
      );
    db = createPrismaClient();
    const params = new URL(request.url).searchParams;
    if (params.get("id")) {
      const job = publicJob(await readJob(db, session.shop, params.get("id")));
      if (["before", "after"].includes(params.get("export"))) {
        const before = params.get("export") === "before";
        const csv = exportValueCsv(
          job.rows
            .filter((r) => r.valid && (!before || r.before !== null))
            .map((r) => ({ ...r, value: before ? r.before : r.value })),
        );
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="metafields-${before ? "before" : "proposed"}-${job.id}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return featureJson({ ok: true, job });
    }
    const jobs = await db.metafieldJob.findMany({
      where: { shop: session.shop, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        cursor: true,
        createdAt: true,
        revision: true,
      },
    });
    return featureJson({
      ok: true,
      jobs,
      plan: await getPlanEntitlement(admin),
    });
  } catch (error) {
    return featureError(error);
  } finally {
    if (db) await db.$disconnect();
  }
};
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  if (request.method !== "POST")
    return featureJson({ ok: false, error: "Use POST." }, 405);
  let db;
  try {
    const plan = await getPlanEntitlement(admin);
    const input = await boundedJson(request, 300000);
    db = createPrismaClient();
    let job;
    if (input.action === "preview")
      job = await previewImport(admin, db, session.shop, input.csv, plan);
    else if (input.action === "apply")
      job = await runImportChunk(admin, db, session.shop, input, plan);
    else if (input.action === "retry") {
      const existing = publicJob(await readJob(db, session.shop, input.id));
      assertPlanCount(
        plan,
        "importRows",
        existing.rows.length,
        "rows per import job",
      );
      for (const row of existing.rows.filter((r) => r.valid))
        assertListValue(plan, row.type, row.value);
      job = await retryImport(db, session.shop, input);
    } else if (input.action === "remove") {
      const existing = await readJob(db, session.shop, input.id);
      if (existing.status === "running" && existing.lockUntil > new Date())
        throw new RangeError("Wait until the active chunk finishes.");
      if (input.confirm !== `REMOVE_JOB:${existing.id}`)
        throw new RangeError("Confirm removal of the saved import log.");
      const deleted = await db.metafieldJob.deleteMany({
        where: {
          id: existing.id,
          shop: session.shop,
          revision: existing.revision,
        },
      });
      if (deleted.count !== 1) throw new RangeError("Job changed; reload.");
    } else throw new RangeError("Unsupported import action.");
    return featureJson({ ok: true, job, message: "Import action confirmed." });
  } catch (error) {
    return featureError(error);
  } finally {
    if (db) await db.$disconnect();
  }
};
