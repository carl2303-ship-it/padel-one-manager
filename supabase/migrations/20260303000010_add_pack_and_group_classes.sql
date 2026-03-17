/*
  # Add Pack and Group Classes Support
  
  This migration adds support for:
  1. Pack classes (5 and 10 lessons)
  2. Group classes (2, 3, 4 players, 1x/2x/3x per week, 60/90 min)
  3. Lesson completion tracking for packs (checkmarks)
*/

-- Add new fields to class_types
ALTER TABLE class_types 
ADD COLUMN IF NOT EXISTS class_category text NOT NULL DEFAULT 'single' 
  CHECK (class_category IN ('single', 'pack', 'group'));

ALTER TABLE class_types 
ADD COLUMN IF NOT EXISTS pack_size integer;

ALTER TABLE class_types 
ADD COLUMN IF NOT EXISTS group_size integer;

ALTER TABLE class_types 
ADD COLUMN IF NOT EXISTS frequency_per_week integer;

ALTER TABLE class_types 
ADD COLUMN IF NOT EXISTS monthly_price_per_player decimal(10,2);

COMMENT ON COLUMN class_types.class_category IS 'single: aula pontual, pack: pack de aulas (5 ou 10), group: aula de grupo';
COMMENT ON COLUMN class_types.pack_size IS 'Número de aulas no pack (5 ou 10) - apenas para class_category = pack';
COMMENT ON COLUMN class_types.group_size IS 'Número de jogadores no grupo (2, 3 ou 4) - apenas para class_category = group';
COMMENT ON COLUMN class_types.frequency_per_week IS 'Frequência por semana (1, 2 ou 3) - apenas para class_category = group';
COMMENT ON COLUMN class_types.monthly_price_per_player IS 'Preço mensal por jogador - apenas para class_category = group';

-- Add field to track group class series
ALTER TABLE club_classes 
ADD COLUMN IF NOT EXISTS group_series_id uuid;

ALTER TABLE club_classes 
ADD COLUMN IF NOT EXISTS series_week_number integer;

COMMENT ON COLUMN club_classes.group_series_id IS 'ID da série de aulas de grupo (mesmo group_series_id = mesma série)';
COMMENT ON COLUMN club_classes.series_week_number IS 'Número da semana na série (1, 2, 3, 4)';

-- Create table for pack purchases
CREATE TABLE IF NOT EXISTS pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_type_id uuid NOT NULL REFERENCES class_types(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_phone text,
  student_email text,
  organizer_player_id uuid REFERENCES organizer_players(id) ON DELETE SET NULL,
  member_subscription_id uuid REFERENCES member_subscriptions(id) ON DELETE SET NULL,
  pack_size integer NOT NULL,
  price_paid decimal(10,2) NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club owners can manage pack purchases" ON pack_purchases;
CREATE POLICY "Club owners can manage pack purchases"
  ON pack_purchases
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

-- Create table for lesson completions (checkmarks)
CREATE TABLE IF NOT EXISTS lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_purchase_id uuid NOT NULL REFERENCES pack_purchases(id) ON DELETE CASCADE,
  class_id uuid REFERENCES club_classes(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_purchase_id, class_id)
);

ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club owners can manage lesson completions" ON lesson_completions;
CREATE POLICY "Club owners can manage lesson completions"
  ON lesson_completions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pack_purchases
      WHERE pack_purchases.id = lesson_completions.pack_purchase_id
      AND pack_purchases.club_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pack_purchases
      WHERE pack_purchases.id = lesson_completions.pack_purchase_id
      AND pack_purchases.club_owner_id = auth.uid()
    )
  );

-- Add pack_purchase_id to club_classes (after pack_purchases table exists)
ALTER TABLE club_classes 
ADD COLUMN IF NOT EXISTS pack_purchase_id uuid REFERENCES pack_purchases(id) ON DELETE SET NULL;

COMMENT ON COLUMN club_classes.pack_purchase_id IS 'ID do pack de aulas associado - para ligar aulas individuais ao pack';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_club_classes_pack_purchase_id ON club_classes(pack_purchase_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_club_owner_id ON pack_purchases(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_class_type_id ON pack_purchases(class_type_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_organizer_player_id ON pack_purchases(organizer_player_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_member_subscription_id ON pack_purchases(member_subscription_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_pack_purchase_id ON lesson_completions(pack_purchase_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_class_id ON lesson_completions(class_id);

-- Function to get remaining lessons in a pack
CREATE OR REPLACE FUNCTION get_pack_remaining_lessons(pack_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE(pp.pack_size, 0) - COUNT(lc.id)
  FROM pack_purchases pp
  LEFT JOIN lesson_completions lc ON lc.pack_purchase_id = pp.id
  WHERE pp.id = pack_id
    AND pp.is_active = true
  GROUP BY pp.id, pp.pack_size;
$$;
