-- Additive only: existing Session and merchant data are unchanged.
CREATE TABLE "MetafieldJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'preview',
  "inputHash" TEXT NOT NULL,
  "rowsJson" TEXT NOT NULL,
  "resultsJson" TEXT NOT NULL DEFAULT '[]',
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "lockToken" TEXT,
  "lockUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MetafieldJob_shop_createdAt_idx" ON "MetafieldJob"("shop", "createdAt");
CREATE INDEX "MetafieldJob_expiresAt_idx" ON "MetafieldJob"("expiresAt");
