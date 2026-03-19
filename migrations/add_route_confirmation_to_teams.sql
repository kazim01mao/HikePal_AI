-- Migration script to add route confirmation columns to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS target_route_id UUID REFERENCES routes(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS target_route_name TEXT;

-- Ensure status column is compatible with 'confirmed' state
-- Note: 'confirmed' is a new state added for the teammate flow
COMMENT ON COLUMN teams.status IS 'planning, confirmed, hiking, completed';
