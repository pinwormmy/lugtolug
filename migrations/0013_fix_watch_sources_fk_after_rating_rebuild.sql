-- Migration 0009 renamed `watches` to `watches_legacy` while rebuilding it.
-- SQLite rewrites REFERENCES clauses in other tables to follow a rename, so
-- `watch_sources.watch_id` ended up pointing at `watches_legacy`, which 0009
-- then dropped. With foreign keys enforced every INSERT into watch_sources
-- fails with "no such table: main.watches_legacy". Rebuild the table with the
-- constraint pointing at `watches` again, the same way 0006 repaired the
-- identical breakage left by 0005. Harmless where the constraint is already
-- correct.

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

-- Dropping the renamed table also dropped the read-path index from 0012.
CREATE INDEX IF NOT EXISTS idx_watch_sources_watch ON watch_sources (watch_id);
