ALTER TABLE abandoned_carts ADD COLUMN user_id TEXT REFERENCES customer_users(id);
ALTER TABLE abandoned_carts ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN write_token TEXT;
ALTER TABLE abandoned_carts ADD COLUMN guest_key_hash TEXT;
CREATE UNIQUE INDEX customer_open_cart ON abandoned_carts(user_id) WHERE user_id IS NOT NULL AND state IN ('active','cleared');
CREATE INDEX guest_cart_key ON abandoned_carts(guest_key_hash) WHERE guest_key_hash IS NOT NULL;
CREATE UNIQUE INDEX guest_open_cart ON abandoned_carts(guest_key_hash) WHERE guest_key_hash IS NOT NULL AND state IN ('active','cleared');
CREATE TABLE cart_merge_receipts (
  guest_key_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES customer_users(id),
  cart_id TEXT NOT NULL REFERENCES abandoned_carts(id),
  created_at TEXT NOT NULL
);
CREATE TABLE commerce_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO commerce_settings(key,value) VALUES('abandonment_minutes','30');
