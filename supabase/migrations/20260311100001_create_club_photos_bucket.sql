-- Create the club-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-photos', 'club-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to club-photos
CREATE POLICY "Authenticated users can upload club photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-photos');

-- Allow authenticated users to update their own club photos
CREATE POLICY "Authenticated users can update club photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'club-photos');

-- Allow public read access to club photos
CREATE POLICY "Public can view club photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'club-photos');

-- Allow authenticated users to delete their own club photos
CREATE POLICY "Authenticated users can delete club photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'club-photos');
