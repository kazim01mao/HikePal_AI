-- Track when a team hike is completed
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;
