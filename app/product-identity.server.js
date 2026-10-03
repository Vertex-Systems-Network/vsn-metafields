import process from "node:process";
import { appDisplayName } from "./product-config.js";

export function requestAppName(context) {
  const env = context?.cloudflare?.env ?? process.env;
  return appDisplayName(env.APP_ENV || env.NODE_ENV);
}
