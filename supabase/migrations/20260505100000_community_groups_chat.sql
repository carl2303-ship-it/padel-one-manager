-- ============================================
-- Community Groups: Chat, Invites, Reactions
-- ============================================

-- Ensure base tables exist (idempotent)
CREATE TABLE IF NOT EXISTS community_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Add is_active to community_groups if missing
DO $$ BEGIN
  ALTER TABLE community_groups ADD COLUMN is_active boolean DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================
-- community_group_invites
-- ============================================
CREATE TABLE IF NOT EXISTS community_group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, invited_user_id, status)
);

ALTER TABLE community_group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group invites" ON community_group_invites;
CREATE POLICY "Members can view group invites" ON community_group_invites
  FOR SELECT USING (
    auth.uid() = invited_user_id
    OR auth.uid() = invited_by
    OR EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_group_invites.group_id
        AND community_group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can invite" ON community_group_invites;
CREATE POLICY "Admins can invite" ON community_group_invites
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_group_invites.group_id
        AND community_group_members.user_id = auth.uid()
        AND community_group_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Invited user can update invite" ON community_group_invites;
CREATE POLICY "Invited user can update invite" ON community_group_invites
  FOR UPDATE USING (auth.uid() = invited_user_id);

DROP POLICY IF EXISTS "Admins can delete invites" ON community_group_invites;
CREATE POLICY "Admins can delete invites" ON community_group_invites
  FOR DELETE USING (
    auth.uid() = invited_by
    OR auth.uid() = invited_user_id
  );

-- ============================================
-- community_group_messages
-- ============================================
CREATE TABLE IF NOT EXISTS community_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  image_url text,
  reply_to_message_id uuid REFERENCES community_group_messages(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'game', 'tournament', 'system')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON community_group_messages(group_id, created_at DESC);

ALTER TABLE community_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read messages" ON community_group_messages;
CREATE POLICY "Members can read messages" ON community_group_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_group_messages.group_id
        AND community_group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can send messages" ON community_group_messages;
CREATE POLICY "Members can send messages" ON community_group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_group_messages.group_id
        AND community_group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors and admins can delete messages" ON community_group_messages;
CREATE POLICY "Authors and admins can delete messages" ON community_group_messages
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_group_messages.group_id
        AND community_group_members.user_id = auth.uid()
        AND community_group_members.role = 'admin'
    )
  );

-- ============================================
-- community_group_message_reactions
-- ============================================
CREATE TABLE IF NOT EXISTS community_group_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES community_group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE community_group_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read reactions" ON community_group_message_reactions;
CREATE POLICY "Members can read reactions" ON community_group_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_group_messages m
      JOIN community_group_members mem ON mem.group_id = m.group_id
      WHERE m.id = community_group_message_reactions.message_id
        AND mem.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can add reactions" ON community_group_message_reactions;
CREATE POLICY "Members can add reactions" ON community_group_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_group_messages m
      JOIN community_group_members mem ON mem.group_id = m.group_id
      WHERE m.id = community_group_message_reactions.message_id
        AND mem.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON community_group_message_reactions;
CREATE POLICY "Users can remove own reactions" ON community_group_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Add group_id to open_games
-- ============================================
DO $$ BEGIN
  ALTER TABLE open_games ADD COLUMN group_id uuid REFERENCES community_groups(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================
-- Update RLS on community_groups (members-only read)
-- ============================================
DROP POLICY IF EXISTS "Anyone can read groups" ON community_groups;
CREATE POLICY "Members can read groups" ON community_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_group_members
      WHERE community_group_members.group_id = community_groups.id
        AND community_group_members.user_id = auth.uid()
    )
    OR auth.uid() = created_by
  );

-- Keep community_group_members readable by all authenticated users
-- (group-level access is controlled by community_groups RLS)
DROP POLICY IF EXISTS "Anyone can read members" ON community_group_members;
CREATE POLICY "Anyone can read members" ON community_group_members
  FOR SELECT USING (true);

-- Admins can remove members
DROP POLICY IF EXISTS "Admins can remove members" ON community_group_members;
CREATE POLICY "Admins can remove members" ON community_group_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM community_group_members AS admin_check
      WHERE admin_check.group_id = community_group_members.group_id
        AND admin_check.user_id = auth.uid()
        AND admin_check.role = 'admin'
    )
  );

-- Drop old permissive delete policy
DROP POLICY IF EXISTS "Members can leave" ON community_group_members;

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE community_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE community_group_message_reactions;
