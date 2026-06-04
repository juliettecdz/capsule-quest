DROP POLICY IF EXISTS "admin or self add member" ON public.capsule_members;
CREATE POLICY "admin add member" ON public.capsule_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_capsule_admin(capsule_id, auth.uid()));