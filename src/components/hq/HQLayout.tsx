import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/authContext';
import {
  LayoutDashboard,
  Building2,
  Crown,
  ArrowLeftRight,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Zap
} from 'lucide-react';
import HQDashboard from './HQDashboard';
import HQClubManagement from './HQClubManagement';
import HQTransactions from './HQTransactions';
import HQMetrics from './HQMetrics';
import HQOrganizers from './HQOrganizers';
import HQUsers from './HQUsers';
import HQSettings from './HQSettings';

type HQView = 'dashboard' | 'clubs' | 'organizers' | 'transactions' | 'metrics' | 'users' | 'settings';

interface NavItem {
  id: HQView;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'clubs', label: 'Clubes', icon: <Building2 size={20} /> },
  { id: 'organizers', label: 'Organizadores', icon: <Crown size={20} /> },
  { id: 'transactions', label: 'Transações', icon: <ArrowLeftRight size={20} /> },
  { id: 'metrics', label: 'Métricas', icon: <BarChart3 size={20} /> },
  { id: 'users', label: 'Utilizadores', icon: <Users size={20} /> },
  { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
];

export default function HQLayout() {
  const { user, signOut } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<HQView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) checkSuperAdmin();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsSuperAdmin(!!data);
  };

  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D32F2F]" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto text-[#D32F2F] mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Acesso Negado</h1>
          <p className="text-gray-400">Não tens permissões de Super Admin.</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <HQDashboard />;
      case 'clubs': return <HQClubManagement />;
      case 'organizers': return <HQOrganizers />;
      case 'transactions': return <HQTransactions />;
      case 'metrics': return <HQMetrics />;
      case 'users': return <HQUsers />;
      case 'settings': return <HQSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-[#1a1a1a]">
          <div className="w-8 h-8 rounded-lg bg-[#D32F2F] flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 leading-tight">Padel One</h1>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#D32F2F]">HQ</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${currentView === item.id
                  ? 'bg-[#D32F2F]/10 text-[#D32F2F]'
                  : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-100'}
              `}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="text-xs text-gray-500 mb-3 truncate">{user?.email}</div>
          <button
            onClick={() => { window.location.hash = ''; signOut(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-100 transition-colors"
          >
            <LogOut size={16} />
            Terminar Sessão
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar (mobile) */}
        <header className="h-16 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-100">
            <Menu size={24} />
          </button>
          <div className="ml-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#D32F2F] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-gray-100">Padel One HQ</span>
          </div>
        </header>

        <div className="p-4 lg:p-8 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}
