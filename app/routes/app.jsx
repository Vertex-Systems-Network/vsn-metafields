import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";

  try {
    await authenticate.admin(request);
  } catch (error) {
    const diagnostic = {
      event: "shopify-admin-auth-failed",
      route: "/app",
      shop,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasShopifyApiKey: Boolean(process.env.SHOPIFY_API_KEY),
      hasShopifyApiSecret: Boolean(process.env.SHOPIFY_API_SECRET),
      hasShopifyAppUrl: Boolean(process.env.SHOPIFY_APP_URL),
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : "non-error thrown",
      errorCause:
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : undefined,
    };

    console.error("[vsn-staging-diagnostic]", diagnostic);
    throw error;
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Options</s-link>
        <s-link href="/app/packages">Packages</s-link>
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
