-- Scope emotion notes to a specific route context.
-- This prevents notes from leaking into unrelated map sessions.

ALTER TABLE public.team_member_emotions
  ADD COLUMN IF NOT EXISTS route_id TEXT;

CREATE INDEX IF NOT EXISTS idx_team_member_emotions_route_created_at
  ON public.team_member_emotions(route_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_member_emotions_team_route_created_at
  ON public.team_member_emotions(team_id, route_id, created_at DESC);
