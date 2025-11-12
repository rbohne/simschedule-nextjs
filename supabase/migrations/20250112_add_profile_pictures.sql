-- Add profile_picture_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for profile pictures

-- Allow authenticated users to view all profile pictures
CREATE POLICY "Allow public read access to profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');

-- Allow admins to upload profile pictures
CREATE POLICY "Allow admins to upload profile pictures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

-- Allow admins to update profile pictures
CREATE POLICY "Allow admins to update profile pictures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

-- Allow admins to delete profile pictures
CREATE POLICY "Allow admins to delete profile pictures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);
