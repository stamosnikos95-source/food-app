-- Data-only migration for the starter menu rows seeded before the admin
-- editor exists: rewrites mixed Latin/Greek copy ("Salad ελληνική",
-- "avocado") the way a Greek menu reads, and clears the emoji placeholders
-- that 20260104000000 stored in "imageUrl" — that column is reserved for
-- real photo URLs. Rows are matched by seed id, so nothing an admin creates
-- is touched.
UPDATE "menu_items" SET "name" = 'Bowl κοτόπουλο & κινόα', "description" = 'Ψητό κοτόπουλο, κινόα, αβοκάντο, ντοματίνια, σάλτσα γιαουρτιού', "imageUrl" = NULL WHERE "id" = 'seed-bowl-kotopoulo-kinoa';
UPDATE "menu_items" SET "name" = 'Σολομός με γλυκοπατάτα', "description" = 'Ψητός σολομός, πουρές γλυκοπατάτας, μπρόκολο στον ατμό', "imageUrl" = NULL WHERE "id" = 'seed-solomos-glykopatata';
UPDATE "menu_items" SET "name" = 'Vegan bowl με φακές', "description" = 'Φακές, καστανό ρύζι, λαχανικά εποχής, ταχίνι', "imageUrl" = NULL WHERE "id" = 'seed-vegan-fakes';
UPDATE "menu_items" SET "name" = 'Ελληνική σαλάτα με κοτόπουλο', "description" = 'Ντομάτα, αγγούρι, φέτα, ελιές Καλαμών, ψητό κοτόπουλο, παρθένο ελαιόλαδο', "imageUrl" = NULL WHERE "id" = 'seed-salad-elliniki-kotopoulo';
UPDATE "menu_items" SET "name" = 'Wrap γαλοπούλας με λαχανικά', "description" = 'Τορτίγια ολικής άλεσης, γαλοπούλα, λαχανικά, αβοκάντο', "imageUrl" = NULL WHERE "id" = 'seed-wrap-galopoula';
UPDATE "menu_items" SET "name" = 'Buddha bowl λαχανικών', "description" = 'Ψητά λαχανικά εποχής, χούμους, κινόα, σπόροι', "imageUrl" = NULL WHERE "id" = 'seed-buddha-bowl';
