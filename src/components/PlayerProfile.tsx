import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';
import {
  User,
  Camera,
  MapPin,
  Calendar,
  Users,
  FileText,
  Hand,
  Target,
  Trophy,
  Clock,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface PlayerProfileData {
  id: string;
  name: string;
  email: string | null;
  phone_number: string;
  avatar_url: string | null;
  location: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  bio: string | null;
  preferred_hand: 'right' | 'left' | 'ambidextrous' | null;
  court_position: 'right' | 'left' | 'both' | null;
  game_type: 'competitive' | 'friendly' | 'both' | null;
  preferred_time: 'morning' | 'afternoon' | 'evening' | 'all_day' | null;
  availability: Record<string, { enabled: boolean; start: string; end: string }>;
  profile_completed: boolean;
}

interface PlayerProfileProps {
  onClose?: () => void;
  onAvatarChange?: (url: string | null) => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_AVAILABILITY = DAYS_OF_WEEK.reduce((acc, day) => ({
  ...acc,
  [day.key]: { enabled: false, start: '09:00', end: '21:00' }
}), {} as Record<string, { enabled: boolean; start: string; end: string }>);

export default function PlayerProfile({ onClose, onAvatarChange }: PlayerProfileProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'preferences' | 'availability'>('basic');

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    birth_date: '',
    gender: '' as string,
    bio: '',
    preferred_hand: '' as string,
    court_position: '' as string,
    game_type: '' as string,
    preferred_time: '' as string,
    availability: DEFAULT_AVAILABILITY
  });

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('player_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setFormData({
        name: data.name || '',
        location: data.location || '',
        birth_date: data.birth_date || '',
        gender: data.gender || '',
        bio: data.bio || '',
        preferred_hand: data.preferred_hand || '',
        court_position: data.court_position || '',
        game_type: data.game_type || '',
        preferred_time: data.preferred_time || '',
        availability: data.availability || DEFAULT_AVAILABILITY
      });
    }

    setLoading(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !profile?.id) return;

    // Verificar tamanho (max 1MB)
    if (file.size > 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 1MB' });
      return;
    }

    // Verificar tipo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor selecione uma imagem' });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from('player_accounts')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      onAvatarChange?.(avatarUrl);
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao carregar foto' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    setMessage(null);

    try {
      const updateData = {
        name: formData.name,
        location: formData.location || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        bio: formData.bio || null,
        preferred_hand: formData.preferred_hand || null,
        court_position: formData.court_position || null,
        game_type: formData.game_type || null,
        preferred_time: formData.preferred_time || null,
        availability: formData.availability,
        profile_completed: !!(formData.name && formData.location && formData.birth_date && formData.gender)
      };

      const { error } = await supabase
        .from('player_accounts')
        .update(updateData)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updateData } : null);
      setMessage({ type: 'success', text: 'Perfil guardado com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao guardar perfil' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvailabilityChange = (day: string, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8 text-gray-500">
        Perfil não encontrado
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
      {/* Header com foto */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 rounded-t-xl p-6">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div 
              onClick={handleAvatarClick}
              className="w-24 h-24 rounded-full bg-white/20 border-4 border-white overflow-hidden cursor-pointer hover:opacity-90 transition"
            >
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-white/70" />
                </div>
              )}
              
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              )}
            </div>
            
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
            >
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="text-white">
            <h2 className="text-2xl font-bold">{profile.name}</h2>
            <p className="text-white/80">{profile.phone_number}</p>
            {profile.email && (
              <p className="text-white/60 text-sm">{profile.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'basic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Informação Pessoal
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'preferences'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            Preferências
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'availability'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Disponibilidade
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Mensagem */}
        {message && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* Tab: Informação Pessoal */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Nome
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="O teu nome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Localização
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Albufeira, Portugal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-2" />
                  Género
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Descrição
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Conta-nos um pouco sobre ti..."
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/300 caracteres</p>
            </div>
          </div>
        )}

        {/* Tab: Preferências */}
        {activeTab === 'preferences' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hand className="w-4 h-4 inline mr-2" />
                Mão Preferida
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'ambidextrous', label: 'Ambidestro' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, preferred_hand: option.value }))}
                    className={`py-2 px-4 rounded-lg border-2 transition ${
                      formData.preferred_hand === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Target className="w-4 h-4 inline mr-2" />
                Posição no Campo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'both', label: 'Ambos' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, court_position: option.value }))}
                    className={`py-2 px-4 rounded-lg border-2 transition ${
                      formData.court_position === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Trophy className="w-4 h-4 inline mr-2" />
                Tipo de Jogos
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'competitive', label: 'Competitivo' },
                  { value: 'friendly', label: 'Amigável' },
                  { value: 'both', label: 'Ambos' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, game_type: option.value }))}
                    className={`py-2 px-4 rounded-lg border-2 transition ${
                      formData.game_type === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Horário Preferido
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'morning', label: '🌅 Manhã (6h-12h)' },
                  { value: 'afternoon', label: '☀️ Tarde (12h-18h)' },
                  { value: 'evening', label: '🌙 Noite (18h-23h)' },
                  { value: 'all_day', label: '📅 Dia Todo' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, preferred_time: option.value }))}
                    className={`py-3 px-4 rounded-lg border-2 transition text-left ${
                      formData.preferred_time === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Disponibilidade */}
        {activeTab === 'availability' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">
              Configura os dias e horários em que estás disponível para jogar.
            </p>
            
            {DAYS_OF_WEEK.map(day => (
              <div 
                key={day.key}
                className={`flex items-center gap-4 p-3 rounded-lg border transition ${
                  formData.availability[day.key]?.enabled 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer min-w-[120px]">
                  <input
                    type="checkbox"
                    checked={formData.availability[day.key]?.enabled || false}
                    onChange={(e) => handleAvailabilityChange(day.key, 'enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className={`font-medium ${
                    formData.availability[day.key]?.enabled ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {day.label}
                  </span>
                </label>

                {formData.availability[day.key]?.enabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={formData.availability[day.key]?.start || '09:00'}
                      onChange={(e) => handleAvailabilityChange(day.key, 'start', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-400">até</span>
                    <input
                      type="time"
                      value={formData.availability[day.key]?.end || '21:00'}
                      onChange={(e) => handleAvailabilityChange(day.key, 'end', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botão Guardar */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Perfil
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
