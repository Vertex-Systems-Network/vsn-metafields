import { closeSync, existsSync, openSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";

if (!existsSync(".env.local")) {
  throw new Error("Create .env.local from .env.local.example before local development.");
}
process.loadEnvFile(".env.local");
if (process.env.VSN_DB_TARGET !== "local-sqlite" ||
    process.env.DATABASE_URL !== "file:./dev.db") {
  throw new Error("Local development requires VSN_DB_TARGET=local-sqlite and DATABASE_URL=file:./dev.db.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Local SQLite commands cannot run in production.");
}

const env = { ...process.env };
// Prisma's SQLite migration engine expects the file to exist on first run.
closeSync(openSync("prisma/local/dev.db", "a"));
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) => {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(["exec", "--", "prisma", "generate", "--schema", "prisma/local/schema.prisma"]);
run(["exec", "--", "prisma", "migrate", "deploy", "--schema", "prisma/local/schema.prisma"]);
if (process.argv.includes("--serve")) {
  const child = spawn(command, ["run", "dev:shopify"], { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
