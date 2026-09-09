CREATE TABLE customer_users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE customer_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE INDEX customer_sessions_user ON customer_sessions(user_id);
CREATE TABLE customer_password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE INDEX customer_resets_user ON customer_password_resets(user_id);
CREATE TABLE customer_addresses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
 label TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
 city TEXT NOT NULL, governorate TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1))
);
CREATE INDEX customer_addresses_user ON customer_addresses(user_id);
CREATE UNIQUE INDEX customer_addresses_default ON customer_addresses(user_id) WHERE is_default=1;
CREATE TABLE customer_rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
