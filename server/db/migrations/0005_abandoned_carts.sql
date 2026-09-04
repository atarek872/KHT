CREATE TABLE abandoned_carts (
  id TEXT PRIMARY KEY,
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  items_count INTEGER NOT NULL DEFAULT 0 CHECK (items_count >= 0),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'cleared', 'converted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recovered_at TEXT
);

CREATE TABLE abandoned_cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  image TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  total INTEGER NOT NULL CHECK (total >= 0)
);

CREATE INDEX abandoned_carts_activity_idx ON abandoned_carts(state, last_activity DESC);
CREATE INDEX abandoned_cart_items_cart_idx ON abandoned_cart_items(cart_id);