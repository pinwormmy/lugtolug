CREATE TABLE IF NOT EXISTS submission_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  last_submitted_at TEXT NOT NULL
);
