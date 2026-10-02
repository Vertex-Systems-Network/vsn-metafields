import { createHash, randomUUID } from "node:crypto";
import { getDefinitions } from "./definitions.server.js";
import {
  validateValueInput,
  readResourceValue,
  verifyReferences,
  mutateValue,
} from "./metafield-values.server.js";
import { valuesEquivalent } from "./value-types.js";
import { parseImportCsv } from "./bulk-csv.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const lifetime = 7 * 24 * 60 * 60 * 1000;
export function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    inputHash: job.inputHash,
    revision: job.revision,
    cursor: job.cursor,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    rows: JSON.parse(job.rowsJson),
    results: JSON.parse(job.resultsJson),
  };
}
export async function readJob(db, shop, id) {
  const job = await db.metafieldJob.findFirst({
    where: { id, shop, expiresAt: { gt: new Date() } },
  });
  if (!job) throw new RangeError("Import job was not found or has expired.");
  if (hash(job.rowsJson) !== job.inputHash)
    throw new Error("Saved import preview failed integrity verification.");
  return job;
}
export async function previewImport(admin, db, shop, csv) {
  const input = parseImportCsv(csv);
  await db.metafieldJob.deleteMany({
    where: { shop, expiresAt: { lt: new Date() } },
  });
  if ((await db.metafieldJob.count({ where: { shop } })) >= 20)
    throw new RangeError(
      "Keep at most 20 import jobs. Remove an old job first.",
    );
  const definitions = new Map(),
    identities = new Set(),
    rows = [];
  for (const item of input) {
    const row = {
      row: item.row,
      ownerType: item.ownerType,
      ownerId: item.ownerId,
      namespace: item.namespace,
      key: item.key,
      type: item.type,
      value: item.value,
    };
    try {
      if (item.parseError) throw new RangeError(item.parseError);
      const identity = `${item.ownerId}:${item.namespace}:${item.key}`;
      if (identities.has(identity))
        throw new RangeError("Duplicate field/resource in this job.");
      identities.add(identity);
      if (!definitions.has(item.ownerType))
        definitions.set(
          item.ownerType,
          await getDefinitions(admin, item.ownerType),
        );
      const definition = definitions
        .get(item.ownerType)
        .find((d) => d.namespace === item.namespace && d.key === item.key);
      if (!definition || definition.type !== item.type)
        throw new RangeError(
          "Definition or type does not match the selected resource.",
        );
      row.value = validateValueInput(
        item.ownerType,
        item.ownerId,
        definition,
        item.value,
      );
      await verifyReferences(admin, definition.type, row.value);
      const before = await readResourceValue(
        admin,
        item.ownerType,
        item.ownerId,
        item.namespace,
        item.key,
      );
      row.before = before?.value ?? null;
      row.compareDigest = before?.compareDigest ?? null;
      row.valid = true;
    } catch (error) {
      row.valid = false;
      row.error = String(error.message || "Validation failed.").slice(0, 300);
    }
    rows.push(row);
  }
  const encoded = JSON.stringify(rows);
  if (new TextEncoder().encode(encoded).length > 512000)
    throw new RangeError("Preview snapshots exceed 512 KB. Use a smaller job.");
  const job = await db.metafieldJob.create({
    data: {
      id: randomUUID(),
      shop,
      rowsJson: encoded,
      inputHash: hash(encoded),
      expiresAt: new Date(Date.now() + lifetime),
    },
  });
  return publicJob(job);
}
export async function runImportChunk(admin, db, shop, input) {
  const job = await readJob(db, shop, input.id);
  if (
    input.confirm !== `APPLY:${job.id}:${job.inputHash}` ||
    Number(input.revision) !== job.revision
  )
    throw new RangeError("Reload and confirm the exact import preview.");
  if (["complete", "cancelled"].includes(job.status)) return publicJob(job);
  if (!["preview", "paused", "running"].includes(job.status))
    throw new RangeError("Import is not runnable.");
  const token = randomUUID(),
    now = new Date();
  const claim = await db.metafieldJob.updateMany({
    where: {
      id: job.id,
      shop,
      revision: job.revision,
      OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
    },
    data: {
      status: "running",
      lockToken: token,
      lockUntil: new Date(Date.now() + 120000),
      revision: { increment: 1 },
    },
  });
  if (claim.count !== 1)
    throw new RangeError(
      "Another request is processing this import. Reload its status.",
    );
  const rows = JSON.parse(job.rowsJson),
    results = JSON.parse(job.resultsJson);
  let cursor = job.cursor,
    revision = job.revision + 1;
  const persist = async (status) => {
    const updated = await db.metafieldJob.updateMany({
      where: { id: job.id, shop, revision, lockToken: token },
      data: {
        resultsJson: JSON.stringify(results),
        cursor,
        status,
        revision: { increment: 1 },
        lockUntil: status === "running" ? new Date(Date.now() + 120000) : null,
        lockToken: status === "running" ? token : null,
      },
    });
    if (updated.count !== 1)
      throw new Error("Import lease changed; reload before resuming.");
    revision++;
  };
  const stopAt = Math.min(rows.length, cursor + 10),
    start = Date.now();
  try {
    for (; cursor < stopAt; ) {
      const row = rows[cursor];
      let result;
      if (results[cursor] && results[cursor].status !== "failed")
        result = results[cursor];
      else if (!row.valid)
        result = { row: row.row, status: "invalid", error: row.error };
      else {
        try {
          // Reload definitions/references immediately before each write to detect drift.
          const definition = (await getDefinitions(admin, row.ownerType)).find(
            (d) =>
              d.namespace === row.namespace &&
              d.key === row.key &&
              d.type === row.type,
          );
          if (!definition)
            throw new RangeError("Definition changed since preview.");
          validateValueInput(row.ownerType, row.ownerId, definition, row.value);
          await verifyReferences(admin, row.type, row.value);
          const current = await readResourceValue(
            admin,
            row.ownerType,
            row.ownerId,
            row.namespace,
            row.key,
          );
          if (current?.type === row.type && valuesEquivalent(row.type, current.value, row.value)) {
            result = {
              row: row.row,
              status: "unchanged",
              compareDigest: current.compareDigest,
            };
          } else if ((current?.compareDigest ?? null) !== row.compareDigest) {
            result = {
              row: row.row,
              status: "conflict",
              error: "Value changed after preview; no write was made.",
            };
          } else {
            const saved = await mutateValue(admin, {
              action: "set",
              ownerId: row.ownerId,
              definition,
              value: row.value,
              compareDigest: row.compareDigest,
            });
            result = saved.ok
              ? {
                  row: row.row,
                  status: "saved",
                  compareDigest: saved.metafield.compareDigest,
                }
              : {
                  row: row.row,
                  status: "failed",
                  error: saved.error,
                  code: saved.code,
                };
          }
        } catch (error) {
          result = {
            row: row.row,
            status: "failed",
            error: String(error.message || "Write failed.").slice(0, 300),
          };
        }
      }
      results[cursor] = result;
      cursor++;
      await persist("running");
      if (Date.now() - start > 20000) break;
    }
    await persist(cursor === rows.length ? "complete" : "paused");
  } catch (error) {
    // A lost HTTP result can be safely reconciled on resume through value/digest checks.
    await db.metafieldJob.updateMany({
      where: { id: job.id, shop, lockToken: token },
      data: { status: "paused", lockToken: null, lockUntil: null },
    });
    throw error;
  }
  return publicJob(await readJob(db, shop, job.id));
}
export async function retryImport(db, shop, input) {
  const job = await readJob(db, shop, input.id),
    results = JSON.parse(job.resultsJson);
  if (
    job.status !== "complete" ||
    Number(input.revision) !== job.revision ||
    input.confirm !== `RETRY:${job.id}:${job.inputHash}`
  )
    throw new RangeError("Confirm retry of this completed job.");
  const first = results.findIndex((r) => r.status === "failed");
  if (first < 0)
    throw new RangeError(
      "No failed rows to retry. Conflicts require a fresh preview.",
    );
  // Preserve previous successful/invalid/conflict outcomes when walking from the first failure.
  const changed = await db.metafieldJob.updateMany({
    where: { id: job.id, shop, revision: job.revision, status: "complete" },
    data: {
      status: "paused",
      cursor: first,
      revision: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new RangeError("Job changed. Reload.");
  return publicJob(await readJob(db, shop, job.id));
}
