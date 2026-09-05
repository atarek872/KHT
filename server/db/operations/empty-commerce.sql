PRAGMA foreign_keys = ON;

DELETE FROM abandoned_cart_events;
DELETE FROM abandoned_cart_items;
DELETE FROM abandoned_carts;
DELETE FROM order_events;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM discounts;
DELETE FROM customers;
DELETE FROM inventory_variants;
DELETE FROM product_images;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM shipping_zones;
DELETE FROM request_rate_limits;
DELETE FROM admin_sessions;

PRAGMA optimize;
