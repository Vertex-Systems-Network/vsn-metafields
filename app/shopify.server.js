import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const scopes = process.env.SCOPES
  ?.split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

const customShopDomain = process.env.SHOP_CUSTOM_DOMAIN
  ?.trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "")
  .replace(/\.$/, "");

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

const domainTransformations = customShopDomain
  ? [
      {
        match: new RegExp(
          "^([a-zA-Z0-9][a-zA-Z0-9-_]*)\\." +
            escapeRegExp(customShopDomain) +
            "$"
        ),
        transform: "$1." + customShopDomain,
      },
    ]
  : undefined;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes,
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  useOnlineTokens: true,
  hooks: {
    afterAuth: async ({ session }) => {
      await registerWebhooks({ session });
    },
  },
  ...(domainTransformations ? { domainTransformations } : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
