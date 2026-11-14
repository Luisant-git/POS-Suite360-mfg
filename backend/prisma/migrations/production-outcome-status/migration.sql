ALTER TABLE "ProductionOutcome" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ProductionOutcome" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

UPDATE "ProductionOutcome"
SET "status" = 'COMPLETED', "completedAt" = NOW()
WHERE "productionId" IN (SELECT "id" FROM "Production" WHERE "status" = 'COMPLETED');

