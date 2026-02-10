-- Adicionar novos campos ao perfil do jogador
ALTER TABLE player_accounts 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS preferred_hand TEXT CHECK (preferred_hand IN ('right', 'left', 'ambidextrous')),
ADD COLUMN IF NOT EXISTS court_position TEXT CHECK (court_position IN ('right', 'left', 'both')),
ADD COLUMN IF NOT EXISTS game_type TEXT CHECK (game_type IN ('competitive', 'friendly', 'both')),
ADD COLUMN IF NOT EXISTS preferred_time TEXT CHECK (preferred_time IN ('morning', 'afternoon', 'evening', 'all_day')),
ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Comentários explicativos
COMMENT ON COLUMN player_accounts.avatar_url IS 'URL da foto de perfil do jogador (max 1MB)';
COMMENT ON COLUMN player_accounts.location IS 'Localização do jogador (cidade, país)';
COMMENT ON COLUMN player_accounts.birth_date IS 'Data de nascimento';
COMMENT ON COLUMN player_accounts.gender IS 'Género: male, female, other';
COMMENT ON COLUMN player_accounts.bio IS 'Descrição/bio do jogador';
COMMENT ON COLUMN player_accounts.preferred_hand IS 'Mão preferida: right, left, ambidextrous';
COMMENT ON COLUMN player_accounts.court_position IS 'Posição no campo: right, left, both';
COMMENT ON COLUMN player_accounts.game_type IS 'Tipo de jogos: competitive, friendly, both';
COMMENT ON COLUMN player_accounts.preferred_time IS 'Horário preferido: morning, afternoon, evening, all_day';
COMMENT ON COLUMN player_accounts.availability IS 'Disponibilidade por dia da semana (JSON)';
COMMENT ON COLUMN player_accounts.profile_completed IS 'Indica se o perfil está completo';

-- Criar bucket para avatares se não existir (executar no Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Política para permitir upload de avatares
-- CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
