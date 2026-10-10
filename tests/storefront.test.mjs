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
blocks.push("vsn-reference-cards", "vsn-faq", "vsn-media");
engine.registerFilter("t", (key) => key);
engine.registerFilter("video_tag", () => {throw new Error("video_tag requires Shopify runtime verification");});
const schema = (name) =>
  JSON.parse(
    readFileSync(`${root}/blocks/${name}.liquid`, "utf8").match(
      /{% schema %}([\s\S]*?){% endschema %}/,
    )[1],
  );
async function renderBlock(name, overrides = {}, context = {}, omittedSettings = []) {
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
    block: {
      id: "test-1",
      settings: Object.fromEntries(
        Object.entries({ ...defaults, ...overrides }).filter(
          ([id]) => !omittedSettings.includes(id),
        ),
      ),
    },
    section: { id: "product-section" },
    request: { page_type: "product", design_mode: false },
    ...context,
  });
}
test("all five block schemas have unique settings and bounded valid range defaults", () => {
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
test("reference cards render only mapped supported public fields, escaping titles",async()=>{
  const metaobject={title:{type:"single_line_text_field",value:"<Title>"},description:{type:"multi_line_text_field",value:"Body"},link:{type:"url",value:"javascript:alert(1)"}};
  const product={id:1,metafields:{custom:{cards:{type:"list.metaobject_reference",value:[metaobject]}}}};
  const result=await renderBlock("vsn-reference-cards",{namespace:"custom",field_key:"cards"},{product});
  assert.match(result,/&lt;Title&gt;/);assert.match(result,/Body/);assert.doesNotMatch(result,/javascript|<Title>/);
  const hidden=await renderBlock("vsn-reference-cards",{namespace:"custom",field_key:"cards"},{product:{id:1,metafields:{custom:{cards:{type:"json",value:{secret:"x"}}}}}});
  assert.equal(hidden.trim(),"");
});
test("FAQ keeps semantic keyboard-operable disclosure and suppresses incomplete entries",async()=>{
  const product={id:1,metafields:{custom:{faq:{type:"list.metaobject_reference",value:[{question:{type:"single_line_text_field",value:"<Question>"},answer:{type:"multi_line_text_field",value:"Answer"}},{question:{type:"single_line_text_field",value:"Missing answer"}}]}}}};
  const result=await renderBlock("vsn-faq",{namespace:"custom",field_key:"faq",open_first:true},{product});
  assert.match(result,/<details[^>]*open/);assert.match(result,/<summary>&lt;Question&gt;<\/summary>/);assert.doesNotMatch(result,/Missing answer/);
});
test("specialized variant blocks retain empty refresh anchors and exclude arbitrary file URLs",async()=>{
  const product={id:1,selected_or_first_available_variant:{id:2,metafields:{}}};
  for(const block of ["vsn-reference-cards","vsn-faq","vsn-media"]){
    const result=await renderBlock(block,{source:"variant"},{product});
    assert.match(result,/data-vsn-source="variant"/);assert.match(result,/hidden/);
  }
  assert.equal((await renderBlock("vsn-media",{namespace:"custom",field_key:"media"},{product:{id:1,metafields:{custom:{media:{type:"url",value:"javascript:evil"}}}}})).trim(),"");
});
test("links reject javascript/protocol relative URLs and protect new tabs", async () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.example",
    "http://insecure.example",
    "/\\evil.example/path",
    "https://example.com\\@evil.example/path",
    "/\t/evil.example/path",
    "/\n/evil.example/path",
    "/\r/evil.example/path",
  ])
    assert.equal((await value("url", url)).trim(), "");
  const link = await value("url", 'https://example.com/?q="hello"');
  assert.match(link, /rel="noopener noreferrer"/);
  assert.match(link, /(?:&quot;|&#34;)hello(?:&quot;|&#34;)/);
});
test("safe links retain locale-relative paths and escape their captions", async () => {
  const output = await value("product_reference", { title: '<Product>', url: '/en/products/test?q="hello"' });
  assert.match(output, /href="\/en\/products\/test\?q=(?:&quot;|&#34;)hello/);
  assert.match(output, /&lt;Product&gt;/);
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
test("specifications show the configured placeholder when empty rows are allowed", async () => {
  const output = await renderBlock(
    "vsn-specifications",
    {
      source: "product",
      namespace: "custom",
      key_1: "missing",
      label_1: "Missing field",
      hide_empty: false,
      empty_text: "Not provided",
    },
    { product: { id: 1, metafields: { custom: {} } } },
  );
  assert.match(output, /<dt>Missing field<\/dt><dd>Not provided<\/dd>/);
});

test("specifications fall back to an em dash for older blocks without empty row text", async () => {
  const output = await renderBlock(
    "vsn-specifications",
    {
      source: "product",
      namespace: "custom",
      key_1: "missing",
      label_1: "Missing field",
      hide_empty: false,
    },
    { product: { id: 1, metafields: { custom: {} } } },
    ["empty_text"],
  );
  assert.match(output, /<dt>Missing field<\/dt><dd>—<\/dd>/);
});
