-- Ensure user_tracks has difficulty for reliable persistence after relogin
ALTER TABLE public.user_tracks
  ADD COLUMN IF NOT EXISTS difficulty INTEGER;

CREATE INDEX IF NOT EXISTS idx_user_tracks_user_date
  ON public.user_tracks(user_id, date DESC);
