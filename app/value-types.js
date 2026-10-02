// Shared input codec. Shopify remains authoritative for definition validations.
export const REFERENCE_TYPES = {
  product_reference: ["Product"],
  variant_reference: ["ProductVariant"],
  collection_reference: ["Collection"],
  page_reference: ["Page"],
  article_reference: ["Article"],
  file_reference: ["MediaImage", "GenericFile", "Video"],
  metaobject_reference: ["Metaobject"],
  mixed_reference: ["Metaobject"],
};
export const SCALAR_TYPES = [
  "single_line_text_field",
  "multi_line_text_field",
  "number_integer",
  "number_decimal",
  "boolean",
  "date",
  "date_time",
  "url",
  "color",
  "json",
  "rich_text_field",
  "dimension",
  "volume",
  "weight",
  "rating",
  "money",
  "link",
  ...Object.keys(REFERENCE_TYPES),
];
export function editableValueType(type) {
  return (
    SCALAR_TYPES.includes(type?.replace(/^list\./, "")) &&
    !(
      type?.startsWith("list.") &&
      ["json", "rich_text_field", "money", "link"].includes(type.slice(5))
    )
  );
}
export function valueInputHint(type) {
  if (type.startsWith("list."))
    return 'JSON array, for example ["cotton", "linen"]';
  if (REFERENCE_TYPES[type])
    return "Choose a reference or enter a Shopify resource ID.";
  return (
    {
      json: '{"key":"value"}',
      rich_text_field:
        '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Text"}]}]}',
      dimension: '{"value":10,"unit":"centimeters"}',
      volume: '{"value":1,"unit":"liters"}',
      weight: '{"value":1,"unit":"kilograms"}',
      rating: '{"value":"4","scale_min":"1","scale_max":"5"}',
      money: '{"amount":"10.00","currency_code":"USD"}',
      link: '{"text":"Learn more","url":"https://example.com"}',
      date: "YYYY-MM-DD",
      date_time: "ISO timestamp including timezone",
      color: "#RRGGBB",
    }[type] || "Enter a value."
  );
}
function json(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new RangeError("Enter valid JSON.");
  }
}
function object(value) {
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new RangeError("Enter a JSON object.");
  return value;
}
function https(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new RangeError("Enter a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new RangeError("Enter a valid HTTPS URL without credentials.");
  return String(value);
}
function finite(value) {
  if (
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(String(value)) ||
    !Number.isFinite(Number(value))
  )
    throw new RangeError("Enter a finite decimal number.");
  return Number(value);
}
function rich(node, depth = 0) {
  if (depth > 12) throw new RangeError("Rich text nesting is too deep.");
  object(node);
  if (node.type === "text") {
    if (typeof node.value !== "string")
      throw new RangeError("Rich text text nodes require a value.");
    return;
  }
  if (
    !["root", "paragraph", "heading", "list", "list-item", "link"].includes(
      node.type,
    ) ||
    !Array.isArray(node.children) ||
    node.children.length > 250
  )
    throw new RangeError("Unsupported rich text node.");
  if (node.type === "link") https(node.url);
  if (node.type === "heading" && ![1, 2, 3, 4, 5, 6].includes(node.level))
    throw new RangeError("Invalid heading level.");
  if (node.type === "list" && !["ordered", "unordered"].includes(node.listType))
    throw new RangeError("Invalid list type.");
  for (const child of node.children) rich(child, depth + 1);
}
function scalar(type, input) {
  const value = typeof input === "string" ? input : String(input);
  if (REFERENCE_TYPES[type]) {
    if (
      !REFERENCE_TYPES[type].some((name) =>
        new RegExp(`^gid://shopify/${name}/[0-9]+$`).test(value),
      )
    )
      throw new RangeError("Reference ID does not match the field type.");
    return value;
  }
  if (type === "boolean") {
    if (!["true", "false"].includes(value))
      throw new RangeError("Choose true or false.");
    return value;
  }
  if (type === "number_integer") {
    if (
      !/^-?(0|[1-9][0-9]*)$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    )
      throw new RangeError("Enter a whole number within the supported range.");
    return value;
  }
  if (type === "number_decimal") {
    finite(value);
    return value;
  }
  if (type === "date") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new RangeError("Enter a valid date as YYYY-MM-DD.");
    return value;
  }
  if (type === "date_time") {
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new RangeError("Enter a valid timestamp including timezone.");
    scalar("date", value.slice(0, 10));
    return value;
  }
  if (type === "url") return https(value);
  if (type === "color") {
    if (!/^#[a-fA-F0-9]{6}$/.test(value))
      throw new RangeError("Enter a color as #RRGGBB.");
    return value;
  }
  if (["single_line_text_field", "multi_line_text_field"].includes(type)) {
    if (
      typeof input !== "string" ||
      !value ||
      (type === "single_line_text_field" && /[\r\n]/.test(value))
    )
      throw new RangeError("Enter valid text for this field.");
    return value;
  }
  const parsed = typeof input === "string" ? json(input) : input;
  if (type === "json") return JSON.stringify(parsed);
  object(parsed);
  if (["dimension", "volume", "weight"].includes(type)) {
    const units = {
      dimension: [
        "in",
        "ft",
        "yd",
        "mm",
        "cm",
        "m",
        "inches",
        "feet",
        "yards",
        "millimeters",
        "centimeters",
        "meters",
      ],
      volume: [
        "ml",
        "cl",
        "l",
        "m3",
        "us_fl_oz",
        "us_pt",
        "us_qt",
        "us_gal",
        "imp_fl_oz",
        "imp_pt",
        "imp_qt",
        "imp_gal",
        "milliliters",
        "centiliters",
        "liters",
        "cubic_meters",
        "us_fluid_ounces",
        "us_pints",
        "us_quarts",
        "us_gallons",
        "imperial_fluid_ounces",
        "imperial_pints",
        "imperial_quarts",
        "imperial_gallons",
      ],
      weight: ["g", "kg", "oz", "lb", "grams", "kilograms", "ounces", "pounds"],
    };
    if (finite(parsed.value) < 0 || !units[type].includes(parsed.unit))
      throw new RangeError("Invalid measurement value or unit.");
  } else if (type === "rating") {
    const min = finite(parsed.scale_min),
      max = finite(parsed.scale_max),
      score = finite(parsed.value);
    if (min >= max || score < min || score > max)
      throw new RangeError("Rating must be within its scale.");
  } else if (type === "money") {
    finite(parsed.amount);
    if (!/^[A-Z]{3}$/.test(parsed.currency_code))
      throw new RangeError("Enter an ISO currency code.");
  } else if (type === "link") {
    if (typeof parsed.text !== "string" || !parsed.text)
      throw new RangeError("Link label is required.");
    https(parsed.url);
  } else if (type === "rich_text_field") {
    if (parsed.type !== "root")
      throw new RangeError("Rich text requires a root node.");
    rich(parsed);
  }
  return JSON.stringify(parsed);
}
export function encodeValue(type, raw, validations = []) {
  if (!editableValueType(type))
    throw new RangeError(
      "This definition requires Shopify’s native value editor.",
    );
  if (
    typeof raw !== "string" ||
    !raw ||
    new TextEncoder().encode(raw).length > 64000
  )
    throw new RangeError("Enter a value under 64,000 bytes.");
  let result;
  if (type.startsWith("list.")) {
    const list = json(raw);
    if (!Array.isArray(list) || list.length > 128)
      throw new RangeError("Enter a JSON array containing at most 128 items.");
    const base = type.slice(5);
    result = JSON.stringify(
      list.map((item) => {
        const encoded = scalar(base, item);
        return ["dimension", "volume", "weight", "rating"].includes(base)
          ? json(encoded)
          : encoded;
      }),
    );
  } else result = scalar(type, raw);
  for (const rule of validations) {
    if (["min", "max"].includes(rule.name) && type.startsWith("number_")) {
      const n = Number(result),
        boundary = Number(rule.value);
      if (
        (rule.name === "min" && n < boundary) ||
        (rule.name === "max" && n > boundary)
      )
        throw new RangeError(`Value violates ${rule.name} ${rule.value}.`);
    }
    if (
      ["min", "max"].includes(rule.name) &&
      !type.startsWith("list.") &&
      type.includes("text_field")
    ) {
      const length = [...result].length;
      if (
        (rule.name === "min" && length < Number(rule.value)) ||
        (rule.name === "max" && length > Number(rule.value))
      )
        throw new RangeError(
          `Text violates ${rule.name} length ${rule.value}.`,
        );
    }
    if (
      ["list.min", "list.max"].includes(rule.name) &&
      type.startsWith("list.")
    ) {
      const length = json(result).length;
      if (
        (rule.name === "list.min" && length < Number(rule.value)) ||
        (rule.name === "list.max" && length > Number(rule.value))
      )
        throw new RangeError(`List violates ${rule.name} ${rule.value}.`);
    }
  }
  return result;
}
