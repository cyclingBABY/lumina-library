INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-library', 'digital-library', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload digital files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'digital-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete digital files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'digital-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view digital files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'digital-library');