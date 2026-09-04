PRAGMA foreign_keys = ON;

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipping_zones (
  governorate TEXT PRIMARY KEY,
  rate INTEGER NOT NULL CHECK (rate >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

INSERT INTO shipping_zones (governorate, rate) VALUES
  ('Cairo', 60),
  ('Giza', 70),
  ('Alexandria', 90);

CREATE TABLE inventory_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'Black',
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

INSERT INTO inventory_variants
  (id, product_id, product_name, sku, size, unit_price, stock)
VALUES
  ('kht-001-s', 'kht-001', 'The Line Tee', 'KHT-001-S', 'S', 890, 8),
  ('kht-001-m', 'kht-001', 'The Line Tee', 'KHT-001-M', 'M', 890, 12),
  ('kht-001-l', 'kht-001', 'The Line Tee', 'KHT-001-L', 'L', 890, 10),
  ('kht-001-xl', 'kht-001', 'The Line Tee', 'KHT-001-XL', 'XL', 890, 6),
  ('kht-001-xxl', 'kht-001', 'The Line Tee', 'KHT-001-XXL', 'XXL', 890, 0),
  ('kht-002-s', 'kht-002', 'The Line Tracksuit', 'KHT-002-S', 'S', 2390, 5),
  ('kht-002-m', 'kht-002', 'The Line Tracksuit', 'KHT-002-M', 'M', 2390, 8),
  ('kht-002-l', 'kht-002', 'The Line Tracksuit', 'KHT-002-L', 'L', 2390, 6),
  ('kht-002-xl', 'kht-002', 'The Line Tracksuit', 'KHT-002-XL', 'XL', 2390, 4),
  ('kht-002-xxl', 'kht-002', 'The Line Tracksuit', 'KHT-002-XXL', 'XXL', 2390, 0),
  ('kht-003-s', 'kht-003', 'The Line Trouser', 'KHT-003-S', 'S', 1290, 6),
  ('kht-003-m', 'kht-003', 'The Line Trouser', 'KHT-003-M', 'M', 1290, 10),
  ('kht-003-l', 'kht-003', 'The Line Trouser', 'KHT-003-L', 'L', 1290, 7),
  ('kht-003-xl', 'kht-003', 'The Line Trouser', 'KHT-003-XL', 'XL', 1290, 5),
  ('kht-003-xxl', 'kht-003', 'The Line Trouser', 'KHT-003-XXL', 'XXL', 1290, 2);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping INTEGER NOT NULL CHECK (shipping >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method = 'cod'),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL CHECK (source IN ('website','instagram','facebook','tiktok','whatsapp','phone','admin','other')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES inventory_variants(id),
  product_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  total INTEGER NOT NULL CHECK (total >= 0)
);

CREATE TRIGGER reserve_inventory_before_order_item
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT stock FROM inventory_variants WHERE id = NEW.variant_id AND active = 1) IS NULL
      THEN RAISE(ABORT, 'VARIANT_UNAVAILABLE')
    WHEN (SELECT stock FROM inventory_variants WHERE id = NEW.variant_id) < NEW.quantity
      THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
  END;
END;

CREATE TRIGGER decrement_inventory_after_order_item
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
  UPDATE inventory_variants SET stock = stock - NEW.quantity WHERE id = NEW.variant_id;
END;

CREATE INDEX customers_phone_idx ON customers(phone);
CREATE INDEX orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX order_items_order_idx ON order_items(order_id);