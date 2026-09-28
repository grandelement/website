CREATE TABLE IF NOT EXISTS qr_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scanned_at TEXT NOT NULL,
  campaign TEXT,
  ip TEXT,
  country TEXT,
  region TEXT,
  region_code TEXT,
  city TEXT,
  postal_code TEXT,
  continent TEXT,
  timezone TEXT,
  latitude TEXT,
  longitude TEXT,
  metro_code TEXT,
  colo TEXT,
  asn TEXT,
  as_organization TEXT,
  user_agent TEXT,
  accept_language TEXT,
  referer TEXT,
  cf_ray TEXT
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_time ON qr_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_campaign ON qr_scans(campaign);
CREATE INDEX IF NOT EXISTS idx_qr_scans_country ON qr_scans(country);
CREATE INDEX IF NOT EXISTS idx_qr_scans_region ON qr_scans(region);
CREATE INDEX IF NOT EXISTS idx_qr_scans_city ON qr_scans(city);
