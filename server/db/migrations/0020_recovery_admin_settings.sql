CREATE TABLE cart_recovery_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 0,
  sender_email TEXT,
  encrypted_api_key TEXT,
  first_delay_minutes INTEGER NOT NULL DEFAULT 60,
  second_delay_hours INTEGER NOT NULL DEFAULT 24,
  copy_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO cart_recovery_settings(id) VALUES(1);
ALTER TABLE abandoned_carts ADD COLUMN marketing_consent_source TEXT;
ALTER TABLE abandoned_carts ADD COLUMN marketing_consent_recorded_by TEXT;
