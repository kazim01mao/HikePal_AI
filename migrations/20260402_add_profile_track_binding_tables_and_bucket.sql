-- Save-to-Profile binding storage
-- Adds dedicated tables + bucket to persist:
-- 1) route shape snapshot
-- 2) route-related reminders snapshot
-- 3) emoji/photo markers tied to this saved track

-- 1) Dedicated storage bucket for profile-track media
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-track-media', 'profile-track-media', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ProfileTrackMedia Public Read" ON storage.objects;
DROP POLICY IF EXISTS "ProfileTrackMedia Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "ProfileTrackMedia Auth Update Own" ON storage.objects;
DROP POLICY IF EXISTS "ProfileTrackMedia Auth Delete Own" ON storage.objects;

CREATE POLICY "ProfileTrackMedia Public Read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-track-media');

CREATE POLICY "ProfileTrackMedia Auth Insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profile-track-media'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "ProfileTrackMedia Auth Update Own"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'profile-track-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-track-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "ProfileTrackMedia Auth Delete Own"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'profile-track-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2) One route-context snapshot per saved track
CREATE TABLE IF NOT EXISTS public.profile_track_route_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id TEXT,
  route_name TEXT,
  route_shape JSONB,
  related_reminders JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (track_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_track_route_contexts_user_id
  ON public.profile_track_route_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_track_route_contexts_track_id
  ON public.profile_track_route_contexts(track_id);

ALTER TABLE public.profile_track_route_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile track contexts own read" ON public.profile_track_route_contexts;
DROP POLICY IF EXISTS "Profile track contexts own insert" ON public.profile_track_route_contexts;
DROP POLICY IF EXISTS "Profile track contexts own update" ON public.profile_track_route_contexts;
DROP POLICY IF EXISTS "Profile track contexts own delete" ON public.profile_track_route_contexts;

CREATE POLICY "Profile track contexts own read"
ON public.profile_track_route_contexts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Profile track contexts own insert"
ON public.profile_track_route_contexts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profile track contexts own update"
ON public.profile_track_route_contexts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profile track contexts own delete"
ON public.profile_track_route_contexts
FOR DELETE
USING (auth.uid() = user_id);

-- 3) Marker rows (emoji/photo) tied to route-context + saved track
CREATE TABLE IF NOT EXISTS public.profile_track_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL REFERENCES public.profile_track_route_contexts(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT,
  note TEXT,
  image_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_track_markers_context_id
  ON public.profile_track_markers(context_id);
CREATE INDEX IF NOT EXISTS idx_profile_track_markers_track_id
  ON public.profile_track_markers(track_id);
CREATE INDEX IF NOT EXISTS idx_profile_track_markers_user_id
  ON public.profile_track_markers(user_id);

ALTER TABLE public.profile_track_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile track markers own read" ON public.profile_track_markers;
DROP POLICY IF EXISTS "Profile track markers own insert" ON public.profile_track_markers;
DROP POLICY IF EXISTS "Profile track markers own update" ON public.profile_track_markers;
DROP POLICY IF EXISTS "Profile track markers own delete" ON public.profile_track_markers;

CREATE POLICY "Profile track markers own read"
ON public.profile_track_markers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Profile track markers own insert"
ON public.profile_track_markers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profile track markers own update"
ON public.profile_track_markers
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profile track markers own delete"
ON public.profile_track_markers
FOR DELETE
USING (auth.uid() = user_id);
