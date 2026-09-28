import { Outlet, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";

function decodeJwtPayload(token) {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function getSessionDiagnostic(shop) {
  const prisma = createPrismaClient();

  try {
    const [shopSessionCount, shopOnlineSessionCount] = await Promise.all([
      prisma.session.count({ where: { shop } }),
      prisma.session.count({ where: { shop, isOnline: true } }),
    ]);

    return {
      dbReachable: true,
      shopSessionCount,
      shopOnlineSessionCount,
    };
  } catch (error) {
    return {
      dbReachable: false,
      dbErrorName: error instanceof Error ? error.name : typeof error,
      dbErrorCode:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export const loader = async ({ request }) => {
  // eslint-disable-next-line no-undef
  const env = process.env;
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";

  try {
    await authenticate.admin(request);
  } catch (error) {
    const idTokenPayload = decodeJwtPayload(url.searchParams.get("id_token"));
    const sessionDiagnostic = await getSessionDiagnostic(shop);
    const audience = idTokenPayload?.aud;
    const audienceMatchesApiKey = Array.isArray(audience)
      ? audience.includes(env.SHOPIFY_API_KEY)
      : audience === env.SHOPIFY_API_KEY;

    const diagnostic = {
      event: "shopify-admin-auth-failed",
      route: "/app",
      shop,
      hasDatabaseUrl: Boolean(env.DATABASE_URL),
      hasShopifyApiKey: Boolean(env.SHOPIFY_API_KEY),
      hasShopifyApiSecret: Boolean(env.SHOPIFY_API_SECRET),
      hasShopifyAppUrl: Boolean(env.SHOPIFY_APP_URL),
      appUrlMatchesRequestOrigin: env.SHOPIFY_APP_URL === url.origin,
      idTokenPresent: Boolean(url.searchParams.get("id_token")),
      idTokenDecoded: Boolean(idTokenPayload),
      idTokenAudienceMatchesApiKey: audienceMatchesApiKey,
      idTokenDestinationMatchesShop:
        idTokenPayload?.dest === `https://${shop}`,
      errorKind:
        error instanceof Response
          ? "Response"
          : error instanceof Error
            ? "Error"
            : typeof error,
      responseStatus: error instanceof Response ? error.status : undefined,
      responseStatusText:
        error instanceof Response ? error.statusText : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : undefined,
      ...sessionDiagnostic,
    };

    console.error(
      `[vsn-staging-diagnostic] ${JSON.stringify(diagnostic)}`,
    );
    throw error;
  }

  return { apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const location = useLocation();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href={`/app${location.search}`}>Options</s-link>
        <s-link href={`/app/packages${location.search}`}>Packages</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
