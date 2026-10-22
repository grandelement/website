-- Apply to an existing GE Studios Vault D1 database before deploying access-code endpoints.
-- Safe to rerun; does not change the Radio Gate or existing playlists.
CREATE TABLE IF NOT EXISTS access_code_policy (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO access_code_policy (id,enabled,updated_at) VALUES (1,1,0);

CREATE TABLE IF NOT EXISTS access_codes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  duration_mode TEXT NOT NULL CHECK (duration_mode IN ('activation','first_use','fixed','none')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  fixed_expires_at INTEGER,
  expires_at INTEGER,
  activated_at INTEGER,
  first_used_at INTEGER,
  max_uses INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_codes_created ON access_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON access_codes(code_hash);
