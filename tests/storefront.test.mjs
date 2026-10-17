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
test("specifications reject malformed namespace.key identities", async () => {
  const product = { id: 1, metafields: {
    custom: { material: { type: "single_line_text_field", value: "Public value" } },
  } };
  const output = await renderBlock("vsn-specifications", {
    namespace: "custom",
    key_1: "custom.material.extra",
    label_1: "Malformed",
    key_2: ".material",
    label_2: "Empty namespace",
    key_3: "custom.material",
    label_3: "Valid",
    hide_empty: false,
  }, { product });
  assert.doesNotMatch(output, /Malformed|Empty namespace/);
  assert.match(output, /<dt>Valid<\/dt><dd>Public value<\/dd>/);
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

test("specifications show the placeholder for a present metafield with an empty value", async () => {
  const output = await renderBlock(
    "vsn-specifications",
    {
      source: "product",
      namespace: "custom",
      key_1: "material",
      label_1: "Material",
      hide_empty: false,
      empty_text: "Not provided",
    },
    {
      product: {
        id: 1,
        metafields: { custom: { material: { type: "single_line_text_field", value: "" } } },
      },
    },
  );
  assert.match(output, /<dt>Material<\/dt><dd>Not provided<\/dd>/);
});

test("specifications hide unsupported rendered values instead of showing empty rows", async () => {
  const product = {
    id: 1,
    metafields: { custom: {
      unsupported: { type: "json", value: { secret: "private" } },
      count: { type: "number_integer", value: 0 },
      enabled: { type: "boolean", value: false },
    } },
  };
  const output = await renderBlock("vsn-specifications", {
    namespace: "custom", key_1: "unsupported", key_2: "count", key_3: "enabled",
  }, { product });
  assert.doesNotMatch(output, /unsupported|private|<dd><\/dd>/);
  assert.match(output, /<dd>0<\/dd>/);
  assert.match(output, /<dd>No<\/dd>/);
});

test("META-009 FAQ open-first applies to first rendered valid answer, not first raw item", async () => {
  const list = [
    { question: { type: "single_line_text_field", value: "Missing answer" } },
    { question: { type: "single_line_text_field", value: "First valid question" }, answer: { type: "multi_line_text_field", value: "First answer" } },
    { question: { type: "single_line_text_field", value: "Second valid question" }, answer: { type: "multi_line_text_field", value: "Second answer" } },
  ];
  const product = { id: 1, metafields: { custom: {
    faq: { type: "list.metaobject_reference", value: list },
  } } };
  for (const open_first of [true, false]) {
    const html = await renderBlock("vsn-faq", {
      namespace: "custom", field_key: "faq", open_first,
    }, { product });
    assert.doesNotMatch(html, /Missing answer/);
    const disclosures = [...html.matchAll(/<details\b([^>]*)><summary>([^<]+)<\/summary>/g)];
    assert.equal(disclosures.length, 2);
    assert.equal(disclosures[0][2], "First valid question");
    assert.equal(disclosures[1][2], "Second valid question");
    assert.equal(/\bopen\b/.test(disclosures[0][1]), open_first);
    assert.equal(/\bopen\b/.test(disclosures[1][1]), false);
  }
});

test("META-006 Specifications retains exactly 45 merchant-editable settings", () => {
  const specificationSettings = schema("vsn-specifications").settings.filter((item) => item.id);
  assert.equal(specificationSettings.length, 45);
  assert.equal(new Set(specificationSettings.map((item) => item.id)).size, 45);
});

test("META-009 only variant-owned blocks opt in to product variant AJAX refresh", async () => {
  const product = {
    id: 101,
    selected_or_first_available_variant: { id: 202, metafields: {} },
    metafields: {},
  };
  const otherProduct = {
    id: 303,
    selected_or_first_available_variant: { id: 404, metafields: {} },
    metafields: {},
  };
  for (const block of blocks) {
    for (const source of ["auto", "product", "collection", "shop", "page"]) {
      const html = await renderBlock(block, { source }, {
        product,
        request: { page_type: "product", design_mode: true },
      });
      assert.match(html, /data-vsn-block/, block + " must render QA markup");
      assert.match(html, /data-vsn-track="false"/, block + " must not refresh non-variant " + source + " data");
    }
    const variantHtml = await renderBlock(block, { source: "variant" }, {
      product,
      request: { page_type: "product", design_mode: true },
    });
    assert.match(variantHtml, /data-vsn-track="true"/, block + " should track selected variant");

    const unrelated = await renderBlock(block, {
      source: "variant",
      source_product: otherProduct,
    }, {
      product,
      request: { page_type: "product", design_mode: true },
    });
    assert.match(unrelated, /data-vsn-track="false"/,
      block + " must not refresh another product's explicitly overridden variant");
  }
});

test("META-006 reference-card columns render in an inner responsive grid", async () => {
  const cards = ["Oak", "Pine", "Maple"].map((name) => ({
    title: { type: "single_line_text_field", value: name },
  }));
  const product = {
    id: 71,
    metafields: { custom: { cards: { type: "list.metaobject_reference", value: cards } } },
  };
  for (const columns of [1, 2, 3]) {
    const html = await renderBlock("vsn-reference-cards", {
      source: "product",
      namespace: "custom",
      field_key: "cards",
      columns,
    }, { product });
    assert.match(html, new RegExp('data-vsn-columns="' + columns + '"'));
    assert.match(html, /class="vsn-reference-cards__grid"/);
    assert.equal((html.match(/<article class="vsn-reference-card">/g) || []).length, 3);
    assert.ok(html.indexOf("Oak") < html.indexOf("Pine"));
    assert.ok(html.indexOf("Pine") < html.indexOf("Maple"));
    assert.equal((html.match(/class="vsn-reference-cards__grid"/g) || []).length, 1);
  }
});

test("META-006 theme grids reflow for the real section width rather than viewport only", () => {
  const css = readFileSync("extensions/vsn-storefront/assets/vsn-metafields.css", "utf8");
  const refSource = readFileSync("extensions/vsn-storefront/blocks/vsn-reference-cards.liquid", "utf8");
  const specSource = readFileSync("extensions/vsn-storefront/blocks/vsn-specifications.liquid", "utf8");
  assert.match(css, /\.vsn-metafield-block\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /@container \(max-width: 800px\)\s*\{[\s\S]*?data-vsn-columns="3"/);
  assert.match(css, /@container \(max-width: 560px\)\s*\{[\s\S]*?\.vsn-reference-cards__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@container \(max-width: 560px\)\s*\{[\s\S]*?\.vsn-metafield-block__row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@container \(max-width: 560px\)\s*\{[\s\S]*?\.vsn-metafield-block--cards \.vsn-metafield-block__rows\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\(max-width:600px\)\s*\{\s*\.vsn-reference-cards__grid/);
  assert.match(refSource, /data-vsn-columns="\{\{ block\.settings\.columns/);
  assert.match(specSource, /data-vsn-columns="\{\{ block\.settings\.columns/);
  // The outer block must not itself be a grid: container-query rules cannot
  // query and resize the originating container, only its descendants.
  assert.doesNotMatch(css, /\.vsn-reference-cards\s*\{\s*display:\s*grid/);
});
