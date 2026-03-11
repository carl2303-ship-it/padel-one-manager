-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload menu images
CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- Allow authenticated users to update their menu images
CREATE POLICY "Authenticated users can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'menu-images');

-- Allow authenticated users to delete their menu images
CREATE POLICY "Authenticated users can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'menu-images');

-- Allow anyone to view menu images (public menu)
CREATE POLICY "Anyone can view menu images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated can view menu images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'menu-images');
