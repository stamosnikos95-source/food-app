-- Placeholder photos (Unsplash License, free for commercial use) for the
-- sample dishes only, and only where no photo was set in the admin.
-- Replace with the kitchen's own photos before launch.
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1520066391310-428f06ebd602?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-bowl-kotopoulo-kinoa' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1601316585772-ba1e6dae9cfc?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-solomos-glykopatata' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1763000215238-38350d3e41ac?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-vegan-fakes' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1631311695255-8dde6bf96cb5?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-salad-elliniki-kotopoulo' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1646530208887-8a791bff4701?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-wrap-galopoula' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
UPDATE "menu_items" SET "imageUrl" = 'https://images.unsplash.com/photo-1623428188474-b1d532c5e560?auto=format&fit=crop&w=900&q=70' WHERE "id" = 'seed-buddha-bowl' AND ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" NOT LIKE 'http%');
