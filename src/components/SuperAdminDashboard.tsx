import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';
import {
  Shield,
  Users,
  Building2,
  Search,
  Edit2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Globe,
  AlertCircle,
  Trophy,
  CreditCard
} from 'lucide-react';

interface Organizer {
  id: string;
  user_id: string;
  email: string;
  logo_url: string | null;
  is_paid_organizer: boolean;
  created_at: string;
  tournament_count: number;
  club_name: string | null;
}

interface Club {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner_email?: string;
}

interface Stats {
  totalOrganizers: number;
  paidOrganizers: number;
  totalClubs: number;
  activeClubs: number;
}

type TabType = 'organizers' | 'clubs';

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stats, setStats] = useState<Stats>({ totalOrganizers: 0, paidOrganizers: 0, totalClubs: 0, activeClubs: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('organizers');

  useEffect(() => {
    if (user) {
      checkSuperAdmin();
    }
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setIsSuperAdmin(true);
      loadData();
    } else {
      setIsSuperAdmin(false);
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadOrganizers(), loadClubs()]);
    setLoading(false);
  };

  const loadOrganizers = async () => {
    const { data: organizersData } = await supabase
      .from('user_logo_settings')
      .select('*')
      .eq('is_paid_organizer', true)
      .order('created_at', { ascending: false });

    if (!organizersData) {
      setOrganizers([]);
      return;
    }

    const userIds = organizersData.map(o => o.user_id);

    let usersData = null;
    try {
      const { data } = await supabase.rpc('get_organizer_emails', { organizer_ids: userIds });
      usersData = data;
    } catch {
      usersData = null;
    }

    const { data: tournamentsData } = await supabase
      .from('tournaments')
      .select('user_id')
      .in('user_id', userIds);

    const tournamentCounts: Record<string, number> = {};
    tournamentsData?.forEach(t => {
      tournamentCounts[t.user_id] = (tournamentCounts[t.user_id] || 0) + 1;
    });

    const { data: clubsData } = await supabase
      .from('clubs')
      .select('owner_id, name')
      .in('owner_id', userIds);

    const clubNames: Record<string, string> = {};
    clubsData?.forEach(c => {
      clubNames[c.owner_id] = c.name;
    });

    const organizerList: Organizer[] = organizersData.map(org => {
      const userData = usersData?.find((u: { id: string }) => u.id === org.user_id);
      return {
        id: org.id,
        user_id: org.user_id,
        email: userData?.email || 'N/A',
        logo_url: org.logo_url,
        is_paid_organizer: org.is_paid_organizer,
        created_at: org.created_at,
        tournament_count: tournamentCounts[org.user_id] || 0,
        club_name: clubNames[org.user_id] || null
      };
    });

    setOrganizers(organizerList);
    setStats(prev => ({
      ...prev,
      totalOrganizers: organizerList.length,
      paidOrganizers: organizerList.filter(o => o.is_paid_organizer).length
    }));
  };

  const loadClubs = async () => {
    const { data: clubsData } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });

    const clubList = clubsData || [];
    setClubs(clubList);

    setStats(prev => ({
      ...prev,
      totalClubs: clubList.length,
      activeClubs: clubList.filter(c => c.is_active).length
    }));
  };

  const toggleOrganizerPaid = async (organizer: Organizer) => {
    const { error } = await supabase
      .from('user_logo_settings')
      .update({ is_paid_organizer: !organizer.is_paid_organizer, updated_at: new Date().toISOString() })
      .eq('id', organizer.id);

    if (!error) {
      loadOrganizers();
    }
  };

  const toggleClubActive = async (club: Club) => {
    const { error } = await supabase
      .from('clubs')
      .update({ is_active: !club.is_active, updated_at: new Date().toISOString() })
      .eq('id', club.id);

    if (!error) {
      loadClubs();
    }
  };

  const updateClub = async (club: Club) => {
    const { error } = await supabase
      .from('clubs')
      .update({
        name: club.name,
        description: club.description,
        address: club.address,
        city: club.city,
        country: club.country,
        phone: club.phone,
        email: club.email,
        website: club.website,
        updated_at: new Date().toISOString()
      })
      .eq('id', club.id);

    if (!error) {
      setEditingClub(null);
      loadClubs();
    }
  };

  const filteredOrganizers = organizers.filter(org => {
    const matchesSearch = org.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.club_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'paid' && org.is_paid_organizer) ||
      (filterStatus === 'free' && !org.is_paid_organizer);

    return matchesSearch && matchesFilter;
  });

  const filteredClubs = clubs.filter(club => {
    const matchesSearch =
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'active' && club.is_active) ||
      (filterStatus === 'inactive' && !club.is_active);

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">A carregar...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
          <p className="text-gray-600">
            Esta area e reservada para administradores da plataforma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
              <p className="text-sm text-gray-600">Gestao de Organizadores e Clubes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalOrganizers}</div>
            <div className="text-sm text-gray-600">Total Organizadores</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.paidOrganizers}</div>
            <div className="text-sm text-gray-600">Organizadores Pagos</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalClubs}</div>
            <div className="text-sm text-gray-600">Total Clubes</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Trophy className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.activeClubs}</div>
            <div className="text-sm text-gray-600">Clubes Ativos</div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setActiveTab('organizers'); setFilterStatus('all'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'organizers'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Organizadores
          </button>
          <button
            onClick={() => { setActiveTab('clubs'); setFilterStatus('all'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'clubs'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Clubes
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'organizers' ? 'Pesquisar por email...' : 'Pesquisar por nome, email ou cidade...'}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {activeTab === 'organizers' ? (
                  <>
                    <option value="all">Todos</option>
                    <option value="paid">Pagos</option>
                    <option value="free">Gratuitos</option>
                  </>
                ) : (
                  <>
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {activeTab === 'organizers' ? (
            filteredOrganizers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sem organizadores</h3>
                <p className="text-gray-600">Nenhum organizador encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredOrganizers.map((organizer) => (
                  <div key={organizer.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start gap-4">
                      {organizer.logo_url ? (
                        <img
                          src={organizer.logo_url}
                          alt="Logo"
                          className="w-12 h-12 rounded-lg object-contain bg-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Users className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{organizer.email}</h3>
                          {organizer.is_paid_organizer ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                              Pago
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              Gratuito
                            </span>
                          )}
                        </div>
                        {organizer.club_name && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <Building2 className="w-3 h-3" />
                            {organizer.club_name}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {organizer.tournament_count} torneios
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Registado: {formatDate(organizer.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleOrganizerPaid(organizer)}
                          className={`p-2 rounded-lg transition ${
                            organizer.is_paid_organizer
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={organizer.is_paid_organizer ? 'Marcar como gratuito' : 'Marcar como pago'}
                        >
                          {organizer.is_paid_organizer ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredClubs.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sem clubes</h3>
                <p className="text-gray-600">Nenhum clube encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredClubs.map((club) => (
                  <div key={club.id} className="p-4 hover:bg-gray-50 transition">
                    {editingClub?.id === club.id ? (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Clube</label>
                            <input
                              type="text"
                              value={editingClub.name}
                              onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                              type="email"
                              value={editingClub.email || ''}
                              onChange={(e) => setEditingClub({ ...editingClub, email: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                            <input
                              type="tel"
                              value={editingClub.phone || ''}
                              onChange={(e) => setEditingClub({ ...editingClub, phone: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                            <input
                              type="url"
                              value={editingClub.website || ''}
                              onChange={(e) => setEditingClub({ ...editingClub, website: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Morada</label>
                            <input
                              type="text"
                              value={editingClub.address || ''}
                              onChange={(e) => setEditingClub({ ...editingClub, address: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                            <input
                              type="text"
                              value={editingClub.city || ''}
                              onChange={(e) => setEditingClub({ ...editingClub, city: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
                          <textarea
                            value={editingClub.description || ''}
                            onChange={(e) => setEditingClub({ ...editingClub, description: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateClub(editingClub)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingClub(null)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        {club.logo_url ? (
                          <img
                            src={club.logo_url}
                            alt={club.name}
                            className="w-12 h-12 rounded-lg object-contain bg-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{club.name}</h3>
                            {club.is_active ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                                Ativo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                Inativo
                              </span>
                            )}
                          </div>
                          {club.city && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <MapPin className="w-3 h-3" />
                              {club.city}, {club.country}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                            {club.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {club.email}
                              </span>
                            )}
                            {club.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {club.phone}
                              </span>
                            )}
                            {club.website && (
                              <a
                                href={club.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Globe className="w-3 h-3" />
                                Website
                              </a>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Criado: {formatDate(club.created_at)}
                            </span>
                          </div>
                          {club.description && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {club.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setEditingClub(club)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleClubActive(club)}
                            className={`p-2 rounded-lg transition ${
                              club.is_active
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={club.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {club.is_active ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
