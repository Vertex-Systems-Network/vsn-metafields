import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { createPrismaClient } from "../db.server";
import { Workspace } from "../components/Workspace";
import { APP_NAME } from "../product-config";
import { requestAppName } from "../product-identity.server";
import "../styles/workspace.css";

export const meta = ({ data }) => [{ title: data?.appName || APP_NAME }];

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

export const loader = async ({ request, context }) => {
  // eslint-disable-next-line no-undef
  const env = process.env;
  const runtimeEnv = context?.cloudflare?.env ?? env;
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";

  try {
    await authenticate.admin(request);
  } catch (error) {
    // Embedded client-side transitions renew Shopify auth with a redirect.
    // Keep this expected control flow out of application error diagnostics.
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      console.info(
        "[vsn-auth-redirect]",
        JSON.stringify({
          route: url.pathname,
          status: error.status,
          idTokenPresent: Boolean(url.searchParams.get("id_token")),
        }),
      );
      throw error;
    }
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
      idTokenDestinationMatchesShop: idTokenPayload?.dest === `https://${shop}`,
      errorKind:
        error instanceof Response
          ? "Response"
          : error instanceof Error
            ? "Error"
            : typeof error,
      responseStatus: error instanceof Response ? error.status : undefined,
      ...sessionDiagnostic,
    };

    console.error(`[vsn-staging-diagnostic] ${JSON.stringify(diagnostic)}`);
    throw error;
  }

  return {
    apiKey: env.SHOPIFY_API_KEY || "",
    appName: requestAppName(context),
    environment: runtimeEnv.APP_ENV || runtimeEnv.NODE_ENV || "development",
  };
};

export default function App() {
  const { apiKey, appName, environment } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Fields & values
        </Link>
      </NavMenu>
      <Workspace appName={appName} environment={environment}>
        <Outlet />
      </Workspace>
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
