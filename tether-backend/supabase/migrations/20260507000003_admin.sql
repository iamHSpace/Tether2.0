-- Admin and suspension flags for platform management
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- Admins can read all profiles (service role already bypasses RLS,
-- but this allows future admin Supabase client usage with anon key)
CREATE POLICY "admins_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );
