import process from "node:process";
import { sessionStorage, unauthenticated } from "../shopify.server";
import { getStandardTemplatePage } from "../standard-definitions.server.js";

const EXPECTED_STAGING_APP_URL =
  "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev";
const PRODUCTION_SHOP = "vertex-systems-network.myshopify.com";
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

  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(message));
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
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop) ||
    shop === PRODUCTION_SHOP ||
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

  let storedSessions;

  try {
    storedSessions = await sessionStorage.findSessionsByShop(shop);
  } catch (error) {
    console.error("[vsn-staging-acceptance] session-store read failed");
    return noStoreJson(
      {
        ok: false,
        stage: "session-store",
        code: "session_store_read_failed",
        errorName: error instanceof Error ? error.name : typeof error,
      },
      { status: 502 },
    );
  }

  const sessionSummary = {
    storedSessionCount: storedSessions.length,
    onlineSessionCount: storedSessions.filter(
      (storedSession) => storedSession.isOnline,
    ).length,
    offlineSessionCount: storedSessions.filter(
      (storedSession) => !storedSession.isOnline,
    ).length,
  };

  if (storedSessions.length === 0) {
    return noStoreJson(
      {
        ok: false,
        stage: "session-store",
        code: "no_stored_sessions",
        session: sessionSummary,
      },
      { status: 409 },
    );
  }

  let admin;
  let session;

  try {
    ({ admin, session } = await unauthenticated.admin(shop));
  } catch (error) {
    console.error("[vsn-staging-acceptance] offline session unavailable");
    return noStoreJson(
      {
        ok: false,
        stage: "offline-session",
        code: "offline_session_unavailable",
        errorName: error instanceof Error ? error.name : typeof error,
        session: sessionSummary,
      },
      { status: 409 },
    );
  }

  let response;

  try {
    response = await admin.graphql(`
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
  } catch (error) {
    console.error("[vsn-staging-acceptance] admin GraphQL request failed");

    let directProbe = {
      attempted: false,
      ok: false,
      status: null,
    };

    if (session?.accessToken) {
      directProbe.attempted = true;

      try {
        const directResponse = await fetch(
          `https://${shop}/admin/api/2026-07/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": session.accessToken,
            },
            body: JSON.stringify({
              query: `
                query StagingDirectProbe {
                  currentAppInstallation {
                    id
                  }
                }
              `,
            }),
          },
        );

        const directBody = await directResponse.text();
        let errorMessages = [];

        if (!directResponse.ok && directBody) {
          try {
            const parsed = JSON.parse(directBody);
            const candidates = [
              ...(Array.isArray(parsed?.errors)
                ? parsed.errors
                : [parsed?.errors]),
              parsed?.error,
              parsed?.message,
            ];

            errorMessages = candidates
              .flatMap((candidate) => {
                if (!candidate) return [];
                if (typeof candidate === "string") return [candidate];
                if (typeof candidate?.message === "string") {
                  return [candidate.message];
                }
                return [];
              })
              .map((message) => message.slice(0, 240))
              .slice(0, 3);
          } catch {
            errorMessages = ["non_json_error_response"];
          }
        }

        directProbe = {
          attempted: true,
          ok: directResponse.ok,
          status: directResponse.status,
          requestId: directResponse.headers.get("x-request-id") || null,
          errorMessages,
        };
      } catch (directError) {
        console.error("[vsn-staging-acceptance] direct GraphQL probe failed");
        directProbe = {
          attempted: true,
          ok: false,
          status: null,
          errorName:
            directError instanceof Error
              ? directError.name
              : typeof directError,
        };
      }
    }

    return noStoreJson(
      {
        ok: false,
        stage: "admin-graphql",
        code: directProbe.ok
          ? "sdk_graphql_failed_direct_probe_passed"
          : "admin_graphql_request_failed",
        errorName: error instanceof Error ? error.name : typeof error,
        directProbe,
        session: {
          ...sessionSummary,
          selectedSessionOnline: session?.isOnline === true,
          selectedSessionHasAccessToken: Boolean(session?.accessToken),
          selectedSessionScopeCount: String(session?.scope || "")
            .split(",")
            .map((scope) => scope.trim())
            .filter(Boolean).length,
        },
      },
      { status: 502 },
    );
  }

  const json = await response.json();

  if (json?.errors?.length) {
    console.error(
      "[vsn-staging-acceptance] admin GraphQL response contained errors",
    );
    return noStoreJson(
      {
        ok: false,
        stage: "admin-graphql",
        code: "admin_graphql_response_error",
        session: sessionSummary,
      },
      { status: 502 },
    );
  }

  const subscriptions =
    json?.data?.currentAppInstallation?.activeSubscriptions ?? [];

  // Exercise bounded catalog pagination inside the deployed Worker itself.
  // This diagnostic remains signed, staging-only and read-only.
  let standardCatalog;
  try {
    const first = await getStandardTemplatePage(admin, "PRODUCT");
    const next = first.pageInfo.hasNextPage
      ? await getStandardTemplatePage(
          admin,
          "PRODUCT",
          first.pageInfo.endCursor,
        )
      : null;
    standardCatalog = {
      ok: true,
      pagesRead: next ? 2 : 1,
      firstPageMatches: first.templates.length,
      nextPageMatches: next?.templates.length || 0,
      hasMore: (next || first).pageInfo.hasNextPage,
    };
  } catch {
    return noStoreJson(
      {
        ok: false,
        stage: "standard-catalog",
        code: "bounded_catalog_read_failed",
        session: sessionSummary,
      },
      { status: 502 },
    );
  }

  return noStoreJson({
    ok: true,
    shop,
    standardCatalog,
    session: {
      offlineSessionAvailable: session?.isOnline === false,
      ...sessionSummary,
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
};
