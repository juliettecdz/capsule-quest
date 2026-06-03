
CREATE TYPE public.capsule_type AS ENUM ('standard', 'transformation', 'individual');
CREATE TYPE public.capsule_status AS ENUM ('active', 'sealed', 'revealed');
CREATE TYPE public.media_kind AS ENUM ('photo', 'video', 'voice');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type public.capsule_type NOT NULL DEFAULT 'standard',
  cover_url TEXT,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unlock_at TIMESTAMPTZ NOT NULL,
  max_uploads INT NOT NULL DEFAULT 50,
  status public.capsule_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.capsule_members (
  capsule_id UUID NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (capsule_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.media_kind NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.album_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capsule_id UUID NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  style TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants (no DELETE on media_items, ever)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.capsules TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.capsule_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.media_items TO authenticated;
GRANT SELECT, INSERT ON public.album_feedback TO authenticated;
GRANT ALL ON public.profiles, public.capsules, public.capsule_members, public.messages, public.media_items, public.album_feedback TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsule_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_feedback ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_capsule_member(_capsule UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.capsule_members WHERE capsule_id = _capsule AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_capsule_admin(_capsule UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.capsules WHERE id = _capsule AND admin_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_capsule_revealed(_capsule UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.capsules
    WHERE id = _capsule AND (status = 'revealed' OR unlock_at <= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.capsule_can_upload(_capsule UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.capsules c
    WHERE c.id = _capsule
      AND c.status = 'active'
      AND c.unlock_at > now()
      AND public.is_capsule_member(_capsule, _user)
      AND (SELECT COUNT(*) FROM public.media_items m WHERE m.capsule_id = _capsule AND m.user_id = _user) < c.max_uploads
  );
$$;

-- Policies
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "members read capsules" ON public.capsules FOR SELECT TO authenticated
  USING (public.is_capsule_member(id, auth.uid()) OR admin_id = auth.uid());
CREATE POLICY "create capsules" ON public.capsules FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid());
CREATE POLICY "admin update capsule" ON public.capsules FOR UPDATE TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "members see members" ON public.capsule_members FOR SELECT TO authenticated
  USING (public.is_capsule_member(capsule_id, auth.uid()));
CREATE POLICY "admin or self add member" ON public.capsule_members FOR INSERT TO authenticated
  WITH CHECK (public.is_capsule_admin(capsule_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_capsule_member(capsule_id, auth.uid()));
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_capsule_member(capsule_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "members read revealed media" ON public.media_items FOR SELECT TO authenticated
  USING (public.is_capsule_member(capsule_id, auth.uid()) AND public.is_capsule_revealed(capsule_id));
CREATE POLICY "members upload media" ON public.media_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.capsule_can_upload(capsule_id, auth.uid()));

CREATE POLICY "read own feedback" ON public.album_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own feedback" ON public.album_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Notification view: exposes only id/capsule_id/user_id/created_at to members (no file_path or kind leak during active phase)
CREATE OR REPLACE VIEW public.media_notifications
WITH (security_invoker = true) AS
SELECT m.id, m.capsule_id, m.user_id, m.created_at
FROM public.media_items m
WHERE public.is_capsule_member(m.capsule_id, auth.uid());
GRANT SELECT ON public.media_notifications TO authenticated;

-- Immutability trigger
CREATE OR REPLACE FUNCTION public.enforce_capsule_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.unlock_at IS DISTINCT FROM OLD.unlock_at THEN RAISE EXCEPTION 'unlock_at is immutable'; END IF;
  IF NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN RAISE EXCEPTION 'admin_id is immutable'; END IF;
  IF NEW.type IS DISTINCT FROM OLD.type THEN RAISE EXCEPTION 'type is immutable'; END IF;
  IF OLD.status = 'revealed' AND NEW.status <> 'revealed' THEN RAISE EXCEPTION 'cannot un-reveal'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER capsule_immutability BEFORE UPDATE ON public.capsules
FOR EACH ROW EXECUTE FUNCTION public.enforce_capsule_immutability();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, 'user'), '@', 1) || '_' || substr(NEW.id::text, 1, 4)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.capsules;
