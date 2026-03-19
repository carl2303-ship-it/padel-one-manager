import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Image,
  CreditCard,
  Banknote,
  Users,
  LayoutGrid,
  Camera,
  Upload,
  Loader2,
  Clock,
  Sun,
  Snowflake
} from 'lucide-react';

type PaymentMethod = 'at_club' | 'per_player' | 'full_court' | 'at_club_or_per_player' | 'at_club_or_full_court' | 'all';

interface Club {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  photo_url_1: string | null;
  photo_url_2: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  payment_method: PaymentMethod;
  stripe_publishable_key: string | null;
  stripe_secret_key: string | null;
  opening_time: string | null;
  closing_time: string | null;
  active_schedule: string;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  'at_club': '🏢 Apenas no clube',
  'per_player': '💳 Online por jogador',
  'full_court': '💳 Online campo inteiro',
  'at_club_or_per_player': '🏢+💳 Clube ou online (por jogador)',
  'at_club_or_full_court': '🏢+💳 Clube ou online (campo inteiro)',
  'all': '🏢+💳 Todas as opções',
};

export default function ClubManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    photo_url_1: '',
    photo_url_2: '',
    address: '',
    city: '',
    country: 'Portugal',
    phone: '',
    email: '',
    website: '',
    payment_method: 'at_club' as PaymentMethod,
    stripe_publishable_key: '',
    stripe_secret_key: '',
    opening_time: '08:00',
    closing_time: '22:00',
    active_schedule: 'summer',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (user) {
      loadClubs();
    }
  }, [user]);

  const loadClubs = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('*')
      .eq('owner_id', user.id)
      .order('name');

    setClubs(data || []);
    setLoading(false);
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();

  // End time options include midnight (00:00 = end of day)
  const generateEndTimeOptions = () => {
    const options = [];
    for (let h = 1; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    options.push('00:00'); // midnight
    return options;
  };
  const endTimeOptions = generateEndTimeOptions();

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      photo_url_1: '',
      photo_url_2: '',
      address: '',
      city: '',
      country: 'Portugal',
      phone: '',
      email: '',
      website: '',
      payment_method: 'at_club',
      stripe_publishable_key: '',
      stripe_secret_key: '',
      opening_time: '08:00',
      closing_time: '22:00',
      active_schedule: 'summer',
    });
    setEditingClub(null);
    setShowForm(false);
  };

  const handleEdit = (club: Club) => {
    setFormData({
      name: club.name,
      description: club.description || '',
      logo_url: club.logo_url || '',
      photo_url_1: club.photo_url_1 || '',
      photo_url_2: club.photo_url_2 || '',
      address: club.address || '',
      city: club.city || '',
      country: club.country || 'Portugal',
      phone: club.phone || '',
      email: club.email || '',
      website: club.website || '',
      payment_method: club.payment_method || 'at_club',
      stripe_publishable_key: club.stripe_publishable_key || '',
      stripe_secret_key: club.stripe_secret_key || '',
      opening_time: club.opening_time || '08:00',
      closing_time: club.closing_time || '22:00',
      active_schedule: club.active_schedule || 'summer',
    });
    setEditingClub(club);
    setShowForm(true);
  };

  const handlePhotoUpload = async (file: File, photoNum: 1 | 2) => {
    if (!user) return;
    setUploadingPhoto(photoNum);

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecione um ficheiro de imagem');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter menos de 5MB');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/club-photo-${photoNum}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('club-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, try creating via public URL approach
        console.error('Upload error:', uploadError);
        alert(`Erro ao enviar foto: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('club-photos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      if (photoNum === 1) {
        setFormData(prev => ({ ...prev, photo_url_1: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, photo_url_2: publicUrl }));
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Erro ao enviar foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    setSaving(true);

    if (editingClub) {
      const { error } = await supabase
        .from('clubs')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          logo_url: formData.logo_url.trim() || null,
          photo_url_1: formData.photo_url_1.trim() || null,
          photo_url_2: formData.photo_url_2.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          website: formData.website.trim() || null,
          payment_method: formData.payment_method,
          stripe_publishable_key: formData.stripe_publishable_key.trim() || null,
          stripe_secret_key: formData.stripe_secret_key.trim() || null,
          opening_time: formData.opening_time,
          closing_time: formData.closing_time,
          active_schedule: formData.active_schedule,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingClub.id);

      if (!error) {
        resetForm();
        loadClubs();
      }
    } else {
      const { error } = await supabase
        .from('clubs')
        .insert({
          owner_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          logo_url: formData.logo_url.trim() || null,
          photo_url_1: formData.photo_url_1.trim() || null,
          photo_url_2: formData.photo_url_2.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          website: formData.website.trim() || null,
          payment_method: formData.payment_method,
          stripe_publishable_key: formData.stripe_publishable_key.trim() || null,
          stripe_secret_key: formData.stripe_secret_key.trim() || null,
          opening_time: formData.opening_time,
          closing_time: formData.closing_time,
          active_schedule: formData.active_schedule,
        });

      if (!error) {
        resetForm();
        loadClubs();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (clubId: string) => {
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', clubId);

    if (!error) {
      setDeleteConfirm(null);
      loadClubs();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t.clubs?.title || 'My Clubs'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t.clubs?.description || 'Manage your padel clubs and their information'}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t.clubs?.add || 'Add Club'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                {editingClub ? (t.clubs?.edit || 'Edit Club') : (t.clubs?.add || 'Add Club')}
              </h3>
            </div>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.name || 'Club Name'} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Padel Blu"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.description || 'Description'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="A brief description of the club..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    {t.clubs?.logoUrl || 'Logo URL'}
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
                {formData.logo_url && (
                  <div className="mt-2">
                    <img
                      src={formData.logo_url}
                      alt="Logo preview"
                      className="h-12 w-auto object-contain bg-gray-100 rounded-lg p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
              {/* Facility Photos */}
              <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  Fotos das Instalações
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Adicione até 2 fotos do clube que serão visíveis para os jogadores na app.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Photo 1 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Foto 1</label>
                    {formData.photo_url_1 ? (
                      <div className="relative group">
                        <img
                          src={formData.photo_url_1}
                          alt="Foto 1"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photo_url_1: '' })}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                        {uploadingPhoto === 1 ? (
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">Carregar foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file, 1);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {/* Photo 2 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Foto 2</label>
                    {formData.photo_url_2 ? (
                      <div className="relative group">
                        <img
                          src={formData.photo_url_2}
                          alt="Foto 2"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photo_url_2: '' })}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                        {uploadingPhoto === 2 ? (
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">Carregar foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file, 2);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {t.clubs?.address || 'Address'}
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.clubs?.city || 'City'}
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Albufeira"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t.clubs?.phone || 'Phone'}
                  </div>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t.clubs?.email || 'Email'}
                  </div>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.clubs?.website || 'Website'}
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.padelblu.com"
                />
              </div>
            </div>

            {/* Operating Hours Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                Horário de Funcionamento
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Horário geral do clube visível para os jogadores na app.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Abertura
                  </label>
                  <select
                    value={formData.opening_time}
                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Fecho
                  </label>
                  <select
                    value={formData.closing_time}
                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {endTimeOptions.map(time => (
                      <option key={time} value={time}>
                        {time === '00:00' ? '00:00 (Meia-noite)' : time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Schedule Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {formData.active_schedule === 'summer' ? (
                  <Sun className="w-4 h-4 text-orange-500" />
                ) : (
                  <Snowflake className="w-4 h-4 text-blue-500" />
                )}
                Horário Ativo (Verão / Inverno)
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Selecione o período ativo. Cada campo terá slots de reserva diferentes para verão e inverno.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, active_schedule: 'summer' })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.active_schedule === 'summer'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  Horário de Verão
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, active_schedule: 'winter' })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.active_schedule === 'winter'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Snowflake className="w-5 h-5" />
                  Horário de Inverno
                </button>
              </div>
            </div>

            {/* Payment Settings Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Configuração de Pagamento
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Método de pagamento
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_method: value })}
                        className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                          formData.payment_method === value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.payment_method !== 'at_club' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Para pagamentos online, configure as chaves Stripe do clube.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stripe Publishable Key
                      </label>
                      <input
                        type="text"
                        value={formData.stripe_publishable_key}
                        onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                        placeholder="pk_live_..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stripe Secret Key
                      </label>
                      <input
                        type="password"
                        value={formData.stripe_secret_key}
                        onChange={(e) => setFormData({ ...formData, stripe_secret_key: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                        placeholder="sk_live_..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={saving || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {saving ? t.message.saving : (editingClub ? t.common.save : (t.clubs?.add || 'Add Club'))}
              </button>
            </div>
          </form>
        </div>
      )}

      {clubs.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t.clubs?.noClubs || 'No clubs yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {t.clubs?.noClubsDesc || 'Create your first club to start organizing tournaments under its name'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t.clubs?.createFirst || 'Create First Club'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start gap-4">
                {club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={club.name}
                    className="w-16 h-16 object-contain bg-gray-100 rounded-lg p-1 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{club.name}</h3>
                      {club.description && (
                        <p className="text-sm text-gray-600 mt-1">{club.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(club)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {deleteConfirm === club.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(club.id)}
                            className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(club.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
                    {club.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {club.city}
                      </span>
                    )}
                    {club.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {club.phone}
                      </span>
                    )}
                    {club.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {club.email}
                      </span>
                    )}
                  </div>
                  {(club.opening_time || club.closing_time) && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      {club.opening_time || '08:00'} - {club.closing_time === '00:00' ? '00:00 (Meia-noite)' : (club.closing_time || '22:00')}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      club.active_schedule === 'winter' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {club.active_schedule === 'winter' ? (
                        <><Snowflake className="w-3 h-3" /> Horário de Inverno</>
                      ) : (
                        <><Sun className="w-3 h-3" /> Horário de Verão</>
                      )}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      club.payment_method === 'at_club' ? 'bg-gray-100 text-gray-600' :
                      club.stripe_secret_key ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      <CreditCard className="w-3 h-3" />
                      {PAYMENT_LABELS[club.payment_method] || 'Pagar no clube'}
                      {club.payment_method !== 'at_club' && !club.stripe_secret_key && ' (Stripe não configurado)'}
                    </span>
                  </div>
                  {/* Club Facility Photos */}
                  {(club.photo_url_1 || club.photo_url_2) && (
                    <div className="flex gap-2 mt-3">
                      {club.photo_url_1 && (
                        <img
                          src={club.photo_url_1}
                          alt="Instalação 1"
                          className="w-24 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      )}
                      {club.photo_url_2 && (
                        <img
                          src={club.photo_url_2}
                          alt="Instalação 2"
                          className="w-24 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
