CREATE TABLE IF NOT EXISTS submission_rate_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_rate_events_ip_created
ON submission_rate_events (ip_hash, created_at);
