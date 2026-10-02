import { getIntrospectionQuery } from "graphql";
import { verifyShopifySchema } from "./check-schema.mjs";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  OWNER_TYPES,
  METAFIELD_API_VERSION,
} from "../../app/metafield-capabilities.js";
import {
  graph,
  getCapabilities,
  getDefinitions,
  createDefinition,
  updateDefinition,
} from "../../app/definitions.server.js";
import {
  getStandardTemplates,
  enableStandardTemplate,
} from "../../app/standard-definitions.server.js";
import { removeDefinition } from "../../app/definition-removal.server.js";
import { mutateValue } from "../../app/metafield-values.server.js";
import { verifyAdvancedBatch } from "./advanced-probe.mjs";
const { DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_APP_URL, STAGING_SHOP } =
  process.env;
const host = DATABASE_URL ? new URL(DATABASE_URL).hostname : "";
const productionKey = readFileSync("shopify.app.toml", "utf8").match(
  /client_id\s*=\s*"([^"]+)"/,
)[1];
if (
  SHOPIFY_APP_URL !==
    "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev" ||
  SHOPIFY_API_KEY === productionKey ||
  !SHOPIFY_API_KEY ||
  !/^ep-snowy-surf-b3gxl2wf-pooler\.[\w.-]+\.neon\.tech$/.test(host) ||
  !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(STAGING_SHOP || "") ||
  STAGING_SHOP === "vertex-systems-network.myshopify.com"
)
  throw new Error("Isolated staging identity required.");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});
const definitions = [];
const values = [];
const resources = [];
const report = {
  apiVersion: METAFIELD_API_VERSION,
  ok: false,
  sourceSha: process.env.GITHUB_SHA || null,
  readableOwners: [],
  unavailableOwners: [],
  lifecycleOwners: [],
  standardEnable: false,
  valuesRetainedAfterDefinitionRemoval: false,
  cleanup: false,
};
let admin;
const must = (result, label) => {
  if (!result?.ok)
    throw new Error(`${label}: ${result?.error || "Unconfirmed result"}`);
  return result;
};
async function mutation(query, variables, payload) {
  const data = await graph(admin, query, variables);
  if (data[payload]?.userErrors?.length)
    throw new Error(`${payload}: ${data[payload].userErrors[0].message}`);
  return data[payload];
}
async function readValue(ownerId, namespace, key) {
  const data = await graph(
    admin,
    `#graphql
query ProbeValue($id: ID!, $namespace: String!, $key: String!) { node(id:$id) { ... on Product { metafield(namespace:$namespace,key:$key){value} } ... on ProductVariant { metafield(namespace:$namespace,key:$key){value} } ... on Collection { metafield(namespace:$namespace,key:$key){value} } } }`,
    { id: ownerId, namespace, key },
  );
  return data.node?.metafield?.value;
}
try {
  const session = await prisma.session.findFirst({
    where: { shop: STAGING_SHOP, isOnline: false },
  });
  if (!session?.accessToken)
    throw new Error("Staging offline session unavailable.");
  admin = {
    graphql: async (query, { variables } = {}) => {
      const response = await fetch(
        `https://${STAGING_SHOP}/admin/api/${METAFIELD_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken,
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
      return response;
    },
  };
  const identity = await graph(
    admin,
    `#graphql
query { currentAppInstallation { app { apiKey } } }`,
  );
  if (identity.currentAppInstallation?.app?.apiKey !== SHOPIFY_API_KEY)
    throw new Error("Offline session belongs to a different app.");
  report.schema = await verifyShopifySchema(
    await graph(
      admin,
      getIntrospectionQuery({
        descriptions: false,
        inputValueDeprecation: true,
      }),
    ),
  );
  const capabilities = await getCapabilities(admin, "PRODUCT");
  report.typeCount = capabilities.types.length;
  report.grantedScopes = capabilities.scopes;
  for (const owner of OWNER_TYPES.filter((owner) => owner !== "MEDIA_IMAGE")) {
    try {
      await getDefinitions(admin, owner);
      report.readableOwners.push(owner);
    } catch {
      report.unavailableOwners.push(owner);
    }
  }
  const nonce = `${Date.now()}_${randomBytes(3).toString("hex")}`;
  const productResult = await mutation(
    `#graphql
mutation ProbeProduct($product:ProductCreateInput!){ productCreate(product:$product){ product {id variants(first:1){nodes{id}}} userErrors {message} } }`,
    {
      product: {
        title: `VSN disposable batch probe ${nonce}`,
        status: "DRAFT",
      },
    },
    "productCreate",
  );
  const product = productResult?.product;
  if (!product?.id) throw new Error("Product fixture unconfirmed.");
  resources.push({ kind: "product", id: product.id });
  const variantId = product.variants?.nodes?.[0]?.id;
  if (!variantId) throw new Error("Variant fixture unavailable.");
  const collectionResult = await mutation(
    `#graphql
mutation ProbeCollection($collection:CollectionCreateInput!){ collectionCreate(collection:$collection){collection{id} userErrors{message}}}`,
    { collection: { title: `VSN disposable batch probe ${nonce}` } },
    "collectionCreate",
  );
  const collection = collectionResult?.collection;
  if (!collection?.id) throw new Error("Collection fixture unconfirmed.");
  resources.push({ kind: "collection", id: collection.id });
  for (const [owner, ownerId] of [
    ["PRODUCT", product.id],
    ["PRODUCTVARIANT", variantId],
    ["COLLECTION", collection.id],
  ]) {
    const field = must(
      await createDefinition(admin, owner, {
        name: "Disposable batch probe",
        namespace: "vsn_probe",
        key: `batch_${nonce}`,
        type: "single_line_text_field",
        storefront: "NONE",
      }),
      "Create",
    ).definition;
    definitions.push(field);
    const listed = (await getDefinitions(admin, owner)).find(
      (item) => item.id === field.id,
    );
    if (!listed) throw new Error("Created definition absent from owner read.");
    must(
      await updateDefinition(admin, owner, [listed], {
        id: field.id,
        key: field.key,
        namespace: field.namespace,
        name: "Disposable probe renamed",
        storefront: "NONE",
      }),
      "Update",
    );
    const definition = {
      namespace: field.namespace,
      key: field.key,
      type: "single_line_text_field",
    };
    values.push({ ownerId, definition });
    must(
      await mutateValue(admin, {
        action: "set",
        ownerId,
        definition,
        value: "VSN probe sentinel",
      }),
      "Value set",
    );
    if (
      (await readValue(ownerId, field.namespace, field.key)) !==
      "VSN probe sentinel"
    )
      throw new Error("Value round trip mismatch.");
    must(await removeDefinition(admin, [field], field), "Remove definition");
    definitions.splice(definitions.indexOf(field), 1);
    if (
      (await readValue(ownerId, field.namespace, field.key)) !==
      "VSN probe sentinel"
    )
      throw new Error("Value not retained after definition removal.");
    report.lifecycleOwners.push(owner);
  }
  report.valuesRetainedAfterDefinitionRemoval = true;
  const existing = new Set(
    (await getDefinitions(admin, "PRODUCT")).map(
      (field) => `${field.namespace}.${field.key}`,
    ),
  );
  const templates = await getStandardTemplates(admin, "PRODUCT");
  report.standardTemplateCount = templates.length;
  const selected = templates.find(
    (template) => !existing.has(`${template.namespace}.${template.key}`),
  );
  if (selected) {
    const field = must(
      await enableStandardTemplate(admin, templates, "PRODUCT", selected.id),
      "Standard enable",
    ).definition;
    definitions.push(field);
    must(await removeDefinition(admin, [field], field), "Standard remove");
    definitions.splice(definitions.indexOf(field), 1);
    report.standardEnable = true;
  } else
    throw new Error(
      "No uninstalled product standard template available for enable probe.",
    );
  report.advanced = await verifyAdvancedBatch(admin,prisma,STAGING_SHOP,product,variantId,collection,nonce,capabilities.types);
  report.ok = true;
} finally {
  const failures = [];
  for (const value of values)
    try {
      must(
        await mutateValue(admin, { action: "delete", ...value }),
        "Cleanup value",
      );
    } catch {
      failures.push("value");
    }
  for (const field of definitions)
    try {
      must(await removeDefinition(admin, [field], field), "Cleanup definition");
    } catch {
      failures.push("definition");
    }
  for (const resource of resources.reverse())
    try {
      if (resource.kind === "product") {
        const result = await mutation(
          `#graphql
mutation CleanupProduct($input:ProductDeleteInput!){productDelete(input:$input){deletedProductId userErrors{message}}}`,
          { input: { id: resource.id } },
          "productDelete",
        );
        if (result?.deletedProductId !== resource.id)
          throw new Error("Cleanup identity mismatch.");
      } else {
        const result = await mutation(
          `#graphql
mutation CleanupCollection($input:CollectionDeleteInput!){collectionDelete(input:$input){deletedCollectionId userErrors{message}}}`,
          { input: { id: resource.id } },
          "collectionDelete",
        );
        if (result?.deletedCollectionId !== resource.id)
          throw new Error("Cleanup identity mismatch.");
      }
    } catch {
      failures.push(resource.kind);
    }
  await prisma.$disconnect();
  report.cleanup = failures.length === 0;
  if (failures.length) report.ok = false;
  report.cleanupFailures = failures;
  console.log(JSON.stringify(report));
  if (failures.length)
    throw new Error(`Staging fixture cleanup failed: ${failures.join(", ")}`);
}
