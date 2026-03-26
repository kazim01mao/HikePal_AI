-- Community route reviews for uploaded routes

CREATE TABLE IF NOT EXISTS public.uploaded_route_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_route_id UUID NOT NULL REFERENCES public.uploaded_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (uploaded_route_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_uploaded_route_reviews_route_created
  ON public.uploaded_route_reviews(uploaded_route_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_route_reviews_user
  ON public.uploaded_route_reviews(user_id);

ALTER TABLE public.uploaded_route_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploaded_route_reviews_public_read ON public.uploaded_route_reviews;
CREATE POLICY uploaded_route_reviews_public_read ON public.uploaded_route_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS uploaded_route_reviews_insert_own ON public.uploaded_route_reviews;
CREATE POLICY uploaded_route_reviews_insert_own ON public.uploaded_route_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS uploaded_route_reviews_update_own ON public.uploaded_route_reviews;
CREATE POLICY uploaded_route_reviews_update_own ON public.uploaded_route_reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS uploaded_route_reviews_delete_own ON public.uploaded_route_reviews;
CREATE POLICY uploaded_route_reviews_delete_own ON public.uploaded_route_reviews
  FOR DELETE USING (user_id = auth.uid());
