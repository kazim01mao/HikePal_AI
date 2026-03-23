-- Store a snapshot of the confirmed route so teammates see the exact same path
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS target_route_data JSONB;
