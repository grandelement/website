PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vault_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fans (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  consent_analytics INTEGER NOT NULL DEFAULT 0,
  consent_contact INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS listener_events (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  fan_id TEXT,
  anon_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  track_id TEXT,
  track_title TEXT,
  playlist_id TEXT,
  ip_hash TEXT,
  ip_ciphertext TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  cf_colo TEXT,
  cf_asn INTEGER,
  cf_as_org TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (fan_id) REFERENCES fans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fan_events (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  fan_id TEXT,
  anon_id TEXT,
  session_id TEXT,
  surface TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_url TEXT,
  page_path TEXT,
  track_id TEXT,
  track_title TEXT,
  album TEXT,
  playlist_id TEXT,
  share_target TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  ip_hash TEXT,
  ip_ciphertext TEXT,
  user_agent TEXT,
  language TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  cf_colo TEXT,
  cf_asn INTEGER,
  cf_as_org TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (fan_id) REFERENCES fans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  fan_id TEXT,
  anon_id TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  ip_hash TEXT,
  ip_ciphertext TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (fan_id) REFERENCES fans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  track_path TEXT NOT NULL,
  track_title TEXT,
  album TEXT,
  PRIMARY KEY (playlist_id, position),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vault_values (
  kind TEXT NOT NULL CHECK (kind IN ('setting','location','instruction')),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value_text TEXT,
  value_json TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  sensitivity TEXT NOT NULL DEFAULT 'private',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, scope, key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fans_last_seen ON fans(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_listener_events_time ON listener_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_listener_events_ip_hash ON listener_events(ip_hash);
CREATE INDEX IF NOT EXISTS idx_listener_events_anon ON listener_events(anon_id);
CREATE INDEX IF NOT EXISTS idx_comments_time ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_updated ON playlists(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_values_scope ON vault_values(kind, scope, key);

INSERT OR IGNORE INTO vault_meta(key,value,updated_at)
VALUES ('schema_version','2',unixepoch());

CREATE INDEX IF NOT EXISTS idx_comments_source ON comments(source, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_anon_source ON comments(anon_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fan_events_time ON fan_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_events_anon ON fan_events(anon_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_events_type ON fan_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_events_surface ON fan_events(surface, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fan_events_ip_hash ON fan_events(ip_hash, occurred_at DESC);
