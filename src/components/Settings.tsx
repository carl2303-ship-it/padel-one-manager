import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import { usePushNotifications } from '../lib/usePushNotifications';
import { Check, Lock, Image, MapPin, Settings as SettingsIcon, Clock, Building2, Bell, BellOff, CheckCircle, AlertCircle, Calendar, QrCode, ExternalLink, Copy, Plus, Trash2, Tag } from 'lucide-react';
import CourtManagement from './CourtManagement';
import ClubManagement from './ClubManagement';

type SettingsTab = 'general' | 'courts' | 'clubs' | 'pricing';

interface PricingExtra {
  name: string;
  price: string;
}

interface PricingConfig {
  equipment: PricingExtra[];
}

export default function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const {
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isSupported: isPushSupported,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState('');

  const [bookingStartTime, setBookingStartTime] = useState('08:00');
  const [bookingEndTime, setBookingEndTime] = useState('22:00');
  const [bookingSlotDuration, setBookingSlotDuration] = useState(90);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(7);
  const [availableBookingSlots, setAvailableBookingSlots] = useState<string[]>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState('');

  const [clubId, setClubId] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    equipment: [],
  });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_logo_settings')
      .select('logo_url, booking_start_time, booking_end_time, booking_slot_duration, max_advance_days, available_booking_slots')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      if (data.logo_url) setLogoUrl(data.logo_url);
      if (data.booking_start_time) setBookingStartTime(data.booking_start_time);
      if (data.booking_end_time) setBookingEndTime(data.booking_end_time);
      if (data.booking_slot_duration) setBookingSlotDuration(data.booking_slot_duration);
      if (data.max_advance_days) setMaxAdvanceDays(data.max_advance_days);
      if (data.available_booking_slots && Array.isArray(data.available_booking_slots)) {
        setAvailableBookingSlots(data.available_booking_slots);
      } else {
        setAvailableBookingSlots(generateSlotsForRange(data.booking_start_time || '08:00', data.booking_end_time || '22:00'));
      }
    }

    const { data: clubData } = await supabase
      .from('clubs')
      .select('id, pricing_config')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (clubData) {
      setClubId(clubData.id);
      if (clubData.pricing_config) {
        setPricingConfig(clubData.pricing_config as PricingConfig);
      }
    }
  };

  // Generate all 30-min slots between two times
  const generateSlotsForRange = (start: string, end: string): string[] => {
    const slots: string[] = [];
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
    return slots;
  };

  // All possible 30-min slots between opening and closing
  const allPossibleSlots = generateSlotsForRange(bookingStartTime, bookingEndTime);

  // When opening/closing time changes, update available slots
  const handleStartTimeChange = (newStart: string) => {
    setBookingStartTime(newStart);
    // Remove any selected slots that are now outside the range
    const newAllSlots = generateSlotsForRange(newStart, bookingEndTime);
    setAvailableBookingSlots(prev => prev.filter(s => newAllSlots.includes(s)));
  };

  const handleEndTimeChange = (newEnd: string) => {
    setBookingEndTime(newEnd);
    const newAllSlots = generateSlotsForRange(bookingStartTime, newEnd);
    setAvailableBookingSlots(prev => prev.filter(s => newAllSlots.includes(s)));
  };

  const toggleSlot = (slot: string) => {
    setAvailableBookingSlots(prev => 
      prev.includes(slot) 
        ? prev.filter(s => s !== slot)
        : [...prev, slot].sort()
    );
  };

  const selectAllSlots = () => {
    setAvailableBookingSlots([...allPossibleSlots]);
  };

  const deselectAllSlots = () => {
    setAvailableBookingSlots([]);
  };

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setHoursSaving(true);
    const { error } = await supabase
      .from('user_logo_settings')
      .upsert({
        user_id: user.id,
        booking_start_time: bookingStartTime,
        booking_end_time: bookingEndTime,
        booking_slot_duration: bookingSlotDuration,
        max_advance_days: maxAdvanceDays,
        available_booking_slots: availableBookingSlots
      }, { onConflict: 'user_id' });

    if (!error) {
      setHoursSuccess(t.settings?.hoursSaved || 'Horário guardado com sucesso');
      setTimeout(() => setHoursSuccess(''), 3000);
    }
    setHoursSaving(false);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError(t.settings.passwordMismatch);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t.settings.passwordTooShort);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(t.settings.passwordChanged);
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !logoUrl.trim()) return;

    setLogoSaving(true);
    const { error } = await supabase
      .from('user_logo_settings')
      .upsert({
        user_id: user.id,
        logo_url: logoUrl.trim()
      }, { onConflict: 'user_id' });

    if (!error) {
      setLogoSuccess(t.settings.logo.saved);
      setTimeout(() => setLogoSuccess(''), 3000);
    }
    setLogoSaving(false);
  };

  const handleTogglePush = async () => {
    setPushMessage(null);
    if (isPushSubscribed) {
      const success = await unsubscribePush();
      if (success) {
        setPushMessage({ type: 'success', text: 'Notificações desativadas' });
      } else {
        setPushMessage({ type: 'error', text: 'Erro ao desativar notificações' });
      }
    } else {
      const success = await subscribePush();
      if (success) {
        setPushMessage({ type: 'success', text: 'Notificações ativadas! Receberá alertas de novas reservas e inscrições em aulas.' });
      } else if (pushPermission === 'denied') {
        setPushMessage({ type: 'error', text: 'Permissão negada. Ative as notificações nas definições do navegador.' });
      } else {
        setPushMessage({ type: 'error', text: 'Erro ao ativar notificações' });
      }
    }
  };

  const savePricingConfig = async () => {
    if (!user || !clubId) return;
    setPricingSaving(true);
    await supabase
      .from('clubs')
      .update({ pricing_config: pricingConfig })
      .eq('id', clubId);
    setPricingSuccess('Preçário guardado!');
    setTimeout(() => setPricingSuccess(''), 3000);
    setPricingSaving(false);
  };

  const getPricingUrl = () => `${window.location.origin}/pricing/${clubId}`;

  const tabs = [
    { id: 'general' as SettingsTab, label: t.settings.title, icon: SettingsIcon },
    { id: 'courts' as SettingsTab, label: t.nav.courts, icon: MapPin },
    { id: 'pricing' as SettingsTab, label: 'Preçário', icon: Tag },
    { id: 'clubs' as SettingsTab, label: t.clubs?.title || 'Clubs', icon: Building2 },
  ];

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.settings.title}</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && (
        <div className="max-w-2xl space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
              <Lock className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">{t.settings.changePassword}</h2>
            </div>
            <form onSubmit={handleChangePassword} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.settings.newPassword}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.settings.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              {passwordError && (
                <div className="text-red-600 text-sm">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="text-green-600 text-sm">{passwordSuccess}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {loading ? t.message.saving : t.settings.changePassword}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
              <Image className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">{t.settings.logo.title}</h2>
            </div>
            <form onSubmit={handleSaveLogo} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.settings.logo.url}
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-gray-500 mt-1">{t.settings.logo.urlHelper}</p>
              </div>
              {logoUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">{t.settings.logo.preview}</p>
                  <img
                    src={logoUrl}
                    alt={t.settings.logo.previewAlt}
                    className="h-16 w-auto object-contain bg-gray-100 rounded-lg p-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              {logoSuccess && (
                <div className="text-green-600 text-sm">{logoSuccess}</div>
              )}
              <button
                type="submit"
                disabled={logoSaving || !logoUrl.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {logoSaving ? t.settings.logo.saving : t.settings.logo.save}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">Reservas</h2>
            </div>
            <form onSubmit={handleSaveHours} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Configurações gerais de reservas. Os slots por campo são configurados em Definições → Campos.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.settings?.maxAdvanceDays || 'Reserva antecipada (dias)'}
                </label>
                <select
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[3, 5, 7, 10, 14, 21, 30].map(d => (
                    <option key={d} value={d}>{d} {t.settings?.days || 'dias'}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Quantos dias em avanço os jogadores podem reservar
                </p>
              </div>

              {hoursSuccess && (
                <div className="text-green-600 text-sm flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {hoursSuccess}
                </div>
              )}
              <button
                type="submit"
                disabled={hoursSaving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {hoursSaving ? t.message.saving : (t.common?.save || 'Guardar')}
              </button>
            </form>
          </div>

          {isPushSupported ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
                <Bell className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Notificações Push</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isPushSubscribed ? (
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Bell className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <BellOff className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {isPushSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {isPushSubscribed
                            ? 'Receberá alertas de novas reservas e inscrições em aulas'
                            : 'Ative para receber alertas no telemóvel'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleTogglePush}
                      disabled={pushLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        isPushSubscribed
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {pushLoading ? '...' : isPushSubscribed ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>

                {pushPermission === 'denied' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      As notificações foram bloqueadas. Para ativar, aceda às definições do navegador e permita notificações para este site.
                    </p>
                  </div>
                )}

                {pushMessage && (
                  <div className={`flex items-center gap-2 p-4 rounded-lg ${
                    pushMessage.type === 'success'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}>
                    {pushMessage.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium">{pushMessage.text}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
                <BellOff className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Notificações Push</h2>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Notificações push não estão disponíveis</strong>
                </p>
                <p className="text-xs text-yellow-700">
                  Para receber notificações de novas reservas e inscrições, certifique-se de que:
                </p>
                <ul className="text-xs text-yellow-700 mt-2 list-disc list-inside space-y-1">
                  <li>Está a usar um navegador que suporta notificações push (Chrome, Firefox, Edge)</li>
                  <li>O site está a ser acedido via HTTPS</li>
                  <li>As notificações estão permitidas nas definições do navegador</li>
                </ul>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-2">Account</h3>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
        </div>
      )}

      {activeTab === 'courts' && (
        <CourtManagement />
      )}

      {activeTab === 'pricing' && (
        <div className="max-w-2xl space-y-6">
          {/* Info */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Página pública do preçário</p>
            <p className="text-blue-600">
              Os <strong>preços dos campos</strong> são lidos das definições dos campos e os <strong>planos de membro</strong> da tab Jogadores.
              Aqui podes gerir os <strong>equipamentos e extras</strong> que aparecem na página.
            </p>
          </div>

          {/* QR Code & Link */}
          {clubId && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <QrCode className="w-5 h-5 text-blue-600" />
                Link & QR Code do Preçário
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={getPricingUrl()}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-600"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(getPricingUrl()); alert('Link copiado!'); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(getPricingUrl())}`, '_blank')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-1"
                >
                  <QrCode className="w-4 h-4" />
                  Ver QR Code
                </button>
                <button
                  onClick={() => window.open(getPricingUrl(), '_blank')}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Pré-visualizar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Imprime o QR Code e coloca na receção ou entrada do clube para os clientes acederem ao preçário.
              </p>
            </div>
          )}

          {/* Equipment & Extras */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Equipamentos & Acessórios</h3>
              <button
                onClick={() => setPricingConfig(prev => ({
                  ...prev,
                  equipment: [...prev.equipment, { name: '', price: '' }]
                }))}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            <div className="p-4 space-y-2">
              {pricingConfig.equipment.map((eq, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={eq.name}
                    onChange={e => {
                      const updated = [...pricingConfig.equipment];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setPricingConfig(prev => ({ ...prev, equipment: updated }));
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Preço"
                    value={eq.price}
                    onChange={e => {
                      const updated = [...pricingConfig.equipment];
                      updated[i] = { ...updated[i], price: e.target.value };
                      setPricingConfig(prev => ({ ...prev, equipment: updated }));
                    }}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right"
                  />
                  <button
                    onClick={() => {
                      const updated = pricingConfig.equipment.filter((_, idx) => idx !== i);
                      setPricingConfig(prev => ({ ...prev, equipment: updated }));
                    }}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={savePricingConfig}
              disabled={pricingSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {pricingSaving ? 'A guardar...' : 'Guardar Preçário'}
            </button>
            {pricingSuccess && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> {pricingSuccess}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'clubs' && (
        <ClubManagement />
      )}
    </div>
  );
}
