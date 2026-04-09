import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2, Search, ChevronDown, ChevronUp, Ban, CheckCircle,
  MapPin, Phone, Mail, Globe, Users, Layers, Plus, X, Upload,
  Image, UserPlus, UserMinus, Link2
} from 'lucide-react';

interface Club {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  is_managed: boolean;
  status: string;
  plan_type: string;
  tour_license_active: boolean;
  created_at: string;
  logo_url: string | null;
  photo_url_1: string | null;
  photo_url_2: string | null;
}

interface ClubDetail {
  courtsCount: number;
  membersCount: number;
  staffCount: number;
}

interface ClubForm {
  name: string;
  description: string;
  city: string;
  address: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  photo_url_1: string;
  photo_url_2: string;
  plan_type: string;
}

const emptyForm: ClubForm = {
  name: '', description: '', city: '', address: '', country: 'Portugal',
  phone: '', email: '', website: '', logo_url: '', photo_url_1: '', photo_url_2: '',
  plan_type: 'basic',
};

export default function HQClubManagement() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterManaged, setFilterManaged] = useState<string>('all');
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ClubDetail>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<ClubForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const [showAssignOwner, setShowAssignOwner] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [assigningOwner, setAssigningOwner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photo1InputRef = useRef<HTMLInputElement>(null);
  const photo2InputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadClubs(); }, []);

  const loadClubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setClubs(data);
    setLoading(false);
  };

  const loadClubDetail = async (club: Club) => {
    if (details[club.id]) return;
    if (!club.owner_id) {
      setDetails(prev => ({ ...prev, [club.id]: { courtsCount: 0, membersCount: 0, staffCount: 0 } }));
      return;
    }
    const [courts, members, staff] = await Promise.all([
      supabase.from('club_courts').select('id', { count: 'exact', head: true }).eq('user_id', club.owner_id),
      supabase.from('member_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', club.owner_id),
      supabase.from('club_staff').select('id', { count: 'exact', head: true }).eq('club_owner_id', club.owner_id),
    ]);
    setDetails(prev => ({
      ...prev,
      [club.id]: { courtsCount: courts.count ?? 0, membersCount: members.count ?? 0, staffCount: staff.count ?? 0 }
    }));
  };

  const toggleExpand = (club: Club) => {
    if (expandedClub === club.id) {
      setExpandedClub(null);
    } else {
      setExpandedClub(club.id);
      loadClubDetail(club);
    }
  };

  const toggleStatus = async (club: Club) => {
    const newStatus = club.status === 'active' ? 'suspended' : 'active';
    setSaving(club.id);
    const { error } = await supabase.from('clubs').update({ status: newStatus }).eq('id', club.id);
    if (!error) setClubs(prev => prev.map(c => c.id === club.id ? { ...c, status: newStatus } : c));
    setSaving(null);
  };

  const changePlan = async (club: Club, newPlan: string) => {
    setSaving(club.id);
    const { error } = await supabase.from('clubs').update({ plan_type: newPlan }).eq('id', club.id);
    if (!error) setClubs(prev => prev.map(c => c.id === club.id ? { ...c, plan_type: newPlan } : c));
    setSaving(null);
  };

  // --- Upload photo to club-photos bucket ---
  const uploadPhoto = async (file: File, field: 'logo_url' | 'photo_url_1' | 'photo_url_2') => {
    setUploading(field);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `hq/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('club-photos').upload(path, file, { upsert: true });
      if (error) { alert('Erro upload: ' + error.message); return; }
      const { data: urlData } = supabase.storage.from('club-photos').getPublicUrl(path);
      setForm(prev => ({ ...prev, [field]: urlData.publicUrl }));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setUploading(null);
    }
  };

  // --- Create club (listing) ---
  const handleCreateClub = async () => {
    if (!form.name.trim()) { alert('O nome é obrigatório.'); return; }
    setCreating(true);
    const { error } = await supabase.from('clubs').insert({
      owner_id: null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      country: form.country.trim() || 'Portugal',
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      logo_url: form.logo_url || null,
      photo_url_1: form.photo_url_1 || null,
      photo_url_2: form.photo_url_2 || null,
      plan_type: form.plan_type,
      status: 'active',
      is_active: true,
      is_managed: false,
    });
    if (error) {
      alert('Erro ao criar clube: ' + error.message);
    } else {
      setShowCreateModal(false);
      setForm(emptyForm);
      loadClubs();
    }
    setCreating(false);
  };

  // --- Assign owner ---
  const handleAssignOwner = async (clubId: string) => {
    if (!ownerEmail.trim()) return;
    setAssigningOwner(true);
    const emailLower = ownerEmail.trim().toLowerCase();

    let userId: string | null = null;

    const { data: account } = await supabase
      .from('player_accounts')
      .select('user_id')
      .eq('email', emailLower)
      .maybeSingle();
    userId = account?.user_id ?? null;

    if (!userId) {
      const { data: player } = await supabase
        .from('players')
        .select('user_id')
        .eq('email', emailLower)
        .maybeSingle();
      userId = player?.user_id ?? null;
    }

    if (!userId) {
      alert('Utilizador não encontrado com este email. O utilizador precisa de ter uma conta registada.');
      setAssigningOwner(false);
      return;
    }

    const { error } = await supabase.from('clubs')
      .update({ owner_id: userId, is_managed: true })
      .eq('id', clubId);

    if (error) {
      alert('Erro: ' + error.message);
    } else {
      setShowAssignOwner(null);
      setOwnerEmail('');
      loadClubs();
    }
    setAssigningOwner(false);
  };

  // --- Remove owner ---
  const handleRemoveOwner = async (clubId: string) => {
    if (!confirm('Remover o dono deste clube? Volta a ser uma ficha não associada.')) return;
    setSaving(clubId);
    const { error } = await supabase.from('clubs')
      .update({ owner_id: null, is_managed: false })
      .eq('id', clubId);
    if (!error) {
      setClubs(prev => prev.map(c => c.id === clubId ? { ...c, owner_id: null, is_managed: false } : c));
    }
    setSaving(null);
  };

  const filtered = clubs.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterPlan !== 'all' && c.plan_type !== filterPlan) return false;
    if (filterManaged === 'managed' && !c.is_managed) return false;
    if (filterManaged === 'listing' && c.is_managed) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name?.toLowerCase().includes(s) || c.city?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    }
    return true;
  });

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
          <Building2 size={24} className="text-[#D32F2F]" />
          Gestão de Clubes
          <span className="text-sm font-normal text-gray-500 ml-2">({clubs.length})</span>
        </h1>
        <button
          onClick={() => { setForm(emptyForm); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors"
        >
          <Plus size={16} />
          Novo Clube
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Pesquisar por nome, cidade ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none">
          <option value="all">Todos os estados</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none">
          <option value="all">Todos os planos</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
        <select value={filterManaged} onChange={e => setFilterManaged(e.target.value)} className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none">
          <option value="all">Todos</option>
          <option value="managed">Associados</option>
          <option value="listing">Fichas (sem dono)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
          <div className="col-span-3">Clube</div>
          <div className="col-span-2">Cidade</div>
          <div className="col-span-1">Tipo</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-1">Plano</div>
          <div className="col-span-3">Ações</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum clube encontrado.</div>
        ) : (
          filtered.map(club => (
            <div key={club.id} className="border-b border-[#2a2a2a] last:border-b-0">
              <div
                className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-4 hover:bg-[#151515] transition-colors cursor-pointer items-center"
                onClick={() => toggleExpand(club)}
              >
                <div className="lg:col-span-3 flex items-center gap-3">
                  {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center">
                      <Building2 size={14} className="text-gray-500" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-100 truncate">{club.name}</span>
                </div>
                <div className="lg:col-span-2 text-sm text-gray-400 flex items-center gap-1">
                  <MapPin size={12} className="shrink-0" />
                  {club.city || '—'}
                </div>
                <div className="lg:col-span-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    club.is_managed ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {club.is_managed ? 'Associado' : 'Ficha'}
                  </span>
                </div>
                <div className="lg:col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    club.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${club.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                    {club.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </span>
                </div>
                <div className="lg:col-span-1">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    club.plan_type === 'pro' ? 'bg-[#D32F2F]/20 text-[#D32F2F]' : 'bg-[#2a2a2a] text-gray-400'
                  }`}>
                    {club.plan_type === 'pro' ? 'PRO' : 'Basic'}
                  </span>
                </div>
                <div className="lg:col-span-3 flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); toggleStatus(club); }}
                    disabled={saving === club.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      club.status === 'active'
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
                        : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    }`}
                  >
                    {club.status === 'active' ? <Ban size={12} /> : <CheckCircle size={12} />}
                    {club.status === 'active' ? 'Suspender' : 'Reativar'}
                  </button>
                  <select
                    value={club.plan_type}
                    onClick={e => e.stopPropagation()}
                    onChange={e => changePlan(club, e.target.value)}
                    disabled={saving === club.id}
                    className="px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                  </select>
                  {expandedClub === club.id ? <ChevronUp size={16} className="text-gray-500 ml-auto" /> : <ChevronDown size={16} className="text-gray-500 ml-auto" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedClub === club.id && (
                <div className="px-5 pb-5 space-y-4 bg-[#151515]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400"><Mail size={14} /> {club.email || '—'}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-400"><Phone size={14} /> {club.phone || '—'}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-400"><Globe size={14} /> {club.website || '—'}</div>
                    <div className="text-sm text-gray-500">Criado: {new Date(club.created_at).toLocaleDateString('pt-PT')}</div>
                    {details[club.id] && (
                      <>
                        <div className="flex items-center gap-2 text-sm text-gray-300"><Layers size={14} className="text-[#D32F2F]" /> {details[club.id].courtsCount} campos</div>
                        <div className="flex items-center gap-2 text-sm text-gray-300"><Users size={14} className="text-[#D32F2F]" /> {details[club.id].membersCount} membros</div>
                        <div className="flex items-center gap-2 text-sm text-gray-300"><Users size={14} className="text-[#D32F2F]" /> {details[club.id].staffCount} staff</div>
                      </>
                    )}
                  </div>

                  {/* Photos */}
                  {(club.photo_url_1 || club.photo_url_2) && (
                    <div className="flex gap-3">
                      {club.photo_url_1 && <img src={club.photo_url_1} alt="" className="h-20 rounded-lg object-cover border border-[#2a2a2a]" />}
                      {club.photo_url_2 && <img src={club.photo_url_2} alt="" className="h-20 rounded-lg object-cover border border-[#2a2a2a]" />}
                    </div>
                  )}

                  {/* Owner section */}
                  <div className="pt-3 border-t border-[#2a2a2a]">
                    {club.owner_id ? (
                      <div className="flex items-center gap-3">
                        <Link2 size={14} className="text-green-400" />
                        <span className="text-sm text-gray-300">Dono: <span className="text-gray-100 font-medium">{club.owner_id.slice(0, 8)}...</span></span>
                        <button
                          onClick={() => handleRemoveOwner(club.id)}
                          disabled={saving === club.id}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
                        >
                          <UserMinus size={12} /> Remover Dono
                        </button>
                      </div>
                    ) : (
                      <div>
                        {showAssignOwner === club.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="email"
                              placeholder="Email do futuro dono..."
                              value={ownerEmail}
                              onChange={e => setOwnerEmail(e.target.value)}
                              className="flex-1 max-w-xs px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50"
                            />
                            <button
                              onClick={() => handleAssignOwner(club.id)}
                              disabled={assigningOwner || !ownerEmail.trim()}
                              className="px-3 py-2 bg-[#D32F2F] text-white rounded-lg text-xs font-medium hover:bg-[#B71C1C] disabled:opacity-50"
                            >
                              {assigningOwner ? '...' : 'Associar'}
                            </button>
                            <button
                              onClick={() => { setShowAssignOwner(null); setOwnerEmail(''); }}
                              className="px-2 py-2 text-gray-500 hover:text-gray-300"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setShowAssignOwner(club.id); setOwnerEmail(''); }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#D32F2F]/10 text-[#D32F2F] hover:bg-[#D32F2F]/20 transition-colors"
                          >
                            <UserPlus size={14} /> Associar Dono
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Club Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg p-6 mt-10 mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Building2 size={20} className="text-[#D32F2F]" />
                Novo Clube (Ficha)
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" placeholder="Nome do clube" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Cidade</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">País</label>
                  <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Morada</label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Telefone</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Website</label>
                <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Plano</label>
                <select value={form.plan_type} onChange={e => setForm({ ...form, plan_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Logo</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0], 'logo_url'); }} />
                {form.logo_url ? (
                  <div className="flex items-center gap-3">
                    <img src={form.logo_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#2a2a2a]" />
                    <button onClick={() => setForm({ ...form, logo_url: '' })} className="text-xs text-red-400 hover:text-red-300">Remover</button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploading === 'logo_url'}
                    className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50 hover:text-gray-300 transition-colors">
                    <Upload size={14} /> {uploading === 'logo_url' ? 'A carregar...' : 'Carregar logo'}
                  </button>
                )}
              </div>

              {/* Photos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Foto 1</label>
                  <input ref={photo1InputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0], 'photo_url_1'); }} />
                  {form.photo_url_1 ? (
                    <div className="relative group">
                      <img src={form.photo_url_1} alt="" className="w-full h-24 object-cover rounded-lg border border-[#2a2a2a]" />
                      <button onClick={() => setForm({ ...form, photo_url_1: '' })}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                    </div>
                  ) : (
                    <button onClick={() => photo1InputRef.current?.click()} disabled={uploading === 'photo_url_1'}
                      className="w-full flex items-center justify-center gap-2 px-3 py-4 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50 transition-colors">
                      <Image size={14} /> {uploading === 'photo_url_1' ? '...' : 'Foto 1'}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Foto 2</label>
                  <input ref={photo2InputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0], 'photo_url_2'); }} />
                  {form.photo_url_2 ? (
                    <div className="relative group">
                      <img src={form.photo_url_2} alt="" className="w-full h-24 object-cover rounded-lg border border-[#2a2a2a]" />
                      <button onClick={() => setForm({ ...form, photo_url_2: '' })}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                    </div>
                  ) : (
                    <button onClick={() => photo2InputRef.current?.click()} disabled={uploading === 'photo_url_2'}
                      className="w-full flex items-center justify-center gap-2 px-3 py-4 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50 transition-colors">
                      <Image size={14} /> {uploading === 'photo_url_2' ? '...' : 'Foto 2'}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleCreateClub}
                disabled={creating || !form.name.trim()}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50"
              >
                {creating ? 'A criar...' : 'Criar Ficha do Clube'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
