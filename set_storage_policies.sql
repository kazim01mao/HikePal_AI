-- SQL script to set storage bucket policies for emotion-images bucket
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/sql

-- First, let's check if the bucket exists
SELECT * FROM storage.buckets WHERE name = 'emotion-images';

-- If the bucket doesn't exist, create it
-- Note: You may need to create the bucket via the UI or API first

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Allow public read access (anyone can view images)
-- This policy allows anyone to read objects from the emotion-images bucket
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'emotion-images');

-- 2. INSERT policy: Allow authenticated users to upload images
-- This policy allows authenticated users to upload files to the emotion-images bucket
CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'emotion-images' 
    AND auth.role() = 'authenticated'
  );

-- 3. UPDATE policy: Allow authenticated users to update their own files
-- This policy allows authenticated users to update files they own
CREATE POLICY "Authenticated Update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'emotion-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. DELETE policy: Allow authenticated users to delete their own files
-- This policy allows authenticated users to delete files they own
CREATE POLICY "Authenticated Delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'emotion-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Alternative: Simpler policies if you don't need per-user ownership
-- Uncomment these if you want simpler policies:

-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
--   FOR ALL
--   USING (bucket_id = 'emotion-images' AND auth.role() = 'authenticated')
--   WITH CHECK (bucket_id = 'emotion-images' AND auth.role() = 'authenticated');

-- CREATE POLICY "Allow public reads" ON storage.objects
--   FOR SELECT
--   USING (bucket_id = 'emotion-images');

-- Check existing policies
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- List all policies for the emotion-images bucket
SELECT 
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.tablename = 'objects' 
  AND p.schemaname = 'storage'
  AND (p.qual::text LIKE '%emotion-images%' OR p.with_check::text LIKE '%emotion-images%')
ORDER BY p.policyname;