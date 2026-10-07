export const APP_NAME = "VSN | Metafields";
export const APP_VERSION = "1.2.4";

export function appDisplayName(environment) {
  const label = environment === "staging" ? "Staging"
    : ["local", "development", "test"].includes(environment) ? "Dev" : "";
  return label ? `${APP_NAME} (${label})` : APP_NAME;
}

export const LIVE_APP_VERSION = "1.1.0";

export function appEnvironmentTag(environment) {
  const normalized = String(environment || "").toLowerCase();
  if (["production", "prod", "live"].includes(normalized)) return "ver";
  if (normalized === "staging" || normalized === "stage") return "stag";
  return "dev";
}

export function appDisplayVersion(environment) {
  return appEnvironmentTag(environment) === "ver" ? LIVE_APP_VERSION : APP_VERSION;
}
