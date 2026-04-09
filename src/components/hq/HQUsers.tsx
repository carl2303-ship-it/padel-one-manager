import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Search, UserCircle, Phone, Mail, Calendar, Star, ShieldPlus, X, Trash2 } from 'lucide-react';

interface PlayerAccount {
  id: string;
  name: string;
  phone_number: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  avatar_url: string | null;
  player_category: string | null;
  favorite_club_id: string | null;
  total_reward_points: number | null;
  created_at: string;
}

interface UserLogoSetting {
  user_id: string;
  role: string | null;
  is_paid_organizer: boolean | null;
}

interface CombinedUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'player' | 'manager' | 'organizer' | 'super_admin';
  category: string;
  rewardPoints: number;
  createdAt: string;
  avatarUrl: string | null;
}

interface SuperAdmin {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export default function HQUsers() {
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [showAdminList, setShowAdminList] = useState(false);

  useEffect(() => { loadUsers(); loadSuperAdmins(); }, []);

  const loadSuperAdmins = async () => {
    const { data } = await supabase.from('super_admins').select('*').order('created_at', { ascending: false });
    if (data) setSuperAdmins(data);
  };

  const handleAddSuperAdmin = async () => {
    if (!adminEmail.trim() || !adminName.trim()) { alert('Email e nome são obrigatórios.'); return; }
    setAddingAdmin(true);
    const emailLower = adminEmail.trim().toLowerCase();

    let userId: string | null = null;
    const { data: account } = await supabase.from('player_accounts').select('user_id').eq('email', emailLower).maybeSingle();
    userId = account?.user_id ?? null;

    if (!userId) {
      const { data: player } = await supabase.from('players').select('user_id').eq('email', emailLower).maybeSingle();
      userId = player?.user_id ?? null;
    }

    if (!userId) {
      alert('Utilizador não encontrado com este email. O utilizador precisa de ter uma conta registada.');
      setAddingAdmin(false);
      return;
    }

    const { error } = await supabase.from('super_admins').insert({ user_id: userId, name: adminName.trim() });
    if (error) {
      if (error.code === '23505') alert('Este utilizador já é super admin.');
      else alert('Erro: ' + error.message);
    } else {
      setShowAddAdmin(false);
      setAdminEmail('');
      setAdminName('');
      loadSuperAdmins();
      loadUsers();
    }
    setAddingAdmin(false);
  };

  const handleRemoveSuperAdmin = async (sa: SuperAdmin) => {
    if (!confirm(`Remover "${sa.name}" como super admin?`)) return;
    const { error } = await supabase.from('super_admins').delete().eq('id', sa.id);
    if (error) alert('Erro: ' + error.message);
    else { loadSuperAdmins(); loadUsers(); }
  };

  const loadUsers = async () => {
    setLoading(true);

    const [playersRes, settingsRes, superRes, clubsRes] = await Promise.all([
      supabase.from('player_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('user_logo_settings').select('user_id, role, is_paid_organizer'),
      supabase.from('super_admins').select('user_id'),
      supabase.from('clubs').select('owner_id'),
    ]);

    const players = playersRes.data || [];
    const settings = settingsRes.data || [];
    const superAdminIds = new Set((superRes.data || []).map(s => s.user_id));
    const clubOwnerIds = new Set((clubsRes.data || []).map(c => c.owner_id));
    const settingsByUserId = new Map(settings.map(s => [s.user_id, s]));

    const combined: CombinedUser[] = players.map(p => {
      let role: CombinedUser['role'] = 'player';
      if (p.user_id && superAdminIds.has(p.user_id)) role = 'super_admin';
      else if (p.user_id && clubOwnerIds.has(p.user_id)) role = 'manager';
      else if (p.user_id) {
        const setting = settingsByUserId.get(p.user_id);
        if (setting?.role === 'organizer' || setting?.is_paid_organizer) role = 'organizer';
      }

      return {
        id: p.id,
        name: p.name || '—',
        phone: p.phone_number || p.phone || '—',
        email: p.email || '—',
        role,
        category: p.player_category || '—',
        rewardPoints: p.total_reward_points || 0,
        createdAt: p.created_at,
        avatarUrl: p.avatar_url,
      };
    });

    setUsers(combined);
    setLoading(false);
  };

  const filtered = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (search) {
      const s = search.toLowerCase();
      return u.name.toLowerCase().includes(s) || u.phone.includes(s) || u.email.toLowerCase().includes(s);
    }
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const ROLE_LABELS: Record<string, string> = {
    player: 'Jogador',
    manager: 'Manager',
    organizer: 'Organizador',
    super_admin: 'Super Admin',
  };

  const ROLE_COLORS: Record<string, string> = {
    player: 'bg-blue-900/30 text-blue-400',
    manager: 'bg-green-900/30 text-green-400',
    organizer: 'bg-purple-900/30 text-purple-400',
    super_admin: 'bg-[#D32F2F]/20 text-[#D32F2F]',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#D32F2F]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Users size={24} className="text-[#D32F2F]" />
          Utilizadores
          <span className="text-sm font-normal text-gray-500 ml-2">({users.length})</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAdminList(!showAdminList)}
            className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-gray-300 hover:bg-[#2a2a2a]">
            <ShieldPlus size={14} className="text-[#D32F2F]" />
            Super Admins ({superAdmins.length})
          </button>
          <button onClick={() => setShowAddAdmin(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors">
            <ShieldPlus size={16} /> Adicionar Super Admin
          </button>
        </div>
      </div>

      {/* Super Admin list */}
      {showAdminList && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Super Admins</h3>
          {superAdmins.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum super admin registado.</p>
          ) : (
            <div className="space-y-2">
              {superAdmins.map(sa => (
                <div key={sa.id} className="flex items-center justify-between py-2 px-3 bg-[#151515] rounded-lg">
                  <div>
                    <span className="text-sm text-gray-100 font-medium">{sa.name}</span>
                    <span className="text-xs text-gray-500 ml-3">{sa.user_id.slice(0, 8)}...</span>
                  </div>
                  <button onClick={() => handleRemoveSuperAdmin(sa)}
                    className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Pesquisar por nome, telefone ou email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setPage(0); }}
          className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none"
        >
          <option value="all">Todos os tipos</option>
          <option value="player">Jogadores</option>
          <option value="manager">Managers</option>
          <option value="organizer">Organizadores</option>
          <option value="super_admin">Super Admins</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
          <div className="col-span-3">Nome</div>
          <div className="col-span-2">Telefone</div>
          <div className="col-span-2">Email</div>
          <div className="col-span-1">Tipo</div>
          <div className="col-span-1">Cat.</div>
          <div className="col-span-1">Pontos</div>
          <div className="col-span-2">Registo</div>
        </div>

        {paginated.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum utilizador encontrado.</div>
        ) : (
          paginated.map(u => (
            <div key={u.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#151515] transition-colors items-center">
              <div className="lg:col-span-3 flex items-center gap-2">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <UserCircle size={20} className="text-gray-600 shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-100 truncate">{u.name}</span>
              </div>
              <div className="lg:col-span-2 text-sm text-gray-400 flex items-center gap-1">
                <Phone size={12} className="shrink-0" />{u.phone}
              </div>
              <div className="lg:col-span-2 text-sm text-gray-400 truncate flex items-center gap-1">
                <Mail size={12} className="shrink-0" />{u.email}
              </div>
              <div className="lg:col-span-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLORS[u.role]}`}>
                  {ROLE_LABELS[u.role]}
                </span>
              </div>
              <div className="lg:col-span-1 text-xs text-gray-400">{u.category}</div>
              <div className="lg:col-span-1 text-sm text-gray-300 flex items-center gap-1">
                <Star size={12} className="text-[#D32F2F]" />{u.rewardPoints}
              </div>
              <div className="lg:col-span-2 text-xs text-gray-500 flex items-center gap-1">
                <Calendar size={12} />{new Date(u.createdAt).toLocaleDateString('pt-PT')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-gray-300 hover:bg-[#2a2a2a] disabled:opacity-30"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-gray-300 hover:bg-[#2a2a2a] disabled:opacity-30"
            >
              Seguinte
            </button>
          </div>
        </div>
      )}

      {/* Add Super Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <ShieldPlus size={20} className="text-[#D32F2F]" />
                Adicionar Super Admin
              </h2>
              <button onClick={() => setShowAddAdmin(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email do utilizador *</label>
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)}
                  placeholder="Nome do admin"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <p className="text-xs text-gray-500">O utilizador precisa de ter uma conta registada. O email será pesquisado na base de dados.</p>
              <button onClick={handleAddSuperAdmin} disabled={addingAdmin || !adminEmail.trim() || !adminName.trim()}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50">
                {addingAdmin ? 'A adicionar...' : 'Adicionar Super Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
