-- ==========================================================
-- Create user_tracks table for Supabase
-- Run this in the Supabase SQL Editor
-- ==========================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.user_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    duration TEXT,
    distance TEXT,
    coordinates JSONB, -- Storing array of [lat, lng]
    waypoints JSONB,   -- Storing array of Waypoint objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_tracks ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow users to view their own tracks
CREATE POLICY "Users can view own tracks" ON public.user_tracks
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own tracks
CREATE POLICY "Users can insert own tracks" ON public.user_tracks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own tracks
CREATE POLICY "Users can delete own tracks" ON public.user_tracks
    FOR DELETE USING (auth.uid() = user_id);
