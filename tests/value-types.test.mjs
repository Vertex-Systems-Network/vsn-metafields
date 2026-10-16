import test from "node:test";
import assert from "node:assert/strict";
import { editableValueType, encodeValue, valueInputHint, valuesEquivalent, valueResponseMatches, SCALAR_TYPES } from "../app/value-types.js";
const rich = {
  type: "root",
  children: [
    { type: "paragraph", children: [{ type: "text", value: "Text <safe>" }] },
  ],
};
test("every advertised editable scalar and list has a valid roundtrip and rejects malformed input", () => {
  const values = {
    single_line_text_field: "Cotton",
    multi_line_text_field: "Care\nInstructions",
    number_integer: "0",
    number_decimal: "1.25",
    boolean: "false",
    date: "2026-10-16",
    date_time: "2026-10-16T12:30:00Z",
    url: "https://example.com/path",
    color: "#A1b2C3",
    json: '{"a":false}',
    rich_text_field: JSON.stringify(rich),
    dimension: '{"value":10,"unit":"cm"}',
    volume: '{"value":1,"unit":"l"}',
    weight: '{"value":1,"unit":"kg"}',
    rating: '{"value":4,"scale_min":1,"scale_max":5}',
    money: '{"amount":"10.00","currency_code":"USD"}',
    link: '{"text":"Docs","url":"https://example.com"}',
    product_reference: "gid://shopify/Product/123",
    variant_reference: "gid://shopify/ProductVariant/123",
    collection_reference: "gid://shopify/Collection/123",
    page_reference: "gid://shopify/Page/123",
    article_reference: "gid://shopify/Article/123",
    file_reference: "gid://shopify/MediaImage/123",
    metaobject_reference: "gid://shopify/Metaobject/123",
    mixed_reference: "gid://shopify/Metaobject/123",
  };
  assert.deepEqual(Object.keys(values).sort(), [...SCALAR_TYPES].sort());
  const listExcluded = new Set(["boolean", "json", "rich_text_field", "money", "multi_line_text_field"]);
  const invalid = {
    single_line_text_field: "line one\nline two",
    multi_line_text_field: "",
    number_integer: "1.2",
    number_decimal: "1,2",
    boolean: "yes",
    date: "2026-02-30",
    date_time: "2026-10-16T12:30:00",
    url: "http://example.com",
    color: "red",
    json: "{",
    rich_text_field: '{"type":"root","children":[{"type":"script","children":[]}]}',
    dimension: '{"value":1,"unit":"evil"}',
    volume: '{"value":-1,"unit":"liters"}',
    weight: '{"value":1,"unit":"evil"}',
    rating: '{"value":6,"scale_min":1,"scale_max":5}',
    money: '{"amount":"10","currency_code":"US"}',
    link: '{"text":"Docs","url":"javascript:alert(1)"}',
    product_reference: "gid://shopify/Collection/123",
    variant_reference: "gid://shopify/Product/123",
    collection_reference: "gid://shopify/Product/123",
    page_reference: "gid://shopify/Product/123",
    article_reference: "gid://shopify/Product/123",
    file_reference: "gid://shopify/Page/123",
    metaobject_reference: "gid://shopify/Product/123",
    mixed_reference: "gid://shopify/Product/123",
  };
  assert.deepEqual(Object.keys(invalid).sort(), [...SCALAR_TYPES].sort());
  let covered = 0;
  for (const type of SCALAR_TYPES) {
    const raw = values[type];
    const encoded = encodeValue(type, raw);
    assert.equal(valuesEquivalent(type, raw, encoded), true, type);
    assert.throws(() => encodeValue(type, invalid[type]), RangeError, type);
    covered++;
    const listType = `list.${type}`;
    if (listExcluded.has(type)) {
      assert.equal(editableValueType(listType), false, listType);
      continue;
    }
    const listRaw = JSON.stringify([type.startsWith("number_") ? Number(raw) :
      ["dimension", "volume", "weight", "rating", "link"].includes(type) ? JSON.parse(raw) : raw]);
    const listEncoded = encodeValue(listType, listRaw);
    assert.equal(valuesEquivalent(listType, listRaw, listEncoded), true, listType);
    assert.throws(() => encodeValue(listType, "{}"), RangeError, listType);
    assert.throws(() => encodeValue(listType, JSON.stringify([invalid[type]])), RangeError, listType);
    covered++;
  }
  assert.equal(covered, 45);
});
test("structured and list codecs preserve false, zero and safe typed data", () => {
  for (const [type, raw] of [
    ["number_decimal", "0.25"],
    ["json", '{"a":false}'],
    ["dimension", '{"value":0,"unit":"cm"}'],
    ["weight", '{"value":1,"unit":"kg"}'],
    ["rating", '{"value":"4","scale_min":"1","scale_max":"5"}'],
    ["rich_text_field", JSON.stringify(rich)],
    ["list.number_integer", "[0,2]"],
    ["list.link", '[{"text":"Docs","url":"https://shopify.dev/docs"}]'],
  ])
    assert.ok(encodeValue(type, raw));
  assert.equal(encodeValue("boolean", "false"), "false");
  assert.deepEqual(JSON.parse(encodeValue("list.link", '[{"text":"Docs","url":"https://shopify.dev/docs"}]')), [{ text: "Docs", url: "https://shopify.dev/docs" }]);
});
test("unsupported Shopify list types route to the native editor", () => {
  for (const type of ["list.boolean", "list.multi_line_text_field", "list.json", "list.money"] ) {
    assert.equal(editableValueType(type), false);
    assert.throws(() => encodeValue(type, "[]"), /native value editor/);
  }
  assert.equal(editableValueType("list.link"), true);
});
test("list guidance matches structured link and reference input", () => {
  assert.match(valueInputHint("list.link"), /\[\{"text":"Learn more","url":"https:\/\/example\.com"\}\]/);
  assert.match(valueInputHint("list.product_reference"), /gid:\/\/shopify\/Product\/123/);
  assert.match(valueInputHint("list.dimension"), /dimension objects/);
  assert.match(valueInputHint("list.single_line_text_field"), /\["cotton", "linen"\]/);
});
test("invalid structures, oversized input, unsupported nodes and mismatched references are rejected", () => {
  for (const [type, raw] of [
    ["single_line_text_field", "a\nb"],
    ["number_decimal", "NaN"],
    ["number_integer", "9007199254740992"],
    ["json", "{"],
    ["dimension", '{"value":1,"unit":"evil"}'],
    ["rating", '{"value":8,"scale_min":1,"scale_max":5}'],
    ["product_reference", "gid://shopify/Collection/1"],
    ["list.link", '[{"text":"Unsafe","url":"javascript:alert(1)"}]'],
    [
      "rich_text_field",
      '{"type":"root","children":[{"type":"script","children":[]}]}',
    ],
    ["url", "https://user:pass@example.com"],
    ["date", "2026-02-30"],
    ["date_time", "2026-01-01"],
    ["single_line_text_field", "€".repeat(22000)],
  ])
    assert.throws(
      () => encodeValue(type, raw),
      RangeError,
      `${type}: ${raw.slice(0, 20)}`,
    );
});
test("definition numeric, text length and list count rules are enforced", () => {
  assert.throws(
    () => encodeValue("number_integer", "3", [{ name: "min", value: "4" }]),
    /min/,
  );
  assert.throws(
    () =>
      encodeValue("single_line_text_field", "long", [
        { name: "max", value: "3" },
      ]),
    /length/,
  );
  assert.throws(
    () =>
      encodeValue("list.single_line_text_field", '["a","b"]', [
        { name: "list.max", value: "1" },
      ]),
    /list.max/,
  );
});

test("Shopify uppercase measurement responses can be re-edited and aliases canonicalize", () => {
  for (const [type, unit, canonical] of [["dimension", "cm", "CENTIMETERS"], ["weight", "kg", "KILOGRAMS"], ["volume", "l", "LITERS"]]) {
    const value = encodeValue(type, JSON.stringify({value: 1, unit}));
    assert.deepEqual(JSON.parse(value), {value: 1, unit: canonical});
    assert.equal(encodeValue(type, value), value);
  }
  assert.deepEqual(JSON.parse(encodeValue("list.dimension", '[{"value":2,"unit":"CENTIMETERS"}]')), [{value: 2, unit: "CENTIMETERS"}]);
});
test("normalized structured writes recover without confusing changed values or text", () => {
  assert.equal(valuesEquivalent("number_decimal", "1.00", "1"), true);
  assert.equal(valuesEquivalent("number_decimal", "-0.0", "0"), true);
  assert.equal(valuesEquivalent("number_decimal", "1.01", "1"), false);
  assert.equal(valuesEquivalent("number_decimal", "9007199254740992", "9007199254740993"), false);
  assert.equal(valuesEquivalent("number_decimal", "invalid", "1"), false);
  assert.equal(valuesEquivalent("dimension", '{"value":10,"unit":"cm"}', '{"unit":"CENTIMETERS","value":10}'), true);
  assert.equal(valuesEquivalent("dimension", '{"value":11,"unit":"cm"}', '{"unit":"CENTIMETERS","value":10}'), false);
  assert.equal(valuesEquivalent("json", '{"a":0,"b":false}', '{"b":false,"a":0}'), true);
  assert.equal(valuesEquivalent("single_line_text_field", "false", " false"), false);
  assert.equal(valuesEquivalent("list.dimension", '[{"value":10,"unit":"cm"}]', '[{"unit":"CENTIMETERS","value":10}]'), true);
});

test("value feedback cannot follow a different resource or field selection", () => {
  const selected = {
    ownerType: "PRODUCT",
    ownerId: "gid://shopify/Product/1",
    namespace: "qa",
    key: "care",
  };
  for (const feedback of [
    { success: true, message: "Value saved." },
    { error: "Text violates min length 3." },
    { error: "Reload before editing.", code: "value_conflict" },
  ]) {
    const response = { ...selected, ...feedback };
    assert.equal(valueResponseMatches(response, selected), true);
    for (const part of ["ownerType", "ownerId", "namespace", "key"])
      assert.equal(
        valueResponseMatches(response, { ...selected, [part]: "different" }),
        false,
      );
    assert.equal(
      valueResponseMatches(response, { ownerType: "PRODUCT" }),
      false,
    );
    assert.equal(valueResponseMatches(feedback, selected), false);
  }
  assert.equal(valueResponseMatches(null, selected), false);
});
