ALTER TABLE watches RENAME TO watches_legacy;

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
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO watches (
  id,
  brand,
  model,
  reference,
  brand_slug,
  model_slug,
  reference_slug,
  search_text,
  lug_to_lug_mm,
  case_mm,
  thickness_mm,
  lug_width_mm,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  brand,
  model,
  reference,
  brand_slug,
  model_slug,
  reference_slug,
  search_text,
  lug_to_lug_mm,
  case_mm,
  thickness_mm,
  lug_width_mm,
  status,
  created_at,
  updated_at
FROM watches_legacy;

DROP TABLE watches_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watches_slugs ON watches (brand_slug, model_slug, reference_slug);
CREATE INDEX IF NOT EXISTS idx_watches_search ON watches (search_text);
CREATE INDEX IF NOT EXISTS idx_watches_brand ON watches (brand_slug);
