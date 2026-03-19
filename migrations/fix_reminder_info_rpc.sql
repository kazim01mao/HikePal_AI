
-- Step 1: Drop the problematic view if it exists (it seems to be causing 406 or confusing the system)
DROP VIEW IF EXISTS routes_with_segments;

-- Step 2: Create the RPC function for reminder_info to handle binary coordinates
-- This function converts the geometry coordinates into GeoJSON format which the frontend can read.
CREATE OR REPLACE FUNCTION get_reminder_with_coords()
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  type TEXT,
  ai_prompt TEXT,
  risk_level INTEGER,
  geojson JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.category,
    r.type,
    r.ai_prompt,
    r.risk_level,
    st_asgeojson(r.coordinates)::jsonb as geojson
  FROM reminder_info r;
END;
$$;

-- Grant permissions for the RPC
GRANT EXECUTE ON FUNCTION get_reminder_with_coords() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reminder_with_coords() TO anon;
GRANT EXECUTE ON FUNCTION get_reminder_with_coords() TO service_role;

-- Step 3: Ensure RLS is enabled but permissive for the core backend tables (for demo purposes)
-- official_trails_backend
ALTER TABLE official_trails_backend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read official_trails_backend" ON official_trails_backend;
CREATE POLICY "Allow public read official_trails_backend" ON official_trails_backend FOR SELECT USING (true);

-- official_connection_backend
ALTER TABLE official_connection_backend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read official_connection_backend" ON official_connection_backend;
CREATE POLICY "Allow public read official_connection_backend" ON official_connection_backend FOR SELECT USING (true);

-- segments_backend
ALTER TABLE segments_backend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read segments_backend" ON segments_backend;
CREATE POLICY "Allow public read segments_backend" ON segments_backend FOR SELECT USING (true);

-- reminder_info
ALTER TABLE reminder_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read reminder_info" ON reminder_info;
CREATE POLICY "Allow public read reminder_info" ON reminder_info FOR SELECT USING (true);
