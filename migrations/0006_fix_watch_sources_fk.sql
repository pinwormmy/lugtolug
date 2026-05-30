ALTER TABLE watch_sources RENAME TO watch_sources_legacy_fk;

CREATE TABLE watch_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO watch_sources (id, watch_id, source_url, note, created_at)
SELECT id, watch_id, source_url, note, created_at
FROM watch_sources_legacy_fk;

DROP TABLE watch_sources_legacy_fk;
