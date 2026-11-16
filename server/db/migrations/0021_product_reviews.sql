CREATE TABLE product_reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  display_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moderated_at TEXT,
  moderated_by TEXT,
  UNIQUE(order_id, product_id)
);
CREATE INDEX product_reviews_public_idx ON product_reviews(product_id, status, created_at DESC);
CREATE INDEX product_reviews_admin_idx ON product_reviews(status, created_at DESC);
