INSERT INTO commerce_settings(key, value) VALUES('abandonment_minutes', '5')
ON CONFLICT(key) DO UPDATE SET value = '5';

CREATE TABLE admin_email_notifications (
  kind TEXT NOT NULL CHECK (kind IN ('order', 'abandoned_cart')),
  entity_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'sent', 'skipped', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  PRIMARY KEY (kind, entity_id)
);
CREATE INDEX admin_email_notifications_pending_idx
  ON admin_email_notifications(state, next_attempt_at);

-- Existing records are already known to the owner; deployment must not email the backlog.
INSERT INTO admin_email_notifications
  (kind, entity_id, state, next_attempt_at, created_at, delivered_at)
SELECT 'order', id, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM orders;

INSERT INTO admin_email_notifications
  (kind, entity_id, state, next_attempt_at, created_at, delivered_at)
SELECT 'abandoned_cart', c.id, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM abandoned_carts c
WHERE c.state = 'active' AND c.items_count > 0
  AND c.recovery_state IN ('active', 'contacted')
  AND datetime(c.last_activity) <= datetime('now', '-5 minutes')
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.cart_id = c.id);
