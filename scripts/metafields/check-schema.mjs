import { loadDocuments } from "@graphql-tools/load";
import { CodeFileLoader } from "@graphql-tools/code-file-loader";
import { pluckConfig } from "@shopify/graphql-codegen";
import { readFileSync } from "node:fs";
import { buildClientSchema, validate } from "graphql";
import { pathToFileURL } from "node:url";
import {
  METAFIELD_API_VERSION,
  OWNER_TYPES,
} from "../../app/metafield-capabilities.js";
export async function verifyShopifySchema(introspection) {
  const schema = buildClientSchema(introspection.data || introspection);
  const owners = schema
    .getType("MetafieldOwnerType")
    .getValues()
    .map((value) => value.name);
  if (
    JSON.stringify([...owners].sort()) !==
    JSON.stringify([...OWNER_TYPES].sort())
  )
    throw new Error("Pinned owner inventory differs from Shopify schema.");
  const docs = await loadDocuments(
    ["app/**/*.{js,jsx}", "scripts/metafields/staging-probe.mjs"],
    { loaders: [new CodeFileLoader()], noRequire: true, pluckConfig },
  );
  const failures = [];
  for (const document of docs) {
    const errors = validate(schema, document.document);
    if (errors.length)
      failures.push(`${document.location}: ${errors.map((error) => error.message).join("; ")}`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  return {
    apiVersion: METAFIELD_API_VERSION,
    documents: docs.length,
    ownerInventory: true,
  };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.SHOPIFY_SCHEMA_FILE)
    throw new Error(
      "Provide SHOPIFY_SCHEMA_FILE from authenticated pinned staging introspection. Public schema proxy is unavailable.",
    );
  console.log(
    JSON.stringify(
      await verifyShopifySchema(
        JSON.parse(readFileSync(process.env.SHOPIFY_SCHEMA_FILE, "utf8")),
      ),
    ),
  );
}
