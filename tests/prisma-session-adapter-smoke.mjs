import assert from "node:assert/strict";

import { createPrismaClient } from "../app/db.server.js";
import { RequestScopedPrismaSessionStorage } from "../app/prisma-session-storage.server.js";

const sessionId = "offline_ci-prisma-worker-smoke.myshopify.com";
const shop = "ci-prisma-worker-smoke.myshopify.com";

const storage = new RequestScopedPrismaSessionStorage();

const session = {
  id: sessionId,
  shop,
  state: "ci-state",
  isOnline: false,
  scope: "read_products,write_products",
  expires: null,
  accessToken: "ci-placeholder-token",
  refreshToken: null,
  refreshTokenExpires: null,
  toObject() {
    return {
      id: this.id,
      shop: this.shop,
      state: this.state,
      isOnline: this.isOnline,
      scope: this.scope,
      expires: this.expires,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      refreshTokenExpires: this.refreshTokenExpires,
    };
  },
};

try {
  assert.equal(await storage.isReady(), true);
  assert.equal(await storage.storeSession(session), true);

  const loaded = await storage.loadSession(sessionId);
  assert.ok(loaded);
  assert.equal(loaded.id, sessionId);
  assert.equal(loaded.shop, shop);
  assert.equal(loaded.isOnline, false);
  assert.equal(loaded.scope, session.scope);
  assert.equal(loaded.accessToken, session.accessToken);

  assert.equal(await storage.deleteSession(sessionId), true);
  assert.equal(await storage.loadSession(sessionId), undefined);

  console.log("prisma_session_storage_adapter_smoke=pass");
} finally {
  const prisma = createPrismaClient();
  try {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  } finally {
    await prisma.$disconnect();
  }
}
