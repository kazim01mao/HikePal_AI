-- Add image_url to emotion_notes table
ALTER TABLE public.team_member_emotions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create a new table for images associated with uploaded_routes
CREATE TABLE IF NOT EXISTS public.uploaded_route_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_route_id UUID NOT NULL REFERENCES public.uploaded_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_route_id ON public.uploaded_route_images(uploaded_route_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_user_id ON public.uploaded_route_images(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_route_images_geo ON public.uploaded_route_images(latitude, longitude);

ALTER TABLE public.uploaded_route_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public uploaded route images readable" ON public.uploaded_route_images
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own uploaded route images" ON public.uploaded_route_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own uploaded route images" ON public.uploaded_route_images
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own uploaded route images" ON public.uploaded_route_images
  FOR DELETE USING (auth.uid() = user_id);