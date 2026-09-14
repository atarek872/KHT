CREATE TABLE IF NOT EXISTS storefront_content_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  draft_json TEXT NOT NULL DEFAULT '{}',
  published_json TEXT NOT NULL DEFAULT '{}',
  draft_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  draft_updated_by TEXT NOT NULL DEFAULT 'system',
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL DEFAULT 'system'
);

INSERT OR IGNORE INTO storefront_content_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS storefront_content_versions (
  id TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storefront_content_versions_published
  ON storefront_content_versions(published_at DESC);
