CREATE TABLE IF NOT EXISTS site_visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_daily_visits (
  visitor_id TEXT NOT NULL REFERENCES site_visitors(visitor_id) ON DELETE CASCADE,
  visit_date TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visitor_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_site_daily_visits_date ON site_daily_visits (visit_date);
