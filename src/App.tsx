import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import LanguageSelector from './components/LanguageSelector';
import Dashboard from './components/Dashboard';
import CourtBookings from './components/CourtBookings';
import MemberManagement from './components/MemberManagement';
import AcademyManagement from './components/AcademyManagement';
import BarManagement from './components/BarManagement';
import ClubMetrics from './components/ClubMetrics';
import StaffManagement from './components/StaffManagement';
import StaffInviteAccept from './components/StaffInviteAccept';
import Settings from './components/Settings';
import HQLayout from './components/hq/HQLayout';
import OpenGamesManagement from './components/OpenGamesManagement';
import RewardsManagement from './components/RewardsManagement';
import PublicMenu from './components/PublicMenu';
import PublicPricing from './components/PublicPricing';
import PlatformPricing from './components/PlatformPricing';
import { useI18n } from './lib/i18nContext';
import { useAuth } from './lib/authContext';
import { useCustomLogo } from './lib/useCustomLogo';
import {
  Menu,
  X,
} from 'lucide-react';

// Emoji icon components for sidebar menu
const EmojiIcon = ({ emoji, className }: { emoji: string; className?: string }) => (
  <span className={`inline-flex items-center justify-center w-5 h-5 ${className || ''}`} style={{ fontSize: '1.15rem', lineHeight: 1 }}>{emoji}</span>
);
const DashboardIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="📊" className={className} />;
const BookingsIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="📅" className={className} />;
const MembersIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="👥" className={className} />;
const AcademyIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="🎓" className={className} />;
const BarIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="🍹" className={className} />;
const MetricsIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="📈" className={className} />;
const OpenGamesIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="🎾" className={className} />;
const RewardsIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="🎁" className={className} />;
const StaffIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="👔" className={className} />;
const SettingsEmojiIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="⚙️" className={className} />;
const LogOutIcon = ({ className }: { className?: string }) => <EmojiIcon emoji="🚪" className={className} />;

type View = 'dashboard' | 'bookings' | 'members' | 'academy' | 'bar' | 'metrics' | 'open-games' | 'rewards' | 'staff' | 'settings';

function isSuperAdminEntryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return window.location.hash === '#super-admin' || q.get('super-admin') !== null;
}

interface StaffPermissions {
  isStaff: boolean;
  isOwner: boolean;
  clubOwnerId: string | null;
  staffName: string | null;
  perm_bookings: boolean;
  perm_members: boolean;
  perm_bar: boolean;
  perm_academy: boolean;
  perm_reports: boolean;
  role: string | null;
}

function App() {
  const { t } = useI18n();
  const { user, loading: authLoading, signOut } = useAuth();
  const { logoUrl } = useCustomLogo();
  const [view, setView] = useState<View>('dashboard');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [staffInviteToken, setStaffInviteToken] = useState<string | null>(null);
  const [showSuperAdmin, setShowSuperAdmin] = useState(isSuperAdminEntryUrl);
  // Refresh key: incrementing this forces child components to re-mount and reload data
  const [refreshKey, setRefreshKey] = useState(0);
  const lastForegroundRefresh = useRef(Date.now());

  // Auto-refresh when tab/window regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastForegroundRefresh.current;
        // Only refresh if more than 15 seconds have passed
        if (elapsed > 15_000 && user) {
          lastForegroundRefresh.current = Date.now();
          console.log('[Manager] Foreground refresh triggered');
          setRefreshKey(k => k + 1);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions>({
    isStaff: false,
    isOwner: true,
    clubOwnerId: null,
    staffName: null,
    perm_bookings: true,
    perm_members: true,
    perm_bar: true,
    perm_academy: true,
    perm_reports: true,
    role: null
  });
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // License / contract validation state
  const [needsLicense, setNeedsLicense] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [licenseResult, setLicenseResult] = useState<{ plan?: string; contract_expires_at?: string } | null>(null);
  const [clubPlanInfo, setClubPlanInfo] = useState<{ plan_type?: string; contract_expires_at?: string } | null>(null);

  const handleSignOut = async () => {
    await signOut();
    setView('dashboard');
    setShowMobileMenu(false);
  };

  useEffect(() => {
    // Check both query params and hash for invite token
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Try query param first, then hash
    const inviteToken = urlParams.get('staff-invite') || hashParams.get('staff-invite');
    
    if (inviteToken) {
      console.log('[App] Staff invite token found:', inviteToken);
      setStaffInviteToken(inviteToken);
    }
    
    setShowSuperAdmin(isSuperAdminEntryUrl());
  }, []);

  const handleInviteComplete = () => {
    setStaffInviteToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleInviteCancel = () => {
    setStaffInviteToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  useEffect(() => {
    if (!user) {
      setView('dashboard');
      setShowMobileMenu(false);
      setNeedsLicense(false);
      setClubPlanInfo(null);
      setStaffPermissions({
        isStaff: false,
        isOwner: true,
        clubOwnerId: null,
        staffName: null,
        perm_bookings: true,
        perm_members: true,
        perm_bar: true,
        perm_academy: true,
        perm_reports: true,
        role: null
      });
      setCheckingPermissions(false);
    } else {
      checkLicenseAndPermissions();
    }
  }, [user]);

  const checkLicenseAndPermissions = async () => {
    if (!user) return;
    setCheckingPermissions(true);

    try {
    // Super admins bypass everything
    const { data: saRecord } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (saRecord) {
      setNeedsLicense(false);
      await checkStaffPermissions();
      return;
    }

    // Staff bypasses license check
    const { data: staffData } = await supabase
      .from('club_staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (staffData) {
      setNeedsLicense(false);
      await checkStaffPermissions();
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
      setLicenseMessage('O acesso do seu clube foi suspenso. Contacte o suporte Padel One.');
      setNeedsLicense(true);
      setCheckingPermissions(false);
      return;
    }

    // Club owner: check contract
    const { data: ownedClub } = await supabase
      .from('clubs')
      .select('id, plan_type, contract_start, contract_expires_at')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (ownedClub) {
      const hasValidContract = ownedClub.contract_expires_at &&
        new Date(ownedClub.contract_expires_at) > new Date();

      if (hasValidContract) {
        setClubPlanInfo({
          plan_type: ownedClub.plan_type,
          contract_expires_at: ownedClub.contract_expires_at,
        });
        setNeedsLicense(false);
        await checkStaffPermissions();
        return;
      }

      setLicenseMessage(
        ownedClub.contract_expires_at
          ? 'O contrato do seu clube expirou. Introduza uma nova chave de licença para continuar.'
          : 'O seu clube ainda não foi ativado. Introduza a chave de licença que recebeu.'
      );
      setNeedsLicense(true);
      setCheckingPermissions(false);
      return;
    }

    // Paid organizer check
    const { data: orgSettings } = await supabase
      .from('user_logo_settings')
      .select('is_paid_organizer')
      .eq('user_id', user.id)
      .maybeSingle();

    if (orgSettings?.is_paid_organizer) {
      setNeedsLicense(false);
      await checkStaffPermissions();
      return;
    }

    // No valid license
    setLicenseMessage('Introduza a chave de licença que recebeu para ativar o seu acesso.');
    setNeedsLicense(true);
    setCheckingPermissions(false);
    } catch (err) {
      console.error('[License] Error checking license:', err);
      setLicenseMessage('Erro ao verificar licença. Faça login novamente.');
      setNeedsLicense(true);
      setCheckingPermissions(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim() || !user) return;
    setActivatingLicense(true);
    setLicenseError('');

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rqiwnxcexsccguruiteq.supabase.co';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const resp = await fetch(`${baseUrl}/functions/v1/activate-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ license_key: licenseKey.trim(), user_id: user.id }),
      });
      const data = await resp.json();

      if (!data?.ok) {
        setLicenseError(data?.error || 'Chave inválida');
        setActivatingLicense(false);
        return;
      }

      setLicenseResult(data);

      // After successful activation, sign out and reload to force a clean session
      setTimeout(async () => {
        await signOut();
        // Clear any stale localStorage tokens
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        window.location.reload();
      }, 2500);
    } catch {
      setLicenseError('Erro ao ativar licença. Tente novamente.');
    }
    setActivatingLicense(false);
  };

  const handleCancelLicense = async () => {
    await signOut();
    setNeedsLicense(false);
    setLicenseKey('');
    setLicenseResult(null);
    setLicenseError('');
  };

  const checkStaffPermissions = async () => {
    if (!user) {
      setCheckingPermissions(false);
      return;
    }

    setCheckingPermissions(true);

    const { data: staffData } = await supabase
      .from('club_staff')
      .select('*, club_owner_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (staffData && staffData.club_owner_id !== user.id) {
      const permBar = staffData.perm_bar || staffData.role === 'admin' || staffData.role === 'kitchen' || staffData.role === 'bar_staff';
      const permBookings = staffData.perm_bookings || staffData.role === 'admin';
      const permMembers = staffData.perm_members || staffData.role === 'admin';
      const permAcademy = staffData.perm_academy || staffData.role === 'admin';
      const permReports = staffData.perm_reports || staffData.role === 'admin';

      setStaffPermissions({
        isStaff: true,
        isOwner: false,
        clubOwnerId: staffData.club_owner_id,
        staffName: staffData.name,
        perm_bookings: permBookings,
        perm_members: permMembers,
        perm_bar: permBar,
        perm_academy: permAcademy,
        perm_reports: permReports,
        role: staffData.role
      });

      // If staff only has bar access, go straight to bar view
      if (permBar && !permBookings && !permMembers && !permAcademy && !permReports) {
        setView('bar');
      }
    } else {
      setStaffPermissions({
        isStaff: false,
        isOwner: true,
        clubOwnerId: null,
        staffName: null,
        perm_bookings: true,
        perm_members: true,
        perm_bar: true,
        perm_academy: true,
        perm_reports: true,
        role: null
      });
    }

    setCheckingPermissions(false);
  };

  // Check if this is a public page (no auth needed)
  const pathname = window.location.pathname;
  const menuMatch = pathname.match(/^\/menu\/([a-f0-9-]+)$/i);
  if (menuMatch) {
    const menuClubId = menuMatch[1];
    const urlParams = new URLSearchParams(window.location.search);
    const tableNum = urlParams.get('mesa') || urlParams.get('table');
    return <PublicMenu clubId={menuClubId} tableNumber={tableNum} />;
  }

  if (pathname === '/plans' || pathname === '/platform-pricing') {
    return <PlatformPricing />;
  }

  const pricingMatch = pathname.match(/^\/pricing\/([a-f0-9-]+)$/i);
  if (pricingMatch) {
    return <PublicPricing clubId={pricingMatch[1]} />;
  }

  if (authLoading || checkingPermissions) {
    if (showSuperAdmin) {
      return (
        <div className="min-h-screen bg-[#111111] flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 border-2 border-[#D32F2F] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Padel One HQ</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-24 w-auto mx-auto"
            />
          </div>
          <p className="text-gray-600">{t.message.loading}</p>
        </div>
      </div>
    );
  }

  if (staffInviteToken) {
    return (
      <StaffInviteAccept
        inviteToken={staffInviteToken}
        onComplete={handleInviteComplete}
        onCancel={handleInviteCancel}
      />
    );
  }

  if (showSuperAdmin && user) {
    return <HQLayout />;
  }

  if (!user) {
    return <AuthForm hqEntry={showSuperAdmin} />;
  }

  // License activation screen
  if (needsLicense) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <img src={logoUrl} alt="Logo" className="h-16 w-auto mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Ativar Licença</h2>
            <p className="text-sm text-gray-500 mt-2">{licenseMessage}</p>
          </div>

          {licenseResult ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-green-800 font-semibold">Licença ativada com sucesso!</p>
              {licenseResult.plan && (
                <p className="text-green-700 text-sm mt-1">Plano: <strong>{licenseResult.plan}</strong></p>
              )}
              {licenseResult.contract_expires_at && (
                <p className="text-green-700 text-sm">Expira: <strong>{new Date(licenseResult.contract_expires_at).toLocaleDateString('pt-PT')}</strong></p>
              )}
              <p className="text-green-600 text-xs mt-2">A redirecionar...</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave de Licença</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="PADEL-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                />
              </div>

              {licenseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-700 text-sm text-center">{licenseError}</p>
                </div>
              )}

              <button
                onClick={handleActivateLicense}
                disabled={activatingLicense || !licenseKey.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {activatingLicense ? 'A ativar...' : 'Ativar Licença'}
              </button>

              <button
                onClick={handleCancelLicense}
                className="w-full mt-3 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                Sair / Cancelar
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                Não tem uma chave? Contacte o suporte Padel One.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Staff with only bar access doesn't need the dashboard
  const staffBarOnly = staffPermissions.isStaff &&
    staffPermissions.perm_bar &&
    !staffPermissions.perm_bookings &&
    !staffPermissions.perm_members &&
    !staffPermissions.perm_academy &&
    !staffPermissions.perm_reports;

  const allNavItems = [
    { id: 'dashboard' as View, label: t.nav.dashboard, icon: DashboardIcon, permission: 'always' },
    { id: 'bookings' as View, label: t.nav.bookings, icon: BookingsIcon, permission: 'perm_bookings' },
    { id: 'members' as View, label: t.nav.members, icon: MembersIcon, permission: 'perm_members' },
    { id: 'academy' as View, label: t.nav.academy, icon: AcademyIcon, permission: 'perm_academy' },
    { id: 'bar' as View, label: t.nav.bar, icon: BarIcon, permission: 'perm_bar' },
    { id: 'metrics' as View, label: t.nav.metrics || 'Metrics', icon: MetricsIcon, permission: 'perm_reports' },
    { id: 'open-games' as View, label: t.nav.openGames || 'Jogos Abertos', icon: OpenGamesIcon, permission: 'perm_bookings' },
    { id: 'rewards' as View, label: 'Rewards', icon: RewardsIcon, permission: 'perm_bookings' },
    { id: 'staff' as View, label: t.nav.staff || 'Staff', icon: StaffIcon, permission: 'owner_only' },
  ];

  const navItems = allNavItems.filter(item => {
    if (item.permission === 'always') return !staffBarOnly;
    if (item.permission === 'owner_only') return staffPermissions.isOwner;
    return staffPermissions[item.permission as keyof StaffPermissions];
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <img src={logoUrl} alt="Logo" className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t.app.title}</h1>
            <p className="text-xs text-gray-500">{t.app.subtitle}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200 space-y-2">
          {staffPermissions.isOwner && (
            <button
              onClick={() => setView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                view === 'settings'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <SettingsEmojiIcon className={`w-5 h-5 ${view === 'settings' ? 'text-blue-600' : 'text-gray-500'}`} />
              {t.nav.settings}
            </button>
          )}

          <div className="px-4 py-2">
            <LanguageSelector />
          </div>

          {staffPermissions.isStaff && (
            <div className="px-4 py-2 bg-blue-50 rounded-lg mx-2 mb-2">
              <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                <EmojiIcon emoji="🛡️" className="w-4 h-4" />
                {staffPermissions.staffName}
              </div>
              <div className="text-xs text-blue-600 capitalize">{staffPermissions.role}</div>
            </div>
          )}

          {clubPlanInfo && (
            <div className="mx-2 mb-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                <EmojiIcon emoji="👑" className="w-4 h-4" />
                Plano {clubPlanInfo.plan_type ? clubPlanInfo.plan_type.charAt(0).toUpperCase() + clubPlanInfo.plan_type.slice(1) : '—'}
              </div>
              {clubPlanInfo.contract_expires_at && (
                <div className="text-xs text-amber-600 mt-0.5">
                  Válido até {new Date(clubPlanInfo.contract_expires_at).toLocaleDateString('pt-PT')}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-2 text-xs text-gray-500 truncate">
            {user.email}
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all"
          >
            <LogOutIcon className="w-5 h-5 text-gray-500" />
            {t.auth.signOut}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
            <h1 className="text-lg font-bold text-gray-900">{t.app.title}</h1>
          </div>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
          >
            {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <nav className="px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    {item.label}
                  </button>
                );
              })}
              <hr className="my-2" />
              {staffPermissions.isOwner && (
                <button
                  onClick={() => {
                    setView('settings');
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === 'settings'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <SettingsEmojiIcon className={`w-5 h-5 ${view === 'settings' ? 'text-blue-600' : 'text-gray-500'}`} />
                  {t.nav.settings}
                </button>
              )}
              <div className="px-4 py-2">
                <LanguageSelector />
              </div>
              {staffPermissions.isStaff && (
                <div className="px-4 py-2 bg-blue-50 rounded-lg mx-2 my-2">
                  <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                    <EmojiIcon emoji="🛡️" className="w-4 h-4" />
                    {staffPermissions.staffName}
                  </div>
                  <div className="text-xs text-blue-600 capitalize">{staffPermissions.role}</div>
                </div>
              )}
              <div className="px-4 py-2 text-xs text-gray-500 truncate">
                {user.email}
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all"
              >
                <LogOutIcon className="w-5 h-5 text-gray-500" />
                {t.auth.signOut}
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-16 lg:pt-0 min-h-screen">
          {view === 'dashboard' && <Dashboard key={refreshKey} onNavigate={setView} staffPermissions={staffPermissions} />}
          {view === 'bookings' && staffPermissions.perm_bookings && <CourtBookings key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'members' && staffPermissions.perm_members && <MemberManagement key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'academy' && staffPermissions.perm_academy && <AcademyManagement key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'bar' && staffPermissions.perm_bar && (
            <BarManagement
              key={refreshKey}
              staffClubOwnerId={staffPermissions.clubOwnerId}
              staffRole={staffPermissions.isStaff ? staffPermissions.role : null}
            />
          )}
          {view === 'metrics' && staffPermissions.perm_reports && <ClubMetrics key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'open-games' && staffPermissions.perm_bookings && <OpenGamesManagement key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'rewards' && staffPermissions.perm_bookings && <RewardsManagement key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
          {view === 'staff' && staffPermissions.isOwner && <StaffManagement />}
          {view === 'settings' && staffPermissions.isOwner && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;
