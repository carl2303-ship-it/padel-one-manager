import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Building2, User, ToggleLeft, ToggleRight, Search, Plus, X } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  city: string | null;
  status: string;
  tour_license_active: boolean;
}

interface Organizer {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  club_name: string | null;
  subscription_status: string;
  subscription_plan: string;
  is_active: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  trial: 'bg-yellow-900/30 text-yellow-400',
  active: 'bg-green-900/30 text-green-400',
  expired: 'bg-red-900/30 text-red-400',
  cancelled: 'bg-gray-700/30 text-gray-400',
};

interface OrgForm {
  email: string;
  name: string;
  club_name: string;
  subscription_plan: string;
}

const emptyOrgForm: OrgForm = { email: '', name: '', club_name: '', subscription_plan: 'free' };

export default function HQTourLicenses() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'clubs' | 'organizers'>('clubs');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const [showAddOrg, setShowAddOrg] = useState(false);
  const [orgForm, setOrgForm] = useState<OrgForm>(emptyOrgForm);
  const [addingOrg, setAddingOrg] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [clubsRes, orgRes] = await Promise.all([
      supabase.from('clubs').select('id, name, city, status, tour_license_active').order('name'),
      supabase.from('organizers').select('*').order('created_at', { ascending: false }),
    ]);
    if (clubsRes.data) setClubs(clubsRes.data);
    if (orgRes.data) setOrganizers(orgRes.data);
    setLoading(false);
  };

  const toggleTourLicense = async (club: Club) => {
    setSaving(club.id);
    const { error } = await supabase
      .from('clubs')
      .update({ tour_license_active: !club.tour_license_active })
      .eq('id', club.id);
    if (!error) {
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, tour_license_active: !c.tour_license_active } : c));
    }
    setSaving(null);
  };

  const toggleOrganizerActive = async (org: Organizer) => {
    setSaving(org.id);
    const { error } = await supabase
      .from('organizers')
      .update({ is_active: !org.is_active })
      .eq('id', org.id);
    if (!error) {
      setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
    }
    setSaving(null);
  };

  const changeOrgPlan = async (org: Organizer, plan: string) => {
    setSaving(org.id);
    const { error } = await supabase
      .from('organizers')
      .update({ subscription_plan: plan })
      .eq('id', org.id);
    if (!error) {
      setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, subscription_plan: plan } : o));
    }
    setSaving(null);
  };

  const changeOrgStatus = async (org: Organizer, status: string) => {
    setSaving(org.id);
    const { error } = await supabase
      .from('organizers')
      .update({ subscription_status: status })
      .eq('id', org.id);
    if (!error) {
      setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, subscription_status: status } : o));
    }
    setSaving(null);
  };

  const handleAddOrganizer = async () => {
    if (!orgForm.email.trim() || !orgForm.name.trim()) { alert('Email e nome são obrigatórios.'); return; }
    setAddingOrg(true);
    const emailLower = orgForm.email.trim().toLowerCase();

    let userId: string | null = null;
    const { data: account } = await supabase.from('player_accounts').select('user_id').eq('email', emailLower).maybeSingle();
    userId = account?.user_id ?? null;

    if (!userId) {
      const { data: player } = await supabase.from('players').select('user_id').eq('email', emailLower).maybeSingle();
      userId = player?.user_id ?? null;
    }

    if (!userId) {
      alert('Utilizador não encontrado com este email. O utilizador precisa de ter uma conta registada.');
      setAddingOrg(false);
      return;
    }

    const { error } = await supabase.from('organizers').insert({
      user_id: userId,
      email: emailLower,
      name: orgForm.name.trim(),
      club_name: orgForm.club_name.trim() || null,
      subscription_plan: orgForm.subscription_plan,
      subscription_status: 'active',
      is_active: true,
    });

    if (error) {
      if (error.code === '23505') alert('Este utilizador já é organizador.');
      else alert('Erro: ' + error.message);
    } else {
      await supabase.from('user_logo_settings').update({
        is_paid_organizer: true,
        role: 'organizer',
      }).eq('user_id', userId);

      setShowAddOrg(false);
      setOrgForm(emptyOrgForm);
      loadData();
    }
    setAddingOrg(false);
  };

  const filteredClubs = clubs.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrgs = organizers.filter(o =>
    !search || o.email?.toLowerCase().includes(search.toLowerCase()) || o.name?.toLowerCase().includes(search.toLowerCase()) || o.club_name?.toLowerCase().includes(search.toLowerCase())
  );

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
          <Shield size={24} className="text-[#D32F2F]" />
          Licenças Tour
        </h1>
        {tab === 'organizers' && (
          <button onClick={() => { setOrgForm(emptyOrgForm); setShowAddOrg(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors">
            <Plus size={16} /> Adicionar Organizador
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0a0a] p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('clubs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'clubs' ? 'bg-[#D32F2F] text-white' : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          <Building2 size={14} className="inline mr-1.5" />
          Clubes ({clubs.length})
        </button>
        <button
          onClick={() => setTab('organizers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'organizers' ? 'bg-[#D32F2F] text-white' : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          <User size={14} className="inline mr-1.5" />
          Organizadores ({organizers.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50"
        />
      </div>

      {tab === 'clubs' ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
            <div className="col-span-4">Clube</div>
            <div className="col-span-2">Cidade</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-4">Tour License</div>
          </div>
          {filteredClubs.map(club => (
            <div key={club.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#151515] transition-colors items-center">
              <div className="lg:col-span-4 text-sm font-medium text-gray-100">{club.name}</div>
              <div className="lg:col-span-2 text-sm text-gray-400">{club.city || '—'}</div>
              <div className="lg:col-span-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  club.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}>
                  {club.status === 'active' ? 'Ativo' : 'Suspenso'}
                </span>
              </div>
              <div className="lg:col-span-4">
                <button
                  onClick={() => toggleTourLicense(club)}
                  disabled={saving === club.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    club.tour_license_active
                      ? 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                      : 'bg-[#2a2a2a] text-gray-500 hover:bg-[#333333]'
                  }`}
                >
                  {club.tour_license_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {club.tour_license_active ? 'Ativa' : 'Inativa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
            <div className="col-span-3">Organizador</div>
            <div className="col-span-2">Clube</div>
            <div className="col-span-2">Estado Sub.</div>
            <div className="col-span-2">Plano</div>
            <div className="col-span-3">Ações</div>
          </div>
          {filteredOrgs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum organizador encontrado.</div>
          ) : (
            filteredOrgs.map(org => (
              <div key={org.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#151515] transition-colors items-center">
                <div className="lg:col-span-3">
                  <div className="text-sm font-medium text-gray-100">{org.name || org.email}</div>
                  <div className="text-xs text-gray-500">{org.email}</div>
                </div>
                <div className="lg:col-span-2 text-sm text-gray-400">{org.club_name || '—'}</div>
                <div className="lg:col-span-2">
                  <select
                    value={org.subscription_status}
                    onChange={e => changeOrgStatus(org, e.target.value)}
                    disabled={saving === org.id}
                    className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[org.subscription_status] || 'bg-[#2a2a2a] text-gray-400'}`}
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Ativo</option>
                    <option value="expired">Expirado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <select
                    value={org.subscription_plan}
                    onChange={e => changeOrgPlan(org, e.target.value)}
                    disabled={saving === org.id}
                    className="px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <button
                    onClick={() => toggleOrganizerActive(org)}
                    disabled={saving === org.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      org.is_active
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
                        : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    }`}
                  >
                    {org.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Organizer Modal */}
      {showAddOrg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <User size={20} className="text-[#D32F2F]" />
                Adicionar Organizador
              </h2>
              <button onClick={() => setShowAddOrg(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                <input type="email" value={orgForm.email} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                <input type="text" value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="Nome do organizador"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Clube (opcional)</label>
                <input type="text" value={orgForm.club_name} onChange={e => setOrgForm({ ...orgForm, club_name: e.target.value })}
                  placeholder="Nome do clube"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Plano</label>
                <select value={orgForm.subscription_plan} onChange={e => setOrgForm({ ...orgForm, subscription_plan: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">O utilizador precisa de ter uma conta registada. Será marcado como organizador pago em user_logo_settings.</p>
              <button onClick={handleAddOrganizer} disabled={addingOrg || !orgForm.email.trim() || !orgForm.name.trim()}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50">
                {addingOrg ? 'A adicionar...' : 'Adicionar Organizador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
