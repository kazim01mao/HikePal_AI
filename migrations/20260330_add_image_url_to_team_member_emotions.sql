-- Add image_url column to team_member_emotions table for SQLite
-- This migration adds support for images in emotion notes

-- Check if the column exists before adding it
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM pragma_table_info('team_member_emotions') WHERE name = 'image_url') 
    THEN 1 
    ELSE 0 
END;

-- If the column doesn't exist, add it
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll need to handle this in application code or use a different approach

-- For SQLite, we need to create a new table with the column and copy data
-- This is a more complex operation that should be done carefully

-- Alternative approach: Use a try-catch in application code
-- The CompanionView.tsx already handles missing image_url column gracefully

-- For now, we'll create a simple migration that can be run manually
-- if the table doesn't have the column

-- To manually add the column in SQLite:
-- ALTER TABLE team_member_emotions ADD COLUMN image_url TEXT;

-- Also create uploaded_route_images table for SQLite
CREATE TABLE IF NOT EXISTS uploaded_route_images (
  id TEXT PRIMARY KEY,
  uploaded_route_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  caption TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_route_id) REFERENCES uploaded_routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_route_id ON uploaded_route_images(uploaded_route_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_user_id ON uploaded_route_images(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_geo ON uploaded_route_images(latitude, longitude);