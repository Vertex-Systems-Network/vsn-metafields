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

test("CSV download releases Blob URL even if creating or attaching link fails", () => {
  for (const stage of ["create", "append", "click"]) {
    const calls = [];
    const link = {
      remove() { calls.push("remove"); },
      click() { if (stage === "click") throw new Error("Sandbox blocked click"); },
    };
    const host = {
      Blob,
      URL: {
        createObjectURL() { calls.push("blob"); return "blob:disposable"; },
        revokeObjectURL(url) { assert.equal(url, "blob:disposable"); calls.push("revoke"); },
      },
      document: {
        createElement() {
          if (stage === "create") throw new Error("Blocked DOM create");
          return link;
        },
        body: {
          append() {
            if (stage === "append") throw new Error("Blocked DOM append");
          },
        },
      },
      setTimeout(callback, delay) {
        assert.equal(delay, 60_000);
        callback();
      },
    };
    assert.throws(() => downloadCsv("qa.csv", "csv", host), /Blocked|Sandbox/);
    assert.deepEqual(calls, ["blob", ...(stage === "create" ? [] : ["remove"]), "revoke"], stage);
  }
});

test("CSV download revokes URL immediately if timer scheduling is unavailable", () => {
  const calls = [];
  const host = {
    Blob,
    URL: {
      createObjectURL() { return "blob:disposable"; },
      revokeObjectURL(url) { assert.equal(url, "blob:disposable"); calls.push("revoke"); },
    },
    document: {
      createElement() {
        return { remove() { calls.push("remove"); }, click() {} };
      },
      body: { append() {} },
    },
    setTimeout() { throw new Error("Timer scheduling blocked"); },
  };
  downloadCsv("qa.csv", "csv", host);
  assert.deepEqual(calls, ["remove", "revoke"]);
});

test("CSV download still schedules Blob URL cleanup if anchor removal throws", () => {
  let revoked = false;
  const host = {
    Blob,
    URL: {
      createObjectURL: () => "blob:temp",
      revokeObjectURL: (url) => { assert.equal(url, "blob:temp"); revoked = true; },
    },
    document: {
      createElement: () => ({
        click() {},
        remove() { throw new Error("Sandbox blocked removal"); },
      }),
      body: { append() {} },
    },
    setTimeout(callback) { callback(); },
  };
  assert.throws(() => downloadCsv("qa.csv", "csv", host), /Sandbox blocked removal/);
  assert.equal(revoked, true);
});
