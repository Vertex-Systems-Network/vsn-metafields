export const APP_NAME = "VSN | Metafields";
export const APP_VERSION = "1.2.4";

export function appDisplayName(environment) {
  const label = environment === "staging" ? "Staging"
    : ["local", "development", "test"].includes(environment) ? "Dev" : "";
  return label ? `${APP_NAME} (${label})` : APP_NAME;
}
