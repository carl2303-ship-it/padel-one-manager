import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import { Check, Lock, Image, MapPin, Settings as SettingsIcon, Clock, Building2 } from 'lucide-react';
import CourtManagement from './CourtManagement';
import ClubManagement from './ClubManagement';

type SettingsTab = 'general' | 'courts' | 'clubs';

export default function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState('');

  const [bookingStartTime, setBookingStartTime] = useState('08:00');
  const [bookingEndTime, setBookingEndTime] = useState('22:00');
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_logo_settings')
      .select('logo_url, booking_start_time, booking_end_time')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      if (data.logo_url) setLogoUrl(data.logo_url);
      if (data.booking_start_time) setBookingStartTime(data.booking_start_time);
      if (data.booking_end_time) setBookingEndTime(data.booking_end_time);
    }
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
        booking_end_time: bookingEndTime
      }, { onConflict: 'user_id' });

    if (!error) {
      setHoursSuccess(t.settings?.hoursSaved || 'Operating hours saved');
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

  const tabs = [
    { id: 'general' as SettingsTab, label: t.settings.title, icon: SettingsIcon },
    { id: 'courts' as SettingsTab, label: t.nav.courts, icon: MapPin },
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
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">{t.settings?.operatingHours || 'Operating Hours'}</h2>
            </div>
            <form onSubmit={handleSaveHours} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">{t.settings?.operatingHoursDesc || 'Define the hours when courts can be booked'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.settings?.openingTime || 'Opening Time'}
                  </label>
                  <select
                    value={bookingStartTime}
                    onChange={(e) => setBookingStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.settings?.closingTime || 'Closing Time'}
                  </label>
                  <select
                    value={bookingEndTime}
                    onChange={(e) => setBookingEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timeOptions.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              {hoursSuccess && (
                <div className="text-green-600 text-sm">{hoursSuccess}</div>
              )}
              <button
                type="submit"
                disabled={hoursSaving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {hoursSaving ? t.message.saving : (t.common?.save || 'Save')}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-2">Account</h3>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
        </div>
      )}

      {activeTab === 'courts' && (
        <CourtManagement />
      )}

      {activeTab === 'clubs' && (
        <ClubManagement />
      )}
    </div>
  );
}
