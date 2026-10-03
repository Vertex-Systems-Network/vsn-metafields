export function definitionKey(name) {
  const key = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
    .replace(/_+$/g, "");
  return key.length === 1 ? `${key}_field` : key;
}

export function resourceLabel(owner) {
  const labels = {
    PRODUCTVARIANT: "Product variant",
    DRAFTORDER: "Draft order",
    CARTTRANSFORM: "Cart transform",
    MEDIA_IMAGE: "Media image (deprecated)",
  };
  return (
    labels[owner] ||
    String(owner)
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

const PRESENTATION = {
  single_line_text_field: ["Single line text", "Text", "text"],
  multi_line_text_field: ["Multi-line text", "Text", "lines"],
  rich_text_field: ["Rich text", "Text", "lines"],
  number_integer: ["Integer", "Number", "number"],
  number_decimal: ["Decimal", "Number", "number"],
  boolean: ["True or false", "Other", "toggle"],
  date: ["Date", "Date and time", "calendar"],
  date_time: ["Date and time", "Date and time", "calendar"],
  file_reference: ["File", "Reference", "file"],
  metaobject_reference: ["Metaobject", "Reference", "reference"],
  mixed_reference: ["Mixed reference", "Reference", "reference"],
  product_reference: ["Product", "Reference", "reference"],
  variant_reference: ["Product variant", "Reference", "reference"],
  collection_reference: ["Collection", "Reference", "reference"],
  page_reference: ["Page", "Reference", "file"],
  url: ["URL", "Link", "link"],
  link: ["Link", "Link", "link"],
  color: ["Color", "Other", "color"],
  json: ["JSON", "Other", "code"],
  dimension: ["Dimension", "Measurement", "measure"],
  weight: ["Weight", "Measurement", "measure"],
  volume: ["Volume", "Measurement", "measure"],
  money: ["Money", "Number", "number"],
  rating: ["Rating", "Number", "number"],
};

export function fieldTypeOption(item) {
  const list = item.name.startsWith("list.");
  const base = item.name.replace(/^list\./, "");
  const [label, group, icon] = PRESENTATION[base] || [
    base.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
    item.category || "Other",
    "field",
  ];
  return {
    value: item.name,
    label,
    group,
    icon,
    badge: list ? "List" : "One",
    keywords: item.name,
  };
}

export function filterDefinitions(
  fields,
  { search = "", type = "", access = "" },
) {
  const query = search.trim().toLowerCase();
  return fields.filter(
    (field) =>
      (!type || field.type === type) &&
      (!access || field.storefront === access) &&
      `${field.name} ${field.namespace}.${field.key}`
        .toLowerCase()
        .includes(query),
  );
}

export function mergeTemplatePage(previous, page) {
  return {
    ownerType: page.ownerType,
    templates:
      !page.cursor || previous.ownerType !== page.ownerType
        ? page.templates
        : [
            ...new Map(
              [...previous.templates, ...page.templates].map((item) => [
                item.id,
                item,
              ]),
            ).values(),
          ],
    pageInfo: page.pageInfo,
  };
}
