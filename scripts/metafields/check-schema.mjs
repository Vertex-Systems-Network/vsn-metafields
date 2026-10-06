import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildClientSchema, parse, validate } from "graphql";
import { pathToFileURL } from "node:url";
import {
  METAFIELD_API_VERSION,
  OWNER_TYPES,
} from "../../app/metafield-capabilities.js";

function sourceFiles(directory, extensions, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, extensions, files);
    else if (extensions.some((extension) => entry.name.endsWith(extension)))
      files.push(path);
  }
  return files;
}

function graphqlDocuments(files) {
  const documents = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const matches = source.matchAll(/\x60\s*#graphql\b([\s\S]*?)\x60/g);
    for (const match of matches) {
      if (/\$\{/.test(match[1]))
        throw new Error(
          "Interpolated #graphql document requires explicit schema-check support: " +
            file,
        );
      documents.push({ location: file, document: parse(match[1]) });
    }
  }
  return documents;
}

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

  const files = [
    ...sourceFiles("app", [".js", ".jsx"]),
    ...sourceFiles("scripts/metafields", [".mjs"]).filter((file) =>
      file.endsWith("probe.mjs"),
    ),
  ];
  const docs = graphqlDocuments(files);
  const failures = [];
  for (const { location, document } of docs) {
    const errors = validate(schema, document);
    if (errors.length)
      failures.push(
        location + ": " + errors.map((error) => error.message).join("; "),
      );
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
