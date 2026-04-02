-- Simple SQL script to set storage bucket policies for emotion-images bucket
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/sql

-- First, check if the bucket exists
SELECT name, public FROM storage.buckets WHERE name = 'emotion-images';

-- If the bucket doesn't exist, you need to create it first via the UI or API
-- The bucket was already created via the Python script, so it should exist

-- Drop existing policies for the emotion-images bucket to avoid conflicts
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Option 1: Simple policies (recommended for most use cases)
-- This allows authenticated users to do everything and public to read

-- 1. Allow public to read from emotion-images bucket
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT
USING (bucket_id = 'emotion-images');

-- 2. Allow authenticated users to insert into emotion-images bucket
CREATE POLICY "Allow authenticated inserts" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'emotion-images' 
  AND auth.role() = 'authenticated'
);

-- 3. Allow authenticated users to update their own files
-- Files are stored in user-specific folders: {user_id}/{filename}
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'emotion-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'emotion-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Option 2: Even simpler - allow all authenticated operations
-- Uncomment if you want a simpler setup (less secure)

-- CREATE POLICY "Allow all authenticated operations" ON storage.objects
-- FOR ALL
-- USING (
--   bucket_id = 'emotion-images' 
--   AND auth.role() = 'authenticated'
-- )
-- WITH CHECK (
--   bucket_id = 'emotion-images' 
--   AND auth.role() = 'authenticated'
-- );

-- CREATE POLICY "Allow public reads" ON storage.objects
-- FOR SELECT
-- USING (bucket_id = 'emotion-images');

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (qual::text LIKE '%emotion-images%' OR with_check::text LIKE '%emotion-images%' OR policyname LIKE '%emotion%')
ORDER BY policyname;

-- Test query to verify public read access works
-- This should return data if the bucket has files
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'emotion-images'
LIMIT 5;

-- Note: If you get permission errors, make sure:
-- 1. The bucket exists and is public
-- 2. RLS is enabled on storage.objects
-- 3. The policies are correctly applied
-- 4. You're using the correct bucket_id ('emotion-images')