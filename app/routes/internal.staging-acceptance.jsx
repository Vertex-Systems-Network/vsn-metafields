import { sessionStorage, unauthenticated } from "../shopify.server";

const EXPECTED_STAGING_APP_URL =
  "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev";
const EXPECTED_STAGING_SHOP = "vertex-systems-network.myshopify.com";
const SIGNATURE_MAX_AGE_SECONDS = 300;
const SIGNED_PATH = "/internal/staging-acceptance";

const encoder = new TextEncoder();

function hexToBytes(value) {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    return null;
  }

  return Uint8Array.from(
    value.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)),
  );
}

async function verifySignature(secret, message, signatureHex) {
  const signature = hexToBytes(signatureHex);
  if (!signature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(message),
  );
}

function noStoreJson(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export const loader = async ({ request }) => {
  if (process.env.SHOPIFY_APP_URL !== EXPECTED_STAGING_APP_URL) {
    return new Response(null, { status: 404 });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return noStoreJson(
      { ok: false, error: "Staging diagnostic unavailable." },
      { status: 503 },
    );
  }

  const shop = request.headers.get("X-VSN-Shop") || "";
  const timestampHeader = request.headers.get("X-VSN-Timestamp") || "";
  const signature = request.headers.get("X-VSN-Signature") || "";
  const timestamp = Number.parseInt(timestampHeader, 10);
  const now = Math.floor(Date.now() / 1000);

  if (
    shop !== EXPECTED_STAGING_SHOP ||
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_SECONDS
  ) {
    return noStoreJson(
      { ok: false, error: "Invalid staging diagnostic request." },
      { status: 401 },
    );
  }

  const message = `${timestamp}\n${shop}\n${SIGNED_PATH}`;
  const validSignature = await verifySignature(secret, message, signature);

  if (!validSignature) {
    return noStoreJson(
      { ok: false, error: "Invalid staging diagnostic signature." },
      { status: 401 },
    );
  }

  try {
    const storedSessions = await sessionStorage.findSessionsByShop(shop);
    const { admin, session } = await unauthenticated.admin(shop);

    const response = await admin.graphql(`
      #graphql
      query StagingAcceptance {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            trialDays
          }
        }
      }
    `);

    const json = await response.json();

    if (json?.errors?.length) {
      throw new Error(
        json.errors[0]?.message || "Shopify Admin GraphQL read failed.",
      );
    }

    const subscriptions =
      json?.data?.currentAppInstallation?.activeSubscriptions ?? [];

    return noStoreJson({
      ok: true,
      shop,
      session: {
        offlineSessionAvailable: session?.isOnline === false,
        storedSessionCount: storedSessions.length,
        onlineSessionCount: storedSessions.filter(
          (storedSession) => storedSession.isOnline,
        ).length,
      },
      adminGraphql: {
        ok: true,
      },
      subscriptions: {
        readOk: Array.isArray(subscriptions),
        activeCount: subscriptions.filter(
          (subscription) => subscription.status === "ACTIVE",
        ).length,
        statuses: subscriptions.map((subscription) => ({
          name: subscription.name,
          status: subscription.status,
          test: subscription.test,
          trialDays: subscription.trialDays,
        })),
      },
    });
  } catch (error) {
    console.error("[vsn-staging-acceptance] read-only diagnostic failed", error);

    return noStoreJson(
      {
        ok: false,
        error: "Read-only staging acceptance failed.",
      },
      { status: 502 },
    );
  }
};
