import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Liquid } from "liquidjs";
const root = "extensions/vsn-storefront";
const engine = new Liquid({
  root: `${root}/snippets`,
  extname: ".liquid",
  strictFilters: true,
});
// Shopify-only filters must run in Shopify; scalar fixtures never invoke them.
for (const name of ["metafield_tag", "image_url", "image_tag"])
  engine.registerFilter(name, () => {
    throw new Error(`${name} requires Shopify runtime verification`);
  });
const settings = {
  true_text: "Yes",
  false_text: "No",
  list_style: "plain",
  date_format: "%Y-%m-%d",
  link_text: "View",
  new_tab: true,
};
const value = (type, data) =>
  engine.renderFile("vsn-field-value", {
    field: { type, value: data },
    settings,
  });
const blocks = ["vsn-single-field", "vsn-specifications"];
const schema = (name) =>
  JSON.parse(
    readFileSync(`${root}/blocks/${name}.liquid`, "utf8").match(
      /{% schema %}([\s\S]*?){% endschema %}/,
    )[1],
  );
async function renderBlock(name, overrides = {}, context = {}) {
  const defaults = Object.fromEntries(
    schema(name)
      .settings.filter((s) => s.id)
      .map((s) => [s.id, s.default]),
  );
  const source = readFileSync(`${root}/blocks/${name}.liquid`, "utf8").replace(
    /{% schema %}[\s\S]*?{% endschema %}/,
    "",
  );
  return engine.parseAndRender(source, {
    block: { id: "test-1", settings: { ...defaults, ...overrides } },
    section: { id: "product-section" },
    request: { page_type: "product", design_mode: false },
    ...context,
  });
}
test("both block schemas have unique settings and bounded valid range defaults", () => {
  for (const name of blocks) {
    const s = schema(name);
    assert.equal(s.target, "section");
    assert.equal(s.javascript, "vsn-metafields.js");
    const ids = s.settings.filter((x) => x.id).map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const x of s.settings.filter((x) => x.type === "range")) {
      assert.ok(x.default >= x.min && x.default <= x.max);
      assert.equal((x.default - x.min) % x.step, 0);
      assert.ok((x.max - x.min) / x.step <= 100);
    }
  }
});
test("text escapes HTML while multiline preserves line breaks", async () => {
  assert.equal(
    (await value("single_line_text_field", "<script>alert(1)</script>")).trim(),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  assert.match(
    await value("multi_line_text_field", "a\nb"),
    /vsn-multiline.*a\nb/,
  );
});
test("false and zero render; unsupported lists and structured JSON produce no wrapper", async () => {
  assert.equal((await value("boolean", false)).trim(), "No");
  assert.equal((await value("number_integer", 0)).trim(), "0");
  assert.equal(
    (await value("list.metaobject_reference", [{ secret: "x" }])).trim(),
    "",
  );
  assert.equal((await value("json", { secret: "x" })).trim(), "");
});
test("lists preserve safe item ordering and references escape their caption", async () => {
  const list = await value("list.single_line_text_field", [
    "first",
    "<second>",
  ]);
  assert.match(list, /<li>first<\/li><li>&lt;second&gt;<\/li>/);
  assert.match(
    await value("product_reference", {
      title: "<Product>",
      url: "/products/test",
    }),
    /&lt;Product&gt;/,
  );
});
test("links reject javascript/protocol relative URLs and protect new tabs", async () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.example",
    "http://insecure.example",
  ])
    assert.equal((await value("url", url)).trim(), "");
  const link = await value("url", 'https://example.com/?q="hello"');
  assert.match(link, /rel="noopener noreferrer"/);
  assert.match(link, /(?:&quot;|&#34;)hello(?:&quot;|&#34;)/);
});
test("single block resolves selected variant without leaking another product", async () => {
  const product = {
    id: 1,
    metafields: {
      custom: {
        care: { type: "single_line_text_field", value: "Product value" },
      },
    },
    selected_or_first_available_variant: {
      id: 20,
      metafields: {
        custom: {
          care: { type: "single_line_text_field", value: "Variant value" },
        },
      },
    },
  };
  const result = await renderBlock(
    "vsn-single-field",
    { source: "variant", namespace: "custom", field_key: "care" },
    { product },
  );
  assert.match(result, /Variant value/);
  assert.doesNotMatch(result, /Product value/);
  assert.match(result, /data-vsn-track="true"/);
});
test("empty block hides and fallback/editor guidance is explicit", async () => {
  assert.equal(
    (
      await renderBlock(
        "vsn-single-field",
        { source: "product", field_key: "missing" },
        { product: { id: 1, metafields: {} } },
      )
    ).trim(),
    "",
  );
  assert.match(
    await renderBlock("vsn-single-field", {
      source: "product",
      field_key: "missing",
      fallback: "Nothing yet",
    }),
    /Nothing yet/,
  );
});
test("specifications preserve configured order and hide empty fields", async () => {
  const product = {
    id: 1,
    metafields: {
      custom: {
        one: { type: "number_integer", value: 0 },
        two: { type: "boolean", value: false },
      },
    },
  };
  const output = await renderBlock(
    "vsn-specifications",
    {
      source: "product",
      namespace: "custom",
      key_1: "two",
      label_1: "Second",
      key_2: "custom.one",
      label_2: "First",
      key_3: "missing",
      hide_empty: true,
    },
    { product },
  );
  assert.ok(output.indexOf("Second") < output.indexOf("First"));
  assert.match(output, />No</);
  assert.match(output, />0</);
  assert.doesNotMatch(output, /<dt>missing/);
});
