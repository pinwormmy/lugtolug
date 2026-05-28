ALTER TABLE watches RENAME TO watches_legacy_optional_fields;

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
  case_mm REAL,
  thickness_mm REAL,
  lug_width_mm REAL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO watches
SELECT * FROM watches_legacy_optional_fields;

DROP TABLE watches_legacy_optional_fields;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watches_slugs ON watches (brand_slug, model_slug, reference_slug);
CREATE INDEX IF NOT EXISTS idx_watches_search ON watches (search_text);
CREATE INDEX IF NOT EXISTS idx_watches_brand ON watches (brand_slug);
