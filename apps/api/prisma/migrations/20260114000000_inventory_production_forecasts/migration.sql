CREATE TYPE "StockMovementType" AS ENUM ('purchase', 'production', 'waste', 'adjustment');

ALTER TABLE "ingredients" ADD COLUMN "reorderLevelG" DOUBLE PRECISION;

CREATE TABLE "production_runs" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "portions" INTEGER NOT NULL,
    "costPerPortionCents" INTEGER,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "production_runs_businessDate_idx" ON "production_runs"("businessDate");
CREATE INDEX "production_runs_menuItemId_businessDate_idx" ON "production_runs"("menuItemId", "businessDate");
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityG" DOUBLE PRECISION NOT NULL,
    "costPerKgCents" INTEGER,
    "expiresOn" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "productionRunId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_ingredientId_createdAt_idx" ON "stock_movements"("ingredientId", "createdAt");
CREATE INDEX "stock_movements_type_createdAt_idx" ON "stock_movements"("type", "createdAt");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dish_waste" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "portions" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "costPerPortionCents" INTEGER,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dish_waste_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dish_waste_businessDate_idx" ON "dish_waste"("businessDate");
CREATE INDEX "dish_waste_menuItemId_businessDate_idx" ON "dish_waste"("menuItemId", "businessDate");
ALTER TABLE "dish_waste" ADD CONSTRAINT "dish_waste_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "demand_forecasts" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "predicted" DOUBLE PRECISION,
    "recommended" INTEGER,
    "observations" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demand_forecasts_menuItemId_businessDate_key" ON "demand_forecasts"("menuItemId", "businessDate");
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
