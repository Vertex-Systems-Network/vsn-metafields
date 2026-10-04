import test from "node:test";
import assert from "node:assert/strict";
import { encodeValue, valuesEquivalent, valueResponseMatches } from "../app/value-types.js";
const rich = {
  type: "root",
  children: [
    { type: "paragraph", children: [{ type: "text", value: "Text <safe>" }] },
  ],
};
test("structured and list codecs preserve false, zero and safe typed data", () => {
  for (const [type, raw] of [
    ["number_decimal", "0.25"],
    ["json", '{"a":false}'],
    ["dimension", '{"value":0,"unit":"cm"}'],
    ["weight", '{"value":1,"unit":"kg"}'],
    ["rating", '{"value":"4","scale_min":"1","scale_max":"5"}'],
    ["rich_text_field", JSON.stringify(rich)],
    ["list.number_integer", "[0,2]"],
    ["list.boolean", "[false,true]"],
  ])
    assert.ok(encodeValue(type, raw));
  assert.equal(encodeValue("boolean", "false"), "false");
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
    ["list.boolean", '["yes"]'],
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
