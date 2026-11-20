CREATE INDEX IF NOT EXISTS orders_fulfillment_created_idx
ON orders(fulfillment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS order_items_variant_idx
ON order_items(variant_id);
