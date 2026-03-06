-- ============================================================================
-- Households & Household Members tables
-- Enables multi-member family sharing (invite-by-email)
-- ============================================================================

-- ── households ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS households (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL DEFAULT 'My Household',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Members can read their own household
CREATE POLICY "household_select_own"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR created_by = auth.uid()
  );

-- Creator can insert
CREATE POLICY "household_insert_own"
  ON households FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Creator can update
CREATE POLICY "household_update_own"
  ON households FOR UPDATE
  USING (created_by = auth.uid());

-- ── household_members ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS household_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role           text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invited_email  text,
  display_name   text,
  invited_at     timestamptz NOT NULL DEFAULT now(),
  joined_at      timestamptz,

  -- Prevent duplicate invites for the same email in the same household
  UNIQUE (household_id, invited_email)
);

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Users can read members of their own household
CREATE POLICY "hm_select_own_household"
  ON household_members FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members AS hm2
      WHERE hm2.user_id = auth.uid() AND hm2.status = 'active'
    )
    OR user_id = auth.uid()
  );

-- Admin can insert members (invite)
CREATE POLICY "hm_insert_admin"
  ON household_members FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members AS hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- Admin can update members
CREATE POLICY "hm_update_admin"
  ON household_members FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members AS hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- Admin can delete members
CREATE POLICY "hm_delete_admin"
  ON household_members FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members AS hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- Allow users to update their own membership (e.g., accept invite)
CREATE POLICY "hm_update_self"
  ON household_members FOR UPDATE
  USING (user_id = auth.uid());

-- Allow invited users to claim their pending invite by matching email
CREATE POLICY "hm_claim_pending_invite"
  ON household_members FOR UPDATE
  USING (
    status = 'pending'
    AND invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_household_members_user_id ON household_members(user_id);
CREATE INDEX idx_household_members_household_id ON household_members(household_id);
CREATE INDEX idx_household_members_invited_email ON household_members(invited_email);
