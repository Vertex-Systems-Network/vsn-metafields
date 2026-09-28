import { spawn } from "node:child_process";

const mode = process.argv[2];

if (!["app", "session"].includes(mode)) {
  console.error("usage: node scripts/cloudflare/runtime-smoke.mjs <app|session>");
  process.exit(2);
}

const requiredEnv = ["DATABASE_URL"];
if (mode === "app") {
  requiredEnv.push(
    "DIRECT_URL",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
    "SCOPES",
  );
}

for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`missing required environment variable: ${name}`);
    process.exit(2);
  }
}

const port = mode === "app" ? 8787 : 8788;
const args = ["--yes", "wrangler@4.141.0", "dev"];

if (mode === "session") {
  args.push("--config", "tests/cloudflare/wrangler.session-smoke.jsonc");
}

args.push("--ip", "127.0.0.1", "--port", String(port));
args.push("--var", `DATABASE_URL:${process.env.DATABASE_URL}`);

if (mode === "app") {
  args.push(
    "--var",
    `DIRECT_URL:${process.env.DIRECT_URL}`,
    "--var",
    `SHOPIFY_API_KEY:${process.env.SHOPIFY_API_KEY}`,
    "--var",
    `SHOPIFY_API_SECRET:${process.env.SHOPIFY_API_SECRET}`,
    "--var",
    `SHOPIFY_APP_URL:${process.env.SHOPIFY_APP_URL}`,
    "--var",
    `SCOPES:${process.env.SCOPES}`,
  );
}

let logs = "";
const appendLog = (chunk) => {
  logs += chunk.toString();
  if (logs.length > 120_000) {
    logs = logs.slice(-120_000);
  }
};

const child = spawn("npx", args, {
  cwd: process.cwd(),
  detached: true,
  env: { ...process.env, CI: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", appendLog);
child.stderr.on("data", appendLog);

let childExit;
child.once("exit", (code, signal) => {
  childExit = { code, signal };
});

const stopChild = async () => {
  if (childExit) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}

  await new Promise((resolve) => setTimeout(resolve, 750));

  if (!childExit) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const validateResponse = async (response) => {
  if (mode === "app") {
    if (response.status !== 200) {
      return false;
    }

    const body = await response.text();
    return body.includes("VSN Metafields");
  }

  if (response.status !== 200) {
    return false;
  }

  const payload = await response.json();
  return (
    payload?.ok === true &&
    payload?.runtime === "cloudflare-workers" &&
    payload?.prismaAdapter === "PrismaPg" &&
    payload?.sessionStorage === "PrismaSessionStorage"
  );
};

const deadline = Date.now() + 45_000;
let passed = false;
let lastError = null;

try {
  while (Date.now() < deadline) {
    if (childExit) {
      throw new Error(
        `Wrangler exited before readiness: code=${childExit.code} signal=${childExit.signal}`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(3_000),
      });

      if (await validateResponse(response)) {
        passed = true;
        break;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(750);
  }
} finally {
  await stopChild();
}

if (!passed) {
  console.error(`workerd_${mode}_smoke=fail`);
  if (lastError) {
    console.error(`last_probe_error=${lastError.message}`);
  }
  console.error(logs);
  process.exit(1);
}

if (mode === "app") {
  console.log("workerd_full_app_http_boot=pass");
} else {
  console.log("workerd_prisma_session_roundtrip=pass");
}
