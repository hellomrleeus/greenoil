CREATE TABLE IF NOT EXISTS new_restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  first_inspection_date TEXT NOT NULL,
  latest_inspection_date TEXT,
  latitude REAL,
  longitude REAL,
  phone TEXT,
  inspection_count INTEGER DEFAULT 1,
  status TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_new_rest_first_date ON new_restaurants(first_inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_new_rest_lat_lng ON new_restaurants(latitude, longitude);
