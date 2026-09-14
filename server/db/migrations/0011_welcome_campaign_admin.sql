ALTER TABLE discounts ADD COLUMN login_required INTEGER NOT NULL DEFAULT 0 CHECK (login_required IN (0, 1));
ALTER TABLE discounts ADD COLUMN once_per_customer INTEGER NOT NULL DEFAULT 0 CHECK (once_per_customer IN (0, 1));
ALTER TABLE discounts ADD COLUMN first_order_only INTEGER NOT NULL DEFAULT 0 CHECK (first_order_only IN (0, 1));

UPDATE discounts
SET login_required = 1, once_per_customer = 1, first_order_only = 1
WHERE id = 'customer-welcome-5';

CREATE TABLE welcome_campaign_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  discount_id TEXT NOT NULL REFERENCES discounts(id),
  desktop_delay_seconds INTEGER NOT NULL DEFAULT 30 CHECK (desktop_delay_seconds BETWEEN 5 AND 300),
  mobile_delay_seconds INTEGER NOT NULL DEFAULT 60 CHECK (mobile_delay_seconds BETWEEN 10 AND 300),
  dismissal_days INTEGER NOT NULL DEFAULT 30 CHECK (dismissal_days BETWEEN 1 AND 365),
  eyebrow_en TEXT NOT NULL,
  eyebrow_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  primary_label_en TEXT NOT NULL,
  primary_label_ar TEXT NOT NULL,
  primary_redirect TEXT NOT NULL,
  secondary_label_en TEXT NOT NULL,
  secondary_label_ar TEXT NOT NULL,
  secondary_redirect TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT 'system@kht.local'
);

INSERT INTO welcome_campaign_settings (
  id, enabled, discount_id, desktop_delay_seconds, mobile_delay_seconds, dismissal_days,
  eyebrow_en, eyebrow_ar, title_en, title_ar, body_en, body_ar,
  primary_label_en, primary_label_ar, primary_redirect,
  secondary_label_en, secondary_label_ar, secondary_redirect
) VALUES (
  1, 1, 'customer-welcome-5', 30, 60, 30,
  'KHT / WELCOME GIFT', 'KHT / هدية ترحيب',
  'YOUR FIRST ORDER. 5% OFF.', 'خصم ٥٪ على أول طلب.',
  'Create your KHT account or sign in. Your welcome gift is applied automatically at checkout.',
  'أنشئ حساب KHT أو سجل دخولك، وهدية الترحيب هتتطبق تلقائياً عند إتمام الطلب.',
  'Claim my gift', 'احصل على هديتي', '/account/register?returnTo={current}',
  'Already have an account? Sign in', 'عندك حساب؟ سجل دخولك',
  '/account/login?returnTo={current}'
);

CREATE TABLE customer_discount_redemptions (
  user_id TEXT NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
  discount_id TEXT NOT NULL REFERENCES discounts(id),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, discount_id)
);
CREATE INDEX customer_discount_redemptions_discount
ON customer_discount_redemptions(discount_id, created_at DESC);

DROP TRIGGER enforce_welcome_offer_before_order;

CREATE TRIGGER enforce_customer_discount_rules_before_order
BEFORE INSERT ON orders
FOR EACH ROW WHEN NEW.discount_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'DISCOUNT_LOGIN_REQUIRED')
  WHERE NEW.user_id IS NULL AND EXISTS (
    SELECT 1 FROM discounts discount
    WHERE discount.id = NEW.discount_id
      AND (discount.login_required = 1 OR discount.once_per_customer = 1 OR discount.first_order_only = 1)
  );

  SELECT RAISE(ABORT, 'DISCOUNT_FIRST_ORDER_ONLY')
  WHERE EXISTS (
    SELECT 1 FROM discounts discount
    WHERE discount.id = NEW.discount_id AND discount.first_order_only = 1
  ) AND EXISTS (
    SELECT 1 FROM orders existing WHERE existing.user_id = NEW.user_id
  );

  SELECT RAISE(ABORT, 'DISCOUNT_ALREADY_REDEEMED')
  WHERE EXISTS (
    SELECT 1 FROM discounts discount
    WHERE discount.id = NEW.discount_id AND discount.once_per_customer = 1
  ) AND EXISTS (
    SELECT 1 FROM customer_discount_redemptions redemption
    WHERE redemption.user_id = NEW.user_id AND redemption.discount_id = NEW.discount_id
  );
END;

CREATE TRIGGER record_customer_discount_redemption_after_order
AFTER INSERT ON orders
FOR EACH ROW WHEN NEW.user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM discounts discount
  WHERE discount.id = NEW.discount_id AND discount.once_per_customer = 1
)
BEGIN
  INSERT INTO customer_discount_redemptions(user_id, discount_id, order_id, created_at)
  VALUES(NEW.user_id, NEW.discount_id, NEW.id, NEW.created_at);
END;
