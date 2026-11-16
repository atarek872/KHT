-- Keep current selling prices and stock untouched. The whole-EGP reference for
-- the set rounds the 20% calculation by 0.40 EGP (2563 × 0.8 = 2050.40).
UPDATE products SET compare_at_price = 2563, updated_at = CURRENT_TIMESTAMP
WHERE slug = 'line-01-full-set-black' AND price = 2050 AND compare_at_price IS NULL;

UPDATE products SET compare_at_price = 1150, updated_at = CURRENT_TIMESTAMP
WHERE slug = 'line-01-wide-leg-pants-black' AND price = 920 AND compare_at_price = 1160;
