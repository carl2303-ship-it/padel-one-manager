import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import {
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface StaffInviteAcceptProps {
  inviteToken: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface StaffData {
  id: string;
  name: string;
  email: string;
  role: string;
  club_owner_id: string;
}

export default function StaffInviteAccept({ inviteToken, onComplete, onCancel }: StaffInviteAcceptProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const roleLabels: Record<string, string> = {
    admin: t.staff?.admin || 'Administrator',
    bar_staff: t.staff?.barStaff || 'Bar/Restaurant',
    coach: t.staff?.coach || 'Coach',
    receptionist: t.staff?.receptionist || 'Receptionist',
    other: t.staff?.other || 'Other'
  };

  useEffect(() => {
    loadInviteData();
  }, [inviteToken]);

  const loadInviteData = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('club_staff')
      .select('id, name, email, role, club_owner_id')
      .eq('invite_token', inviteToken)
      .maybeSingle();

    if (fetchError || !data) {
      setError(t.staff?.inviteNotFound || 'Invite not found or expired');
      setLoading(false);
      return;
    }

    setStaffData(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!staffData) return;

    if (password.length < 6) {
      setError(t.staff?.passwordTooShort || 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(t.staff?.passwordMismatch || 'Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: staffData.email,
        password: password,
        options: {
          data: {
            name: staffData.name,
            role: 'staff',
            staff_id: staffData.id,
            club_owner_id: staffData.club_owner_id
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: staffData.email,
            password: password
          });

          if (signInError) {
            throw new Error(t.staff?.emailInUse || 'This email is already registered with a different password');
          }
        } else {
          throw signUpError;
        }
      }

      const userId = authData?.user?.id;

      const { error: updateError } = await supabase
        .from('club_staff')
        .update({
          user_id: userId,
          invite_accepted_at: new Date().toISOString(),
          invite_token: null
        })
        .eq('id', staffData.id);

      if (updateError) {
        console.error('Error updating staff:', updateError);
      }

      onComplete();
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t.message?.loading || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error && !staffData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t.staff?.inviteError || 'Invalid Invite'}
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            {t.common?.back || 'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t.staff?.acceptInvite || 'Accept Staff Invite'}
          </h1>
          <p className="text-gray-600">
            {t.staff?.createAccountMsg || 'Create your account to access the management system'}
          </p>
        </div>

        {staffData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 mb-1">{t.members?.name || 'Name'}</div>
            <div className="font-medium text-gray-900 mb-3">{staffData.name}</div>
            <div className="text-sm text-gray-600 mb-1">{t.staff?.role || 'Role'}</div>
            <div className="font-medium text-gray-900">{roleLabels[staffData.role] || staffData.role}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={staffData?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.staff?.password || 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-10"
                placeholder="******"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.staff?.confirmPassword || 'Confirm Password'}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="******"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              {t.common?.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || !password || !confirmPassword}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.message?.saving || 'Saving...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t.staff?.createAccount || 'Create Account'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
