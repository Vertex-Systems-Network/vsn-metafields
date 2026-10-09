-- Additive, shop-scoped queue. Webhook payloads are not logged.
CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "customerId" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "ordersJson" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PrivacyRequest_shop_createdAt_idx" ON "PrivacyRequest"("shop", "createdAt");
CREATE INDEX "PrivacyRequest_status_completedAt_idx" ON "PrivacyRequest"("status", "completedAt");
