import assert from "node:assert/strict";
import test from "node:test";
import { createCsvFileSelection } from "../app/csv-file-selection.js";

test("a late file read cannot restore CSV after a rejected selection", async () => {
  const selection = createCsvFileSelection();
  let resolveRead;
  const first = selection.read({
    size: 12,
    text: () => new Promise((resolve) => { resolveRead = resolve; }),
  });
  assert.deepEqual(await selection.read({ size: 256001 }), { status: "oversized" });
  resolveRead("old CSV");
  assert.deepEqual(await first, { status: "stale" });
});

test("manual editing invalidates a pending file read", async () => {
  const selection = createCsvFileSelection();
  let resolveRead;
  const pending = selection.read({
    size: 12,
    text: () => new Promise((resolve) => { resolveRead = resolve; }),
  });
  selection.invalidate();
  resolveRead("old CSV");
  assert.deepEqual(await pending, { status: "stale" });
  assert.deepEqual(await selection.read({ size: 4, text: async () => "new CSV" }), {
    status: "ready", csv: "new CSV",
  });
});

test("unreadable current file returns a recoverable error", async () => {
  const selection = createCsvFileSelection();
  const result = await selection.read({
    size: 12,
    text: async () => { throw new Error("read failure"); },
  });
  assert.deepEqual(result, { status: "unreadable" });
});
