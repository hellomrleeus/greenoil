CREATE TABLE restaurants (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL CHECK(json_valid(data)),
 name TEXT GENERATED ALWAYS AS (json_extract(data,'$.name')) STORED,
 name_key TEXT GENERATED ALWAYS AS (lower(trim(json_extract(data,'$.name')))) STORED,
 latitude REAL GENERATED ALWAYS AS (CASE WHEN json_extract(data,'$.latitude') IS NOT NULL AND trim(json_extract(data,'$.latitude')) != '' THEN CAST(json_extract(data,'$.latitude') AS REAL) END) STORED,
 longitude REAL GENERATED ALWAYS AS (CASE WHEN json_extract(data,'$.longitude') IS NOT NULL AND trim(json_extract(data,'$.longitude')) != '' THEN CAST(json_extract(data,'$.longitude') AS REAL) END) STORED,
 region TEXT GENERATED ALWAYS AS (coalesce(json_extract(data,'$.region'),'')) STORED,
 rating REAL GENERATED ALWAYS AS (coalesce(CAST(json_extract(data,'$.rating') AS REAL),0)) STORED,
 reviews INTEGER GENERATED ALWAYS AS (coalesce(CAST(json_extract(data,'$.reviews') AS INTEGER),0)) STORED,
 hub_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.hubId')) STORED
);
CREATE INDEX restaurants_lat_lng ON restaurants(latitude,longitude);
CREATE INDEX restaurants_region_rating ON restaurants(region,rating DESC,reviews DESC,id);
CREATE INDEX restaurants_rating ON restaurants(rating DESC,reviews DESC,id);
CREATE INDEX restaurants_reviews ON restaurants(reviews DESC,id);
CREATE INDEX restaurants_name ON restaurants(name,id);
CREATE INDEX restaurants_name_key ON restaurants(name_key);
CREATE INDEX restaurants_hub ON restaurants(hub_id);
CREATE TABLE sales (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL CHECK(json_valid(data)),
 restaurant_id TEXT GENERATED ALWAYS AS (lower(trim(json_extract(data,'$.restaurantId')))) STORED,
 restaurant_name TEXT GENERATED ALWAYS AS (lower(trim(json_extract(data,'$.restaurantName')))) STORED,
 visit_time TEXT GENERATED ALWAYS AS (json_extract(data,'$.visitTime')) STORED,
 outcome TEXT GENERATED ALWAYS AS (json_extract(data,'$.outcome')) STORED
);
CREATE INDEX sales_restaurant ON sales(restaurant_id,visit_time DESC,id);
CREATE INDEX sales_name ON sales(restaurant_name,visit_time DESC,id);
CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
