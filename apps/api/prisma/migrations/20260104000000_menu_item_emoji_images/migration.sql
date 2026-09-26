-- Backfills imageUrl on the starter menu items seeded in an earlier
-- deploy, before real food photography exists. Harmless no-op for rows
-- that don't match (fresh databases seed with the image already set).
UPDATE "menu_items" SET "imageUrl" = '🍗' WHERE "id" = 'seed-bowl-kotopoulo-kinoa';
UPDATE "menu_items" SET "imageUrl" = '🐟' WHERE "id" = 'seed-solomos-glykopatata';
UPDATE "menu_items" SET "imageUrl" = '🌱' WHERE "id" = 'seed-vegan-fakes';
UPDATE "menu_items" SET "imageUrl" = '🥗' WHERE "id" = 'seed-salad-elliniki-kotopoulo';
UPDATE "menu_items" SET "imageUrl" = '🌯' WHERE "id" = 'seed-wrap-galopoula';
UPDATE "menu_items" SET "imageUrl" = '🍲' WHERE "id" = 'seed-buddha-bowl';
