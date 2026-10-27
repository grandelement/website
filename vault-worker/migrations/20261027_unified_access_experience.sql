-- GE Studios Vault additive migration: existing D1 rows are never replaced.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS access_code_experience (
  code_id TEXT PRIMARY KEY,
  games_enabled INTEGER NOT NULL DEFAULT 1,
  autopilot_enabled INTEGER NOT NULL DEFAULT 1,
  radio_playlist_id TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS fan_code_links (
  fan_id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  FOREIGN KEY(fan_id) REFERENCES fans(id) ON DELETE CASCADE,
  FOREIGN KEY(code_id) REFERENCES access_codes(id)
);
CREATE INDEX IF NOT EXISTS idx_fan_code_links_code_id ON fan_code_links(code_id);
