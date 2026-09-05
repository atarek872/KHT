ALTER TABLE products ADD COLUMN compare_at_price INTEGER
CHECK (
  compare_at_price IS NULL OR
  (typeof(compare_at_price) = 'integer' AND compare_at_price > price)
);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(trim(url)) > 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE(product_id, url),
  UNIQUE(product_id, sort_order)
);

CREATE INDEX product_images_product_order_idx
ON product_images(product_id, sort_order);

INSERT INTO product_images (id, product_id, url, sort_order)
SELECT 'primary-' || id, id, image, 0
FROM products;
