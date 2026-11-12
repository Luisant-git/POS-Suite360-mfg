-- Add GST / tax fields for raw materials and raw material purchase items
ALTER TABLE "RawMaterial" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "RawMaterialPurchaseItem" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "RawMaterialPurchaseItem" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(65,30) NOT NULL DEFAULT 0;

