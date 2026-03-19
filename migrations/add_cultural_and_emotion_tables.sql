-- HikePal AI Migration: Cultural Info, Facilities, and Emotion Notes
-- Created: 2026-03-11

-- 1. Emotion Notes Table (for hikers to leave memories and feelings)
CREATE TABLE IF NOT EXISTS emotion_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  content TEXT NOT NULL,
  sentiment VARCHAR(50), -- neutral, happy, tired, etc.
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Cultural Info Table (historical and cultural scenes along the trail)
CREATE TABLE IF NOT EXISTS cultural_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  tags JSONB, -- ["history", "temple", "monument"]
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Facilities Table (toilets, water points, rest areas)
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- "toilet", "water", "pavilion", "store"
  description TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Ensure columns exist if table already existed
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. No Network Zones Table (areas with poor cellular signal)
CREATE TABLE IF NOT EXISTS no_network_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  radius_m FLOAT DEFAULT 50, -- size of the zone
  length_m FLOAT, -- estimated walking distance without signal
  created_at TIMESTAMP DEFAULT now()
);

-- Indexing for geo-queries
CREATE INDEX IF NOT EXISTS idx_emotion_notes_geo ON emotion_notes(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cultural_info_geo ON cultural_info(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_facilities_geo ON facilities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_no_network_geo ON no_network_zones(latitude, longitude);

-- Enable RLS
ALTER TABLE emotion_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultural_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_network_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view emotion notes" ON emotion_notes;
CREATE POLICY "Anyone can view emotion notes" ON emotion_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own notes" ON emotion_notes;
CREATE POLICY "Users can insert their own notes" ON emotion_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can view cultural info" ON cultural_info;
CREATE POLICY "Anyone can view cultural info" ON cultural_info FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can view facilities" ON facilities;
CREATE POLICY "Anyone can view facilities" ON facilities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can view no network zones" ON no_network_zones;
CREATE POLICY "Anyone can view no network zones" ON no_network_zones FOR SELECT USING (true);

-- Sample Data (Dragon's Back area)
INSERT INTO cultural_info (name, description, latitude, longitude, tags) VALUES
('Dragon''s Back Ridge', 'Named for its undulating profile, this ridge offers one of the best coastal views in Hong Kong.', 22.2315, 114.2415, '["scenic", "landmark"]'),
('Stanley Military Cemetery', 'Historical site commemorating victims from WWII.', 22.2185, 114.2150, '["history", "culture"]');

INSERT INTO facilities (name, type, description, latitude, longitude) VALUES
('Shek O Road Toilet', 'toilet', 'Public restrooms near the start of the trail.', 22.2243, 114.2343),
('Big Wave Bay Refreshments', 'store', 'Small cafes and shops near the beach.', 22.2450, 114.2580);

INSERT INTO no_network_zones (latitude, longitude, length_m) VALUES
(22.2260, 114.2360, 300);
