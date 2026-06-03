
CREATE POLICY "members upload capsule media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'capsule-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.capsule_can_upload(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "members read revealed capsule media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'capsule-media'
  AND public.is_capsule_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND public.is_capsule_revealed(((storage.foldername(name))[1])::uuid)
);
