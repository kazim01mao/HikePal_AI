-- Upgrade schema for route binding with official_trails_backend model
-- Keep all emoji/photo data in profile_track_* tables only.

ALTER TABLE public.profile_track_route_contexts
  ADD COLUMN IF NOT EXISTS official_route_id UUID REFERENCES public.official_trails_backend(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS official_route_name TEXT,
  ADD COLUMN IF NOT EXISTS official_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS official_difficulty TEXT,
  ADD COLUMN IF NOT EXISTS official_segment_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS route_match_method TEXT;

CREATE INDEX IF NOT EXISTS idx_profile_track_route_contexts_official_route_id
  ON public.profile_track_route_contexts(official_route_id);

COMMENT ON COLUMN public.profile_track_route_contexts.route_id IS 'Source route id captured at save time (may come from multiple route sources).';
COMMENT ON COLUMN public.profile_track_route_contexts.official_route_id IS 'Resolved route id from official_trails_backend when matched.';
COMMENT ON COLUMN public.profile_track_route_contexts.official_segment_ids IS 'Ordered segment ids from official_connection_backend for the matched official route.';
COMMENT ON COLUMN public.profile_track_route_contexts.route_match_method IS 'How route matching was performed: official_id | official_name_exact | official_name_fuzzy | unmatched.';
