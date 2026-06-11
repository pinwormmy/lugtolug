CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  reference TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  reference_slug TEXT NOT NULL,
  search_text TEXT NOT NULL,
  lug_to_lug_mm REAL NOT NULL,
  case_mm REAL NOT NULL,
  thickness_mm REAL NOT NULL,
  lug_width_mm REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watches_slugs ON watches (brand_slug, model_slug, reference_slug);
CREATE INDEX IF NOT EXISTS idx_watches_search ON watches (search_text);
CREATE INDEX IF NOT EXISTS idx_watches_brand ON watches (brand_slug);

CREATE TABLE IF NOT EXISTS watch_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status, created_at);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions (token_hash);
