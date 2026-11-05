-- Create a storage bucket for temporary PDF uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temp-uploads', 'temp-uploads', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

-- Allow authenticated users to upload to temp-uploads
CREATE POLICY "Authenticated users can upload temp files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'temp-uploads');

-- Allow authenticated users to read their uploads
CREATE POLICY "Authenticated users can read temp files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'temp-uploads');

-- Allow authenticated users to delete their temp files
CREATE POLICY "Authenticated users can delete temp files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'temp-uploads');