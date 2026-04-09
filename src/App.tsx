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
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
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
    
    if (window.location.hash === '#super-admin' || urlParams.get('super-admin') !== null) {
      setShowSuperAdmin(true);
    }
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
      checkStaffPermissions();
    }
  }, [user]);

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
      setStaffPermissions({
        isStaff: true,
        isOwner: false,
        clubOwnerId: staffData.club_owner_id,
        staffName: staffData.name,
        perm_bookings: staffData.perm_bookings || staffData.role === 'admin',
        perm_members: staffData.perm_members || staffData.role === 'admin',
        perm_bar: staffData.perm_bar || staffData.role === 'admin',
        perm_academy: staffData.perm_academy || staffData.role === 'admin',
        perm_reports: staffData.perm_reports || staffData.role === 'admin',
        role: staffData.role
      });
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

  const pricingMatch = pathname.match(/^\/pricing\/([a-f0-9-]+)$/i);
  if (pricingMatch) {
    return <PublicPricing clubId={pricingMatch[1]} />;
  }

  if (authLoading || checkingPermissions) {
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
    return <AuthForm />;
  }

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
    if (item.permission === 'always') return true;
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
          {view === 'bar' && staffPermissions.perm_bar && <BarManagement key={refreshKey} staffClubOwnerId={staffPermissions.clubOwnerId} />}
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
