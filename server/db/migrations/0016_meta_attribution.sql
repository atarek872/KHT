ALTER TABLE orders ADD COLUMN attribution_source TEXT;
ALTER TABLE orders ADD COLUMN attribution_campaign_id TEXT;
ALTER TABLE orders ADD COLUMN attribution_adset_id TEXT;
ALTER TABLE orders ADD COLUMN attribution_ad_id TEXT;
CREATE INDEX orders_campaign_ids_idx ON orders(attribution_campaign_id, attribution_adset_id, attribution_ad_id);

CREATE TABLE meta_event_outbox (
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload_json TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  PRIMARY KEY (event_name, event_id)
);
CREATE INDEX meta_event_outbox_pending_idx ON meta_event_outbox(state, next_attempt_at);

CREATE TABLE ga4_purchase_outbox (
  transaction_id TEXT PRIMARY KEY,
  payload_json TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX ga4_purchase_outbox_pending_idx ON ga4_purchase_outbox(state, next_attempt_at);
