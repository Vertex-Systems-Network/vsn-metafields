import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the shipped asset with deterministic event/network/DOM doubles.
// This verifies request ordering, not Shopify theme rendering or browser accessibility.
const source = readFileSync("extensions/vsn-storefront/assets/vsn-metafields.js", "utf8");
const settle = () => new Promise(setImmediate);
function harness(configs = [{}], rejectOnAbort = false) {
  const listeners = new Map(), timers = new Map(), requests = [];
  let timerId = 0;
  const blocks = [];
  function makeBlock({ id = "vsn-one", variant = "1", product = "10", track = "true", hidden = false } = {}) {
    const attributes = new Map();
    return {
      id, hidden, isConnected: true,
      dataset: { vsnSource: "variant", vsnTrack: track, vsnVariant: variant, vsnProduct: product, vsnSection: "product-section" },
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: key => attributes.delete(key),
      getAttribute: key => attributes.get(key),
      replaceWith(next) {
        const index = blocks.indexOf(this);
        if (index < 0) throw Error("Detached block replacement");
        this.isConnected = false;
        blocks[index] = next;
      },
    };
  }
  blocks.push(...configs.map(makeBlock));
  const window = {};
  const document = {
    addEventListener: (type, callback) => {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    querySelectorAll: () => blocks.filter(block => block.isConnected),
  };
  const globals = {
    window, document, URL, AbortController,
    location: { href: "https://shop.example/fr/products/test?view=custom" },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    DOMParser: class { parseFromString(value) { return value; } },
    fetch: (url, options) => new Promise((resolve, reject) => {
      const request = {
        url, options,
        respond(next, ok = true) { resolve({ ok, text: async () => ({ getElementById: id => next?.id === id ? next : null }) }); },
        fail: reject,
      };
      if (rejectOnAbort) options.signal.addEventListener("abort", () => reject(Object.assign(Error("Aborted"), { name: "AbortError" })), { once: true });
      requests.push(request);
    }),
  };
  const initialize = () => runInNewContext(source, globals);
  initialize();
  return {
    blocks, requests, makeBlock, initialize, timers,
    emit(variant, product = "10", type = "variant:change") {
      for (const callback of listeners.get(type) || []) callback({ detail: { variant: { id: variant, product_id: product } } });
    },
    emitForm(variant, product = "10") {
      const form = { dataset: { productId: product }, querySelector: () => ({ value: variant }) };
      for (const callback of listeners.get("change") || []) callback({ target: { closest: () => form } });
    },
    async fire(delay) {
      for (const [id, timer] of [...timers]) if (timer.delay === delay && timers.delete(id)) timer.callback();
      await settle();
    },
  };
}

test("late response cannot overwrite a return to the original variant during debounce", async () => {
  const h = harness();
  h.emit("2"); await h.fire(80);
  h.emit("1");
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.requests[0].respond(h.makeBlock({ variant: "2" }));
  await settle();
  assert.equal(h.blocks[0].dataset.vsnVariant, "1");
  await h.fire(80);
  h.requests[1].respond(h.makeBlock({ variant: "1" }));
  await settle();
  assert.equal(h.blocks[0].hidden, false);
  assert.equal(h.blocks[0].dataset.vsnVariant, "1");
});

test("superseded completion cannot clear a newer request's busy state", async () => {
  const h = harness();
  h.emit("2"); await h.fire(80);
  h.emit("3"); await h.fire(80);
  h.requests[0].respond(h.makeBlock({ variant: "2" })); await settle();
  assert.equal(h.blocks[0].getAttribute("aria-busy"), "true");
  h.requests[1].respond(h.makeBlock({ variant: "3" })); await settle();
  assert.equal(h.blocks[0].dataset.vsnVariant, "3");
  assert.equal(h.blocks[0].getAttribute("aria-busy"), undefined);
});

test("rapid choices debounce to the latest snapshot and preserve locale/query/section", async () => {
  const h = harness();
  h.emit("2"); h.emit("3"); h.emit("4"); await h.fire(80);
  assert.equal(h.requests.length, 1);
  const request = h.requests[0];
  assert.equal(request.url.origin, "https://shop.example");
  assert.equal(request.url.pathname, "/fr/products/test");
  assert.equal(request.url.searchParams.get("variant"), "4");
  assert.equal(request.url.searchParams.get("view"), "custom");
  assert.equal(request.url.searchParams.get("section_id"), "product-section");
  assert.equal(request.options.credentials, "same-origin");
  request.respond(h.makeBlock({ variant: "4" })); await settle();
});

test("mismatched products, product overrides and invalid variant IDs leave current blocks alone", async () => {
  const h = harness([{ id: "main" }, { id: "override", track: "false", product: "20" }]);
  h.emit("2", "20"); h.emit("oops"); await h.fire(80);
  assert.equal(h.requests.length, 0);
  assert.ok(h.blocks.every(block => !block.hidden));
  h.emit("2"); await h.fire(80);
  assert.equal(h.requests.length, 1);
  assert.equal(h.blocks[1].hidden, false);
  h.requests[0].respond(h.makeBlock({ id: "main", variant: "2" })); await settle();
});

test("all eligible blocks start together so a slow response cannot restart an obsolete selection", async () => {
  const h = harness([{ id: "one" }, { id: "two" }, { id: "three" }]);
  h.emit("2"); await h.fire(80);
  assert.equal(h.requests.length, 3);
  h.emit("3"); await h.fire(80);
  assert.equal(h.requests.length, 6);
  for (let i = 0; i < 3; i++) {
    assert.equal(h.requests[i].options.signal.aborted, true);
    h.requests[i].respond(h.makeBlock({ id: h.blocks[i].id, variant: "2" }));
    h.requests[i + 3].respond(h.makeBlock({ id: h.blocks[i].id, variant: "3" }));
  }
  await settle();
  assert.ok(h.blocks.every(block => block.dataset.vsnVariant === "3"));
});

test("network failures and wrong/missing section identities hide stale data and allow recovery", async () => {
  for (const failure of ["network", "http", "missing", "product", "variant"]) {
    const h = harness();
    h.emit("2"); await h.fire(80);
    const request = h.requests[0];
    if (failure === "network") request.fail(Error("Offline"));
    else if (failure === "http") request.respond(null, false);
    else request.respond(failure === "missing" ? null : h.makeBlock({ variant: failure === "variant" ? "9" : "2", product: failure === "product" ? "99" : "10" }));
    await settle();
    assert.equal(h.blocks[0].hidden, true, failure);
    assert.equal(h.blocks[0].getAttribute("aria-busy"), undefined, failure);
    h.emit("1"); await h.fire(80);
    h.requests[1].respond(h.makeBlock({ variant: "1" })); await settle();
    assert.equal(h.blocks[0].hidden, false, failure);
  }
});

test("stalled requests abort after eight seconds and clear busy state without exposing stale data", async () => {
  const h = harness([{}], true);
  h.emit("2"); await h.fire(80);
  await h.fire(8000);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.blocks[0].hidden, true);
  assert.equal(h.blocks[0].getAttribute("aria-busy"), undefined);
  assert.equal(h.timers.size, 0);
});

test("initially empty anchors can refresh and duplicate asset initialization installs no extra listeners", async () => {
  const h = harness([{ hidden: true }]);
  h.initialize(); h.emitForm("1"); await h.fire(80);
  assert.equal(h.requests.length, 1);
  h.requests[0].respond(h.makeBlock({ variant: "1", hidden: true })); await settle();
  h.emitForm("2"); await h.fire(80);
  h.requests[1].respond(h.makeBlock({ variant: "2" })); await settle();
  assert.equal(h.blocks[0].hidden, false);
});

test("a response cannot replace a block removed by the theme editor", async () => {
  const h = harness();
  h.emit("2"); await h.fire(80);
  const old = h.blocks[0]; old.isConnected = false;
  h.requests[0].respond(h.makeBlock({ variant: "2" })); await settle();
  assert.equal(h.blocks[0], old);
  assert.equal(old.getAttribute("aria-busy"), undefined);
});
