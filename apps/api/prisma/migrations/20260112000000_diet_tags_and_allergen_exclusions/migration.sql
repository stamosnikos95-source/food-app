ALTER TABLE "menu_items" ADD COLUMN "dietTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "customer_profiles" ADD COLUMN "excludedAllergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Starter dishes (marked as samples in the admin) that are plant-based.
UPDATE "menu_items" SET "dietTags" = ARRAY['vegan', 'vegetarian'] WHERE "id" IN ('seed-vegan-fakes', 'seed-buddha-bowl');
