INSERT INTO discounts
  (id, code, type, value, minimum_order, maximum_discount, usage_limit, current_usage,
   valid_from, valid_until, active, updated_at)
VALUES
  ('customer-welcome-5', 'WELCOME5', 'percentage', 5, NULL, NULL, NULL, 0,
   NULL, NULL, 1, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

CREATE TRIGGER enforce_welcome_offer_before_order
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id = 'customer-welcome-5' OR NEW.discount_code = 'WELCOME5'
BEGIN
  SELECT RAISE(ABORT, 'WELCOME_OFFER_UNAVAILABLE')
  WHERE NEW.user_id IS NULL
    OR NEW.discount_id != 'customer-welcome-5'
    OR NEW.discount_code != 'WELCOME5'
    OR EXISTS (
      SELECT 1 FROM orders existing WHERE existing.user_id = NEW.user_id
    );
END;
