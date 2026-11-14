-- Existing carts have no recorded permission. Do not enroll them automatically.
ALTER TABLE abandoned_carts ADD COLUMN marketing_consent_at TEXT;
ALTER TABLE abandoned_carts ADD COLUMN marketing_consent_email TEXT;
ALTER TABLE abandoned_carts ADD COLUMN recovery_token TEXT;
ALTER TABLE abandoned_carts ADD COLUMN recovery_token_expires_at TEXT;
CREATE UNIQUE INDEX abandoned_cart_recovery_token_idx
  ON abandoned_carts(recovery_token) WHERE recovery_token IS NOT NULL;

CREATE TABLE marketing_email_preferences (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  unsubscribed_at TEXT
);

CREATE TABLE cart_recovery_emails (
  cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('hour_1', 'hour_24')),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'sent', 'skipped', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  sent_at TEXT,
  PRIMARY KEY(cart_id, stage)
);
CREATE INDEX cart_recovery_email_pending_idx
  ON cart_recovery_emails(state, next_attempt_at);
