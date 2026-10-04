import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { graph } from "../definitions.server";
import { featureJson, featureError } from "../feature-request.server";
import { REFERENCE_TYPES } from "../value-types";
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    if (!(await hasActivePlan(admin)))
      return featureJson(
        { ok: false, error: "An active plan is required." },
        403,
      );
    const params = new URL(request.url).searchParams,
      type = params.get("type");
    const search = String(params.get("search") || "").trim();
    if (search.length > 120)
      throw new RangeError("Keep the Shopify search query within 120 characters.");
    const query = search || null;
    const operations = {
      product_reference: `#graphql
        query ReferenceProducts($query:String) { products(first:20,query:$query) { nodes { id title } } }`,
      variant_reference: `#graphql
        query ReferenceVariants($query:String) { productVariants(first:20,query:$query) { nodes { id title product { title } } } }`,
      collection_reference: `#graphql
        query ReferenceCollections($query:String) { collections(first:20,query:$query) { nodes { id title } } }`,
      page_reference: `#graphql
        query ReferencePages($query:String) { pages(first:20,query:$query) { nodes { id title } } }`,
      article_reference: `#graphql
        query ReferenceArticles($query:String) { articles(first:20,query:$query) { nodes { id title } } }`,
      file_reference: `#graphql
        query ReferenceFiles($query:String) { files(first:20,query:$query) { nodes { id alt } } }`,
    };
    let data, nodes;
    if (["metaobject_reference", "mixed_reference"].includes(type)) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(search))
        throw new RangeError(
          "Enter a metaobject definition type to search its entries.",
        );
      data = await graph(
        admin,
        `#graphql
        query ReferenceMetaobjects($type:String!) { metaobjects(first:20,type:$type) { nodes { id displayName handle } } }`,
        { type: search },
      );
      nodes = data.metaobjects?.nodes;
    } else {
      if (!operations[type])
        throw new RangeError("Unsupported reference type.");
      data = await graph(admin, operations[type], { query });
      nodes =
        data[
          {
            product_reference: "products",
            variant_reference: "productVariants",
            collection_reference: "collections",
            page_reference: "pages",
            article_reference: "articles",
            file_reference: "files",
          }[type]
        ]?.nodes;
    }
    if (!Array.isArray(nodes)) throw new Error("References unavailable.");
    // Shopify Files can include ExternalVideo, which file_reference cannot save.
    const supported = type === "file_reference"
      ? nodes.filter((node) =>
          typeof node.id === "string" &&
          REFERENCE_TYPES.file_reference.some((owner) =>
            node.id.startsWith(`gid://shopify/${owner}/`),
          ),
        )
      : nodes;
    return featureJson({
      ok: true,
      type,
      references: supported.map((n) => ({
        id: n.id,
        title: n.product
          ? `${n.product.title} / ${n.title}`
          : n.title || n.displayName || n.handle || n.alt || n.id,
      })),
    });
  } catch (error) {
    return featureError(error);
  }
};
