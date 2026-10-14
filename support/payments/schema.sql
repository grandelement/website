-- Store only merchant order data; do NOT store seeds, wallet keys, or payment tokens here.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('initializing','awaiting_payment','processing','paid_unfulfilled','fulfilled','invalid','expired','setup_error')),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_cents INTEGER NOT NULL,
  email TEXT NOT NULL,
  items_json TEXT NOT NULL,
  access_hash TEXT NOT NULL,
  invoice_id TEXT UNIQUE,
  checkout_url TEXT,
  fulfilled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON orders(invoice_id);
