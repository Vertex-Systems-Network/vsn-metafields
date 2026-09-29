import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;

const SOURCE_SECRET_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DIRECT_URL;
const CONFIRMATION = process.env.MIGRATION_CONFIRMATION;
const EXPECTED_SUPABASE_PROJECT_REF = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const EXPECTED_SOURCE_ID_DIGEST = process.env.EXPECTED_SOURCE_ID_DIGEST;
const EXPECTED_SOURCE_COUNT = Number.parseInt(
  process.env.EXPECTED_SOURCE_SESSION_COUNT || "",
  10
);
const SOURCE_CANDIDATE_COUNT = Number.parseInt(
  process.env.SOURCE_DATABASE_URL_CANDIDATE_COUNT || "0",
  10
);

const SESSION_COLUMNS = [
  "id",
  "shop",
  "state",
  "isOnline",
  "scope",
  "expires",
  "accessToken",
  "userId",
  "firstName",
  "lastName",
  "email",
  "accountOwner",
  "locale",
  "collaborator",
  "emailVerified",
  "refreshToken",
  "refreshTokenExpires",
];

function fail(message) {
  throw new Error(message);
}

function requireSecret(name, value) {
  if (!value) fail(`${name} is required.`);
}

function sourceCandidates() {
  if (!Number.isInteger(SOURCE_CANDIDATE_COUNT) || SOURCE_CANDIDATE_COUNT < 1) {
    fail("Supabase source candidate set is missing.");
  }

  const candidates = [];
  for (let index = 1; index <= SOURCE_CANDIDATE_COUNT; index += 1) {
    const url = process.env[`SOURCE_DATABASE_URL_CANDIDATE_${index}`];
    const label =
      process.env[`SOURCE_DATABASE_URL_CANDIDATE_${index}_LABEL`] ||
      `candidate_${index}`;
    if (url) candidates.push({ label, url });
  }

  if (candidates.length < 1) {
    fail("Supabase source candidate set is empty.");
  }
  return candidates;
}

function assertProviderIdentity(sourceUrl) {
  const source = new URL(sourceUrl);
  const target = new URL(TARGET_URL);
  const targetHost = target.hostname.toLowerCase();

  if (!EXPECTED_SUPABASE_PROJECT_REF) {
    fail("EXPECTED_SUPABASE_PROJECT_REF is required.");
  }
  if (!["postgres:", "postgresql:"].includes(source.protocol)) {
    fail("Source database URL must use PostgreSQL.");
  }
  if (!/(^|\.)neon\.tech$/.test(targetHost)) {
    fail("Target database must be a Neon PostgreSQL endpoint.");
  }
  if (source.hostname.toLowerCase() === targetHost) {
    fail("Source and target databases must be different.");
  }
  if (targetHost.includes("-pooler.")) {
    fail("TARGET_DIRECT_URL must use the direct Neon endpoint, not the pooled endpoint.");
  }
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

function canonicalSession(row) {
  return SESSION_COLUMNS.map((column) => [column, normalizeValue(row[column])]);
}

function rowDigest(row) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalSession(row)))
    .digest("hex");
}

function aggregateDigest(rows) {
  return crypto
    .createHash("sha256")
    .update(
      rows
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => `${row.id}:${rowDigest(row)}`)
        .join("\n")
    )
    .digest("hex");
}

async function assertSessionSchema(client, label) {
  const result = await client.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'Session'`
  );

  const present = new Set(result.rows.map((row) => row.column_name));
  const missing = SESSION_COLUMNS.filter((column) => !present.has(column));
  if (missing.length > 0) {
    fail(`${label} Session schema is missing required columns: ${missing.join(", ")}`);
  }
}

async function auditSource(client) {
  await assertSessionSchema(client, "Source");

  const sourceResult = await client.query(
    `select ${SESSION_COLUMNS.map((column) => `"${column}"`).join(", ")}
       from public."Session"
      order by "id"`
  );
  const sourceRows = sourceResult.rows;

  if (sourceRows.length !== EXPECTED_SOURCE_COUNT) {
    fail(
      `Source Session row count drifted: expected ${EXPECTED_SOURCE_COUNT}, found ${sourceRows.length}.`
    );
  }

  const sourceTokenCount = sourceRows.filter(
    (row) => typeof row.accessToken === "string" && row.accessToken.length > 0
  ).length;
  if (sourceTokenCount !== EXPECTED_SOURCE_COUNT) {
    fail(
      `Source access-token count drifted: expected ${EXPECTED_SOURCE_COUNT}, found ${sourceTokenCount}.`
    );
  }

  const sourceIdDigest = crypto
    .createHash("sha256")
    .update(
      sourceRows
        .map((row) => row.id)
        .slice()
        .sort()
        .join("\n")
    )
    .digest("hex");

  if (sourceIdDigest !== EXPECTED_SOURCE_ID_DIGEST) {
    fail("Source Session identity fingerprint does not match the audited production source.");
  }

  return {
    rows: sourceRows,
    digest: aggregateDigest(sourceRows),
  };
}

function safeErrorCode(error) {
  return String(error?.code || error?.name || "unknown_error")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, 80);
}

async function connectAuditedSource() {
  for (const { label, url } of sourceCandidates()) {
    assertProviderIdentity(url);
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      keepAlive: true,
    });

    try {
      console.log(`production_session_source_candidate=${label};status=attempting`);
      await client.connect();
      console.log(`production_session_source_candidate=${label};status=connected`);
      const audit = await auditSource(client);
      console.log(`production_session_source_candidate=${label};status=audited`);
      return { client, ...audit, label };
    } catch (error) {
      console.log(
        `production_session_source_candidate=${label};status=rejected;code=${safeErrorCode(error)}`
      );
      await client.end().catch(() => {});
    }
  }

  fail("No certified Supabase source connection candidate passed the audited Session checks.");
}

async function main() {
  requireSecret("SOURCE_DATABASE_URL", SOURCE_SECRET_URL);
  requireSecret("TARGET_DIRECT_URL", TARGET_URL);
  requireSecret("EXPECTED_SUPABASE_PROJECT_REF", EXPECTED_SUPABASE_PROJECT_REF);
  requireSecret("EXPECTED_SOURCE_ID_DIGEST", EXPECTED_SOURCE_ID_DIGEST);

  if (CONFIRMATION !== "MIGRATE_SUPABASE_SESSIONS_TO_NEON") {
    fail("Migration confirmation gate is not satisfied.");
  }
  if (!Number.isInteger(EXPECTED_SOURCE_COUNT) || EXPECTED_SOURCE_COUNT < 1) {
    fail("EXPECTED_SOURCE_SESSION_COUNT must be a positive integer.");
  }

  const sourceAudit = await connectAuditedSource();
  const source = sourceAudit.client;
  const sourceRows = sourceAudit.rows;
  const sourceDigest = sourceAudit.digest;

  const target = new Client({
    connectionString: TARGET_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    keepAlive: true,
  });

  try {
    console.log("production_session_target_connection=attempting");
    await target.connect();
    console.log("production_session_target_connection=connected");
    await assertSessionSchema(target, "Target");

    await target.query("begin");

    const placeholders = SESSION_COLUMNS.map((_, index) => `$${index + 1}`).join(", ");
    const updates = SESSION_COLUMNS.filter((column) => column !== "id")
      .map((column) => `"${column}" = excluded."${column}"`)
      .join(", ");

    const upsertSql =
      `insert into public."Session" (${SESSION_COLUMNS.map((column) => `"${column}"`).join(", ")}) ` +
      `values (${placeholders}) on conflict ("id") do update set ${updates}`;

    for (const row of sourceRows) {
      await target.query(
        upsertSql,
        SESSION_COLUMNS.map((column) => row[column])
      );
    }

    const targetResult = await target.query(
      `select ${SESSION_COLUMNS.map((column) => `"${column}"`).join(", ")}
         from public."Session"
        where "id" = any($1::text[])
        order by "id"`,
      [sourceRows.map((row) => row.id)]
    );

    if (targetResult.rows.length !== sourceRows.length) {
      fail(
        `Target verification row count mismatch: expected ${sourceRows.length}, found ${targetResult.rows.length}.`
      );
    }

    const targetDigest = aggregateDigest(targetResult.rows);
    if (targetDigest !== sourceDigest) {
      fail("Target Session verification digest does not match source.");
    }

    await target.query("commit");

    console.log("production_session_migration=pass");
    console.log(`production_session_rows_copied=${sourceRows.length}`);
    console.log(`production_session_source_route=${sourceAudit.label}`);
    console.log("production_session_secret_values_logged=false");
    console.log("production_session_source=supabase");
    console.log("production_session_source_identity=audited");
    console.log("production_session_target=neon");
  } catch (error) {
    try {
      await target.query("rollback");
    } catch {
      // Target may not have connected or begun a transaction.
    }
    throw error;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

try {
  await main();
} catch (error) {
  console.error(`production_session_migration=fail: ${safeErrorCode(error)}`);
  process.exitCode = 1;
}
