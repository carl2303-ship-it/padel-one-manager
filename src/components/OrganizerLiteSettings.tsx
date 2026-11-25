import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';
import { CheckCircle, AlertCircle, CreditCard, Lock, Mail, KeyRound } from 'lucide-react';

/**
 * Manager lite account settings — password + Stripe (+ reset password jogador).
 * Portado do essencial da Tour UserSettings (Fase 1 MVP).
 */
export default function OrganizerLiteSettings() {
  const { user } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMessage, setStripeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [resetPhoneNumber, setResetPhoneNumber] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string; password?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_stripe_settings')
        .select('publishable_key, secret_key')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setStripePublishableKey(data.publishable_key || '');
        setStripeSecretKey(data.secret_key || '');
      }
    })();
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'A password deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'As passwords não coincidem.' });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMessage({ type: 'error', text: error.message });
    } else {
      setPasswordMessage({ type: 'success', text: 'Password atualizada com sucesso.' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordLoading(false);
  };

  const handleSaveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStripeLoading(true);
    setStripeMessage(null);
    const { error } = await supabase.from('user_stripe_settings').upsert(
      {
        user_id: user.id,
        publishable_key: stripePublishableKey.trim(),
        secret_key: stripeSecretKey.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      setStripeMessage({ type: 'error', text: error.message });
    } else {
      setStripeMessage({ type: 'success', text: 'Definições Stripe guardadas.' });
    }
    setStripeLoading(false);
  };

  const handleResetPlayerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !resetPhoneNumber.trim()) return;
    setResetLoading(true);
    setResetMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-player-password', {
        body: { phone_number: resetPhoneNumber.trim(), organizer_id: user.id },
      });
      if (error) {
        setResetMessage({ type: 'error', text: error.message });
      } else if (data?.error) {
        setResetMessage({ type: 'error', text: String(data.error) });
      } else {
        setResetMessage({
          type: 'success',
          text: 'Password do jogador reposta.',
          password: data?.temporary_password || data?.password,
        });
      }
    } catch (err: unknown) {
      setResetMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao repor password.',
      });
    }
    setResetLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conta / Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Password, Stripe e reset de password de jogadores.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Mail className="w-5 h-5" />
          <span className="font-medium">{user?.email}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Alterar password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {passwordMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                passwordMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {passwordMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {passwordMessage.text}
            </div>
          )}
          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {passwordLoading ? 'A guardar...' : 'Alterar password'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Stripe
        </h2>
        <form onSubmit={handleSaveStripe} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publishable key</label>
            <input
              type="text"
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              placeholder="pk_..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret key</label>
            <input
              type="password"
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              placeholder="sk_..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {stripeMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                stripeMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {stripeMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {stripeMessage.text}
            </div>
          )}
          <button
            type="submit"
            disabled={stripeLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {stripeLoading ? 'A guardar...' : 'Guardar Stripe'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Reset password de jogador
        </h2>
        <form onSubmit={handleResetPlayerPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone do jogador</label>
            <input
              type="tel"
              value={resetPhoneNumber}
              onChange={(e) => setResetPhoneNumber(e.target.value)}
              placeholder="+351..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {resetMessage && (
            <div
              className={`p-3 rounded-lg text-sm ${
                resetMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {resetMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {resetMessage.text}
              </div>
              {resetMessage.password && (
                <p className="mt-2 font-mono text-sm font-semibold">Temp: {resetMessage.password}</p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={resetLoading || !resetPhoneNumber.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {resetLoading ? 'A repor...' : 'Repor password'}
          </button>
        </form>
      </div>
    </div>
  );
}
