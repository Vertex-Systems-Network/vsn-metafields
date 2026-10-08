import process from "node:process";

function normalizeHost(value) {
  if (!value) return null;

  try {
    const url = value.includes("://")
      ? new URL(value)
      : new URL(`https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const localTunnelHost = [
  process.env.SHOPIFY_APP_URL,
  process.env.HOST,
]
  .map(normalizeHost)
  .find((hostname) => hostname?.endsWith(".trycloudflare.com"));

export default {
  allowedActionOrigins: localTunnelHost ? [localTunnelHost] : [],
  future: {
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
  },
};
