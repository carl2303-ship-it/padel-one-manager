import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { useI18n } from '../lib/i18nContext';
import { supabase } from '../lib/supabase';
import { useCustomLogo } from '../lib/useCustomLogo';

interface AuthFormProps {
  onSuccess?: () => void;
  /** Entrada direta pelo URL ?super-admin ou #super-admin — login dedicado ao HQ, sem aparência da app Manager */
  hqEntry?: boolean;
}

export default function AuthForm({ onSuccess, hqEntry = false }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signIn, resetPassword } = useAuth();
  const { t } = useI18n();
  const { logoUrl } = useCustomLogo();

  useEffect(() => {
    // Check if this is a password recovery link
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsPasswordRecovery(true);
      setShowResetPassword(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError(t.auth.errors.fillAllFields);
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(t.auth.errors.invalidCredentials);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Super admins bypass all checks
          const { data: saRecord } = await supabase
            .from('super_admins')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (saRecord) {
            onSuccess?.();
            return;
          }

          // Check if user's club is suspended
          const { data: suspendedClub } = await supabase
            .from('clubs')
            .select('id')
            .eq('owner_id', user.id)
            .eq('status', 'suspended')
            .maybeSingle();
          if (suspendedClub) {
            await supabase.auth.signOut();
            setError('O acesso do seu clube foi suspenso. Contacte o suporte Padel One.');
            setLoading(false);
            return;
          }

          const { data: staffRecord } = await supabase
            .from('club_staff')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (staffRecord) {
            onSuccess?.();
            return;
          }

          const { data: existing } = await supabase
            .from('user_logo_settings')
            .select('id, is_paid_organizer')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existing) {
            if (!existing.is_paid_organizer) {
              await supabase.auth.signOut();
              setError('Esta conta não tem acesso de organizador. Adquira a licença em boostpadel.store');
              setLoading(false);
              return;
            }
            await supabase
              .from('user_logo_settings')
              .update({ role: 'organizer', updated_at: new Date().toISOString() })
              .eq('user_id', user.id);
          } else {
            await supabase.auth.signOut();
            setError('Esta conta não tem acesso de organizador. Adquira a licença em boostpadel.store');
            setLoading(false);
            return;
          }
        }
        onSuccess?.();
      }
    } catch (err) {
      setError(t.auth.errors.somethingWrong);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError(t.auth.errors.fillAllFields);
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(t.auth.errors.somethingWrong);
      } else {
        setSuccess(t.auth.resetEmailSent);
        setTimeout(() => {
          setShowResetPassword(false);
          setSuccess('');
        }, 3000);
      }
    } catch (err) {
      setError(t.auth.errors.somethingWrong);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password || !confirmPassword) {
      setError(t.auth.errors.fillAllFields);
      return;
    }

    if (password.length < 6) {
      setError(t.auth.errors.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.auth.errors.passwordsDontMatch);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(t.auth.errors.somethingWrong);
      } else {
        setSuccess(t.auth.passwordUpdated);
        setTimeout(() => {
          setIsPasswordRecovery(false);
          setPassword('');
          setConfirmPassword('');
          window.location.hash = '';
        }, 2000);
      }
    } catch (err) {
      setError(t.auth.errors.somethingWrong);
    } finally {
      setLoading(false);
    }
  };

  const hq = hqEntry;
  const shellBg = hq ? 'bg-[#111111]' : 'bg-gradient-to-br from-slate-50 to-slate-100';
  const cardClass = hq
    ? 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-xl p-8'
    : 'bg-white rounded-2xl shadow-xl p-8';
  const titleClass = hq ? 'text-3xl font-black text-gray-100 mb-1' : 'text-3xl font-black text-[#111111] mb-2';
  const subtitleClass = hq ? 'text-sm text-gray-500' : 'text-slate-600';
  const labelClass = hq ? 'block text-sm font-medium text-gray-400 mb-2' : 'block text-sm font-medium text-slate-700 mb-2';
  const inputClass = hq
    ? 'w-full px-4 py-3 bg-[#111111] border border-[#2a2a2a] rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#D32F2F]/50 focus:border-transparent transition'
    : 'w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-transparent transition';
  const inputClassPr = `${inputClass} pr-12`;
  const btnPrimary = hq
    ? 'w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md'
    : 'w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md';
  const linkClass = hq ? 'text-[#D32F2F] hover:text-red-400 font-medium transition' : 'text-[#007BFF] hover:text-[#0069d9] font-medium transition';
  const errBox = hq ? 'mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg' : 'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg';
  const errText = hq ? 'text-sm text-red-300' : 'text-sm text-red-800';
  const okBox = hq ? 'mb-6 p-4 bg-green-900/20 border border-green-800/40 rounded-lg' : 'mb-6 p-4 bg-green-50 border border-green-200 rounded-lg';
  const okText = hq ? 'text-sm text-green-300' : 'text-sm text-green-800';
  const eyeClass = hq ? 'text-gray-500 hover:text-gray-300 transition' : 'text-slate-500 hover:text-slate-700 transition';

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${shellBg}`}>
      <div className="max-w-md w-full">
        <div className={cardClass}>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src={logoUrl}
                alt="Logo"
                className={hq ? 'h-24 w-auto opacity-95' : 'h-32 w-auto'}
              />
            </div>
            {hq ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D32F2F] mb-2">Padel One HQ</p>
                <h1 className={titleClass}>Super Admin</h1>
                <p className={subtitleClass}>
                  Inicie sessão para aceder à consola global. Não é o login de gestor de clube.
                </p>
              </>
            ) : (
              <>
                <h1 className={titleClass}>{t.app.title}</h1>
                <p className={subtitleClass}>
                  Gestão completa do seu clube de padel
                </p>
              </>
            )}
          </div>

          {error && (
            <div className={errBox}>
              <p className={errText}>{error}</p>
            </div>
          )}

          {success && (
            <div className={okBox}>
              <p className={okText}>{success}</p>
            </div>
          )}

          {isPasswordRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label htmlFor="newPassword" className={labelClass}>
                  {t.auth.newPassword}
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClassPr}
                    placeholder={t.auth.passwordPlaceholder}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${eyeClass}`}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  {t.auth.confirmPassword}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClassPr}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${eyeClass}`}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                {loading ? t.auth.pleaseWait : t.auth.updatePassword}
              </button>
            </form>
          ) : showResetPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label htmlFor="email" className={labelClass}>
                  {t.auth.email}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder={t.auth.emailPlaceholder}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                {loading ? t.auth.pleaseWait : t.auth.resetPassword}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className={`w-full ${linkClass} py-2 transition text-sm`}
              >
                {t.auth.backToSignIn}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className={labelClass}>
                {t.auth.email}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder={t.auth.emailPlaceholder}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                {t.auth.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClassPr}
                  placeholder={t.auth.passwordPlaceholder}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${eyeClass}`}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                {loading ? t.auth.pleaseWait : t.auth.signIn}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(true);
                    setError('');
                  }}
                  className={`text-sm ${linkClass} transition`}
                >
                  {t.auth.forgotPassword}
                </button>
              </div>
            </form>
          )}

          {hq && (
            <p className="mt-6 text-center text-xs text-gray-500">
              <a href={typeof window !== 'undefined' ? window.location.pathname : '/'} className={linkClass}>
                Entrar na app Manager (gestores de clube)
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}