ALTER TABLE shipping_zones ADD COLUMN eta_min_days INTEGER;
ALTER TABLE shipping_zones ADD COLUMN eta_max_days INTEGER;

ALTER TABLE products ADD COLUMN fabric_en TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN fabric_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN stitching_en TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN stitching_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN embroidery_en TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN embroidery_ar TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN model_measurements_en TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN model_measurements_ar TEXT NOT NULL DEFAULT '';
