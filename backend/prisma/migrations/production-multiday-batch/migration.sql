ALTER TABLE "RawMaterial" ADD COLUMN IF NOT EXISTS "batchCode" TEXT;
ALTER TABLE "RawMaterialPurchaseItem" ADD COLUMN IF NOT EXISTS "batchCode" TEXT;

ALTER TABLE "Production" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Production" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Production" ADD COLUMN IF NOT EXISTS "materialBatchCode" TEXT;
ALTER TABLE "Production" ALTER COLUMN "rawMaterialId" DROP NOT NULL;
ALTER TABLE "Production" ALTER COLUMN "intakeQuantity" SET DEFAULT 0;
ALTER TABLE "Production" ALTER COLUMN "finishedProductId" DROP NOT NULL;
ALTER TABLE "Production" ALTER COLUMN "outcomeQuantity" SET DEFAULT 0;

UPDATE "Production"
SET "status" = 'COMPLETED', "completedAt" = COALESCE("completedAt", "updatedAt")
WHERE "outcomeQuantity" > 0 AND "status" = 'PENDING';

