import { graph } from "./definitions.server.js";
import { METAFIELD_API_VERSION } from "./metafield-capabilities.js";
export const FEATURE_SCOPES = {
  values: ["read_products", "write_products"],
  metaobjects: [
    "read_metaobjects",
    "write_metaobjects",
    "read_metaobject_definitions",
    "write_metaobject_definitions",
  ],
  pageReferences: ["read_content"],
  fileReferences: ["read_files"],
};
export async function featureDiagnostics(
  admin,
  hasPlan,
  { database = "unknown", environment = "unknown" } = {},
) {
  const data = await graph(
    admin,
    `#graphql
    query FeatureDiagnostics { currentAppInstallation { accessScopes { handle } } shop { primaryDomain { url } } }`,
  );
  const granted = (data.currentAppInstallation?.accessScopes || [])
    .map((s) => s.handle)
    .sort();
  const implied = new Set(granted);
  for (const scope of granted)
    if (scope.startsWith("write_"))
      implied.add(scope.replace(/^write_/, "read_"));
  return {
    apiVersion: METAFIELD_API_VERSION,
    environment,
    database,
    hasActivePlan: hasPlan,
    grantedScopes: granted,
    features: Object.fromEntries(
      Object.entries(FEATURE_SCOPES).map(([name, required]) => [
        name,
        {
          required,
          missing: required.filter((s) => !implied.has(s)),
          ready: hasPlan && required.every((s) => implied.has(s)),
        },
      ]),
    ),
    storefrontUrl: data.shop?.primaryDomain?.url || null,
    steps: [
      { id: "plan", label: "Activate the existing app plan", done: hasPlan },
      {
        id: "scopes",
        label: "Confirm product and metaobject permissions",
        done: [...FEATURE_SCOPES.values, ...FEATURE_SCOPES.metaobjects].every(
          (s) => implied.has(s),
        ),
      },
      { id: "definition", label: "Create or enable a definition", done: false },
      {
        id: "value",
        label: "Choose a resource and save a typed value",
        done: false,
      },
      {
        id: "theme",
        label: "Add an app block in a compatible theme",
        done: false,
      },
      {
        id: "verify",
        label: "Preview desktop/mobile and variant changes",
        done: false,
      },
    ],
  };
}
