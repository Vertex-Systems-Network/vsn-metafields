import assert from "node:assert/strict";
import test from "node:test";
import { downloadCsv } from "../app/download-csv.js";

test("CSV download clicks a connected link before releasing its Blob URL", () => {
  const events = [];
  let deferred;
  const link = {
    remove() { events.push("remove"); },
    click() {
      assert.equal(this.href, "blob:test-csv");
      assert.equal(this.download, "snapshot.csv");
      assert.deepEqual(events, ["create", "append"]);
      events.push("click");
    },
  };
  const host = {
    Blob,
    URL: {
      createObjectURL(blob) {
        assert.equal(blob.type, "text/csv;charset=utf-8");
        events.push("create");
        return "blob:test-csv";
      },
      revokeObjectURL(url) {
        assert.equal(url, "blob:test-csv");
        events.push("revoke");
      },
    },
    document: {
      body: { append(candidate) { assert.equal(candidate, link); events.push("append"); } },
      createElement(tag) { assert.equal(tag, "a"); return link; },
    },
    setTimeout(callback, delay) {
      assert.equal(delay, 60_000);
      deferred = callback;
    },
  };

  downloadCsv("snapshot.csv", "ownerType,value_json\r\n", host);
  assert.deepEqual(events, ["create", "append", "click", "remove"]);
  deferred();
  assert.deepEqual(events, ["create", "append", "click", "remove", "revoke"]);
});
