-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "category" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- Example allergens for the starter (sample) dishes only; real dishes are
-- declared by the kitchen in the admin menu editor.
UPDATE "menu_items" SET "allergens" = ARRAY['milk'] WHERE "id" = 'seed-bowl-kotopoulo-kinoa';
UPDATE "menu_items" SET "allergens" = ARRAY['fish'] WHERE "id" = 'seed-solomos-glykopatata';
UPDATE "menu_items" SET "allergens" = ARRAY['sesame'] WHERE "id" = 'seed-vegan-fakes';
UPDATE "menu_items" SET "allergens" = ARRAY['milk'] WHERE "id" = 'seed-salad-elliniki-kotopoulo';
UPDATE "menu_items" SET "allergens" = ARRAY['gluten'] WHERE "id" = 'seed-wrap-galopoula';
UPDATE "menu_items" SET "allergens" = ARRAY['sesame'] WHERE "id" = 'seed-buddha-bowl';
