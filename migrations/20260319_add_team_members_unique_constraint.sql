-- Ensure a user can join a team only once
ALTER TABLE team_members
ADD CONSTRAINT IF NOT EXISTS unique_team_member UNIQUE (team_id, user_id);
