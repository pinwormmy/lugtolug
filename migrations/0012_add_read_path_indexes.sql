-- Read-path indexes so page renders stop scanning whole tables
-- (bot crawls were exhausting the D1 free-tier rows_read quota).

-- hydrateSources: watch_sources lookups previously full-scanned the table
-- because 0006 rebuilt it without any index on watch_id.
CREATE INDEX IF NOT EXISTS idx_watch_sources_watch ON watch_sources (watch_id);

-- listRecent*/listAdminWatches: serve "approved, newest first" from the index.
CREATE INDEX IF NOT EXISTS idx_watches_status_updated ON watches (status, updated_at, id);

-- listSuppressedSeedMatches: the non-approved remainder is tiny (~130 rows),
-- so a partial index turns its per-page full scan into a direct lookup.
CREATE INDEX IF NOT EXISTS idx_watches_non_approved ON watches (brand_slug) WHERE status != 'approved';
