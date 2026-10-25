-- GE MUSIC library intake, additive and non-destructive.
-- Run once against EXISTING Vault D1 before enabling owner album uploads.
-- Uploads are private STAGED objects until deliberately reviewed and published.
CREATE TABLE IF NOT EXISTS music_assets (
  id TEXT PRIMARY KEY,
  album_folder TEXT NOT NULL,
  track_title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','reviewed','published','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_music_assets_album ON music_assets(album_folder,created_at);
CREATE INDEX IF NOT EXISTS idx_music_assets_status ON music_assets(status,created_at);
