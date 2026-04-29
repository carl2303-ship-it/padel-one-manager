import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2, Search, ChevronDown, ChevronUp, Ban, CheckCircle,
  MapPin, Phone, Mail, Globe, Users, Layers, Plus, X, Upload,
  Image, UserPlus, UserMinus, Link2, Edit2, Key, Calendar, Copy, Check, ExternalLink, Send
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
  contract_start: string | null;
  contract_expires_at: string | null;
}

interface ClubLicenseKey {
  id: string;
  license_key: string;
  plan_name: string;
  duration_months: number;
  status: string;
  custom_price: number | null;
  created_at: string;
  activated_at: string | null;
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
  plan_type: 'bronze',
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

  const [editingClub, setEditingClub] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClubForm>(emptyForm);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyTargetClub, setKeyTargetClub] = useState<Club | null>(null);
  const [keyForm, setKeyForm] = useState({ plan_name: 'Bronze', duration_months: 12, custom_price: '' });
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [clubKeys, setClubKeys] = useState<ClubLicenseKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copiedCheckout, setCopiedCheckout] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<Club | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingTarget, setBillingTarget] = useState<Club | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [contractDates, setContractDates] = useState<Record<string, { start: string; expires: string }>>({});
  const [savingContract, setSavingContract] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photo1InputRef = useRef<HTMLInputElement>(null);
  const photo2InputRef = useRef<HTMLInputElement>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);
  const editPhoto1Ref = useRef<HTMLInputElement>(null);
  const editPhoto2Ref = useRef<HTMLInputElement>(null);

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
      loadClubKeys(club.id);
      initContractDates(club);
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

  const generateLicenseKey = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `PADEL-${seg()}-${seg()}-${seg()}`;
  };

  const openClubKeyModal = (club: Club) => {
    setKeyTargetClub(club);
    const tierMap: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
    setKeyForm({ plan_name: tierMap[club.plan_type] || 'Bronze', duration_months: 12, custom_price: '' });
    setGeneratedKey(null); setCopiedKey(false);
    setShowKeyModal(true);
  };

  const handleGenerateClubKey = async () => {
    if (!keyTargetClub) return;
    setGeneratingKey(true);
    const key = generateLicenseKey();
    const { error } = await supabase.from('license_keys').insert({
      license_key: key, target_type: 'club', plan_name: keyForm.plan_name,
      duration_months: keyForm.duration_months, target_entity_id: keyTargetClub.id,
      target_user_id: keyTargetClub.owner_id, custom_price: keyForm.custom_price ? parseFloat(keyForm.custom_price) : null,
      status: 'active',
    });
    if (error) alert('Erro: ' + error.message);
    else setGeneratedKey(key);
    setGeneratingKey(false);
  };

  const copyClubKey = () => {
    if (generatedKey) { navigator.clipboard.writeText(generatedKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
  };

  const loadClubKeys = async (clubId: string) => {
    setLoadingKeys(true);
    const { data } = await supabase.from('license_keys').select('*')
      .eq('target_entity_id', clubId).eq('target_type', 'club')
      .order('created_at', { ascending: false });
    if (data) setClubKeys(data);
    setLoadingKeys(false);
  };

  const initContractDates = (club: Club) => {
    if (!contractDates[club.id]) {
      setContractDates(prev => ({
        ...prev,
        [club.id]: {
          start: club.contract_start ? club.contract_start.split('T')[0] : '',
          expires: club.contract_expires_at ? club.contract_expires_at.split('T')[0] : '',
        }
      }));
    }
  };

  const saveContractDates = async (clubId: string) => {
    const dates = contractDates[clubId];
    if (!dates) return;
    setSavingContract(clubId);
    const { error } = await supabase.from('clubs').update({
      contract_start: dates.start || null,
      contract_expires_at: dates.expires || null,
    }).eq('id', clubId);
    if (error) { alert('Erro: ' + error.message); }
    else {
      setClubs(prev => prev.map(c => c.id === clubId ? { ...c, contract_start: dates.start || null, contract_expires_at: dates.expires || null } : c));
    }
    setSavingContract(null);
  };

  const handleSendCheckoutEmail = async () => {
    if (!checkoutUrl || !checkoutTarget?.email) return;
    setSendingEmail(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://rqiwnxcexsccguruiteq.supabase.co'}/functions/v1/send-checkout-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
          body: JSON.stringify({
            to_email: checkoutTarget.email,
            to_name: checkoutTarget.name,
            checkout_url: checkoutUrl,
            plan_name: ({ bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as Record<string,string>)[checkoutTarget.plan_type] || 'Bronze',
            target_type: 'club',
          }),
        }
      );
      const result = await resp.json();
      if (result.ok) { setEmailSent(true); setTimeout(() => setEmailSent(false), 3000); }
      else alert(result.error || 'Erro ao enviar email');
    } catch { alert('Erro de rede'); }
    setSendingEmail(false);
  };

  const openBillingModal = (club: Club) => {
    setBillingTarget(club);
    setBillingInterval('year');
    setShowBillingModal(true);
  };

  const handleCreateClubCheckout = async () => {
    if (!billingTarget) return;
    const club = billingTarget;
    setCreatingCheckout(true);
    setCheckoutUrl(null);
    setCheckoutTarget(club);
    setEmailSent(false);
    setShowBillingModal(false);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://rqiwnxcexsccguruiteq.supabase.co'}/functions/v1/create-platform-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
          body: JSON.stringify({
            target_type: 'club',
            plan_name: ({ bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as Record<string,string>)[club.plan_type] || 'Bronze',
            duration_months: billingInterval === 'month' ? 1 : 12,
            billing_interval: billingInterval,
            target_entity_id: club.id,
            payer_email: club.email,
            success_url: window.location.origin + '/?payment=success',
            cancel_url: window.location.origin + '/?payment=cancelled',
          }),
        }
      );
      const result = await resp.json();
      if (result.ok && result.url) setCheckoutUrl(result.url);
      else alert(result.error || 'Erro ao criar link');
    } catch { alert('Erro de rede'); }
    setCreatingCheckout(false);
  };

  const copyCheckoutUrl = () => {
    if (checkoutUrl) { navigator.clipboard.writeText(checkoutUrl); setCopiedCheckout(true); setTimeout(() => setCopiedCheckout(false), 2000); }
  };

  const contractBadge = (club: Club) => {
    if (!club.contract_expires_at) return { text: 'Sem contrato', cls: 'bg-gray-700/30 text-gray-500' };
    const days = Math.ceil((new Date(club.contract_expires_at).getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: `Expirado há ${Math.abs(days)}d`, cls: 'bg-red-900/30 text-red-400' };
    if (days <= 30) return { text: `Expira em ${days}d`, cls: 'bg-yellow-900/30 text-yellow-400' };
    return { text: `${days}d restantes`, cls: 'bg-green-900/30 text-green-400' };
  };

  const uploadEditPhoto = async (file: File, field: 'logo_url' | 'photo_url_1' | 'photo_url_2') => {
    setUploading('edit_' + field);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `hq/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('club-photos').upload(path, file, { upsert: true });
      if (error) { alert('Erro upload: ' + error.message); return; }
      const { data: urlData } = supabase.storage.from('club-photos').getPublicUrl(path);
      setEditForm(prev => ({ ...prev, [field]: urlData.publicUrl }));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setUploading(null);
    }
  };

  const startEditClub = (club: Club) => {
    setEditingClub(club.id);
    setEditForm({
      name: club.name || '',
      description: club.description || '',
      city: club.city || '',
      address: club.address || '',
      country: club.country || 'Portugal',
      phone: club.phone || '',
      email: club.email || '',
      website: club.website || '',
      logo_url: club.logo_url || '',
      photo_url_1: club.photo_url_1 || '',
      photo_url_2: club.photo_url_2 || '',
      plan_type: club.plan_type || 'bronze',
    });
  };

  const handleUpdateClub = async (clubId: string) => {
    setSaving(clubId);
    const { error } = await supabase.from('clubs').update({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      city: editForm.city.trim() || null,
      address: editForm.address.trim() || null,
      country: editForm.country.trim() || 'Portugal',
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      website: editForm.website.trim() || null,
      logo_url: editForm.logo_url || null,
      photo_url_1: editForm.photo_url_1 || null,
      photo_url_2: editForm.photo_url_2 || null,
      plan_type: editForm.plan_type,
    }).eq('id', clubId);
    if (!error) {
      setEditingClub(null);
      loadClubs();
    } else {
      alert('Erro: ' + error.message);
    }
    setSaving(null);
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
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="preview">Preview</option>
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
          <div className="col-span-1">Estado</div>
          <div className="col-span-1">Plano</div>
          <div className="col-span-2">Contrato</div>
          <div className="col-span-2">Ações</div>
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
                <div className="lg:col-span-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    club.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${club.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                    {club.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </span>
                </div>
                <div className="lg:col-span-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    club.plan_type === 'gold' ? 'bg-yellow-900/20 text-yellow-400' :
                    club.plan_type === 'silver' ? 'bg-gray-700/30 text-gray-300' :
                    club.plan_type === 'preview' ? 'bg-amber-900/30 text-amber-400' :
                    'bg-amber-900/20 text-amber-500'
                  }`}>
                    {club.plan_type === 'gold' ? 'Gold' : club.plan_type === 'silver' ? 'Silver' : club.plan_type === 'preview' ? 'Preview' : 'Bronze'}
                  </span>
                </div>
                <div className="lg:col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${contractBadge(club).cls}`}>
                    <Calendar size={10} />{contractBadge(club).text}
                  </span>
                  {club.contract_expires_at && (
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      até {new Date(club.contract_expires_at).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-2 flex items-center gap-2">
                  <select
                    value={club.plan_type}
                    onClick={e => e.stopPropagation()}
                    onChange={e => changePlan(club, e.target.value)}
                    disabled={saving === club.id}
                    className="px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="preview">Preview</option>
                  </select>
                  <button
                    onClick={e => { e.stopPropagation(); toggleStatus(club); }}
                    disabled={saving === club.id}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      club.status === 'active'
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
                        : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    }`}
                  >
                    {club.status === 'active' ? <Ban size={10} /> : <CheckCircle size={10} />}
                  </button>
                  {expandedClub === club.id ? <ChevronUp size={14} className="text-gray-500 ml-auto" /> : <ChevronDown size={14} className="text-gray-500 ml-auto" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedClub === club.id && (
                <div className="px-5 pb-5 space-y-4 bg-[#151515]">
                  {editingClub === club.id ? (
                    <div className="space-y-4">
                      <input ref={editLogoRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) uploadEditPhoto(e.target.files[0], 'logo_url'); }} />
                      <input ref={editPhoto1Ref} type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) uploadEditPhoto(e.target.files[0], 'photo_url_1'); }} />
                      <input ref={editPhoto2Ref} type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) uploadEditPhoto(e.target.files[0], 'photo_url_2'); }} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                          <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                          <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Telefone</label>
                          <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Website</label>
                          <input type="text" value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Morada</label>
                          <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Cidade</label>
                          <input type="text" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">País</label>
                          <input type="text" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Plano</label>
                          <select value={editForm.plan_type} onChange={e => setEditForm({ ...editForm, plan_type: e.target.value })}
                            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                            <option value="bronze">Bronze</option>
                            <option value="silver">Silver</option>
                            <option value="gold">Gold</option>
                            <option value="preview">Preview</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
                        <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          rows={2} className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none resize-none" />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Logo</label>
                          {editForm.logo_url ? (
                            <div className="flex items-center gap-2">
                              <img src={editForm.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#2a2a2a]" />
                              <button onClick={() => setEditForm({ ...editForm, logo_url: '' })} className="text-xs text-red-400">Remover</button>
                            </div>
                          ) : (
                            <button onClick={() => editLogoRef.current?.click()} disabled={uploading === 'edit_logo_url'}
                              className="flex items-center gap-1 px-2 py-1.5 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50">
                              <Upload size={12} /> {uploading === 'edit_logo_url' ? '...' : 'Logo'}
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Foto 1</label>
                          {editForm.photo_url_1 ? (
                            <div className="flex items-center gap-2">
                              <img src={editForm.photo_url_1} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#2a2a2a]" />
                              <button onClick={() => setEditForm({ ...editForm, photo_url_1: '' })} className="text-xs text-red-400">Remover</button>
                            </div>
                          ) : (
                            <button onClick={() => editPhoto1Ref.current?.click()} disabled={uploading === 'edit_photo_url_1'}
                              className="flex items-center gap-1 px-2 py-1.5 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50">
                              <Image size={12} /> {uploading === 'edit_photo_url_1' ? '...' : 'Foto 1'}
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Foto 2</label>
                          {editForm.photo_url_2 ? (
                            <div className="flex items-center gap-2">
                              <img src={editForm.photo_url_2} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#2a2a2a]" />
                              <button onClick={() => setEditForm({ ...editForm, photo_url_2: '' })} className="text-xs text-red-400">Remover</button>
                            </div>
                          ) : (
                            <button onClick={() => editPhoto2Ref.current?.click()} disabled={uploading === 'edit_photo_url_2'}
                              className="flex items-center gap-1 px-2 py-1.5 bg-[#111111] border border-dashed border-[#2a2a2a] rounded-lg text-xs text-gray-400 hover:border-[#D32F2F]/50">
                              <Image size={12} /> {uploading === 'edit_photo_url_2' ? '...' : 'Foto 2'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateClub(club.id)} disabled={saving === club.id || !editForm.name.trim()}
                          className="px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-xs font-medium hover:bg-[#B71C1C] disabled:opacity-50 flex items-center gap-1">
                          <CheckCircle size={14} /> Guardar
                        </button>
                        <button onClick={() => setEditingClub(null)}
                          className="px-4 py-2 bg-[#2a2a2a] text-gray-300 rounded-lg text-xs font-medium hover:bg-[#333] flex items-center gap-1">
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => startEditClub(club)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-colors">
                      <Edit2 size={12} /> Editar Informações
                    </button>
                  </div>
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

                  {/* Contract & License section */}
                  <div className="pt-3 border-t border-[#2a2a2a]">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500" />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${contractBadge(club).cls}`}>
                          {contractBadge(club).text}
                        </span>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => openClubKeyModal(club)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 rounded-lg text-xs font-medium transition-colors">
                          <Key size={12} /> Chave
                        </button>
                        <button onClick={() => openBillingModal(club)} disabled={creatingCheckout}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          <Link2 size={12} /> {creatingCheckout ? '...' : 'Link Stripe'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Início do contrato</label>
                        <input type="date" value={contractDates[club.id]?.start || ''}
                          onChange={e => setContractDates(prev => ({ ...prev, [club.id]: { ...prev[club.id], start: e.target.value } }))}
                          className="px-2.5 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Expiração</label>
                        <input type="date" value={contractDates[club.id]?.expires || ''}
                          onChange={e => setContractDates(prev => ({ ...prev, [club.id]: { ...prev[club.id], expires: e.target.value } }))}
                          className="px-2.5 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <button onClick={() => saveContractDates(club.id)} disabled={savingContract === club.id}
                        className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-medium hover:bg-emerald-900 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {savingContract === club.id ? '...' : <><Check size={12} /> Guardar</>}
                      </button>
                    </div>

                    {/* License keys list */}
                    {loadingKeys ? (
                      <div className="text-xs text-gray-500 py-1">A carregar chaves...</div>
                    ) : clubKeys.length > 0 && (
                      <div className="space-y-1">
                        <h5 className="text-[10px] font-semibold text-gray-500 uppercase">Chaves de licença</h5>
                        {clubKeys.map(k => (
                          <div key={k.id} className="flex items-center gap-3 py-1 px-2 bg-[#1a1a1a] rounded text-xs">
                            <span className="font-mono text-gray-200">{k.license_key}</span>
                            <span className="text-gray-500">{k.plan_name}</span>
                            <span className="text-gray-500">{k.duration_months}m</span>
                            {k.custom_price && <span className="text-gray-500">{k.custom_price}€</span>}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              k.status === 'active' ? 'bg-green-900/30 text-green-400' :
                              k.status === 'used' ? 'bg-blue-900/30 text-blue-400' : 'bg-gray-700/30 text-gray-400'
                            }`}>{k.status}</span>
                            <span className="text-gray-600 ml-auto">{new Date(k.created_at).toLocaleDateString('pt-PT')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Generate Key Modal */}
      {showKeyModal && keyTargetClub && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Key size={20} className="text-purple-400" /> Gerar Chave de Licença</h2>
              <button onClick={() => setShowKeyModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Para: <span className="text-gray-100 font-medium">{keyTargetClub.name}</span></p>
            {generatedKey ? (
              <div className="space-y-4">
                <div className="bg-[#111111] border border-purple-900/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">Chave gerada com sucesso:</p>
                  <p className="text-lg font-mono font-bold text-purple-300 tracking-wider">{generatedKey}</p>
                </div>
                <button onClick={copyClubKey}
                  className="w-full py-2.5 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition-colors flex items-center justify-center gap-2">
                  {copiedKey ? <><Check size={16} /> Copiada!</> : <><Copy size={16} /> Copiar Chave</>}
                </button>
                <button onClick={() => setShowKeyModal(false)} className="w-full py-2 text-gray-400 hover:text-gray-200 text-sm">Fechar</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Plano</label>
                  <select value={keyForm.plan_name} onChange={e => setKeyForm({ ...keyForm, plan_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                    <option value="Bronze">Bronze</option><option value="Silver">Silver</option><option value="Gold">Gold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Duração</label>
                  <select value={keyForm.duration_months} onChange={e => setKeyForm({ ...keyForm, duration_months: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                    <option value={1}>1 mês</option><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses (anual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Preço custom (€, opcional)</label>
                  <input type="number" step="0.01" value={keyForm.custom_price} onChange={e => setKeyForm({ ...keyForm, custom_price: e.target.value })}
                    placeholder="Deixar vazio para preço padrão"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-purple-500/50" />
                </div>
                <button onClick={handleGenerateClubKey} disabled={generatingKey}
                  className="w-full py-2.5 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Key size={16} /> {generatingKey ? 'A gerar...' : 'Gerar Chave'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing interval selection modal */}
      {showBillingModal && billingTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Link2 size={20} className="text-blue-400" /> Tipo de Pagamento</h2>
              <button onClick={() => setShowBillingModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Para: <span className="text-gray-100 font-medium">{billingTarget.name}</span></p>
            <div className="space-y-2 mb-5">
              <button onClick={() => setBillingInterval('month')}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${billingInterval === 'month' ? 'border-blue-500 bg-blue-900/20 text-blue-300' : 'border-[#2a2a2a] bg-[#111] text-gray-300 hover:border-[#444]'}`}>
                <div className="font-medium text-sm">Mensal</div>
                <div className="text-xs mt-0.5 opacity-70">Subscrição recorrente — cobrado todos os meses</div>
              </button>
              <button onClick={() => setBillingInterval('year')}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${billingInterval === 'year' ? 'border-blue-500 bg-blue-900/20 text-blue-300' : 'border-[#2a2a2a] bg-[#111] text-gray-300 hover:border-[#444]'}`}>
                <div className="font-medium text-sm">Anual</div>
                <div className="text-xs mt-0.5 opacity-70">Pagamento único — 12 meses</div>
              </button>
            </div>
            <button onClick={handleCreateClubCheckout} disabled={creatingCheckout}
              className="w-full py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Link2 size={16} /> {creatingCheckout ? 'A gerar...' : 'Gerar Link de Pagamento'}
            </button>
          </div>
        </div>
      )}

      {/* Checkout URL popup */}
      {checkoutUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Link2 size={20} className="text-blue-400" /> Link de Pagamento</h2>
              <button onClick={() => { setCheckoutUrl(null); setCheckoutTarget(null); }} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            {checkoutTarget && (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 mb-3 flex items-center gap-3">
                <Building2 size={16} className="text-gray-500" />
                <div>
                  <p className="text-sm text-gray-200 font-medium">{checkoutTarget.name}</p>
                  {checkoutTarget.email && <p className="text-xs text-gray-500">{checkoutTarget.email}</p>}
                </div>
              </div>
            )}
            <div className="bg-[#111111] border border-blue-900/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">URL de checkout Stripe:</p>
              <p className="text-sm text-blue-300 font-mono break-all">{checkoutUrl}</p>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={copyCheckoutUrl}
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2">
                {copiedCheckout ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
              </button>
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-[#2a2a2a] text-gray-200 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2">
                <ExternalLink size={16} /> Abrir
              </a>
            </div>
            {checkoutTarget?.email && (
              <button onClick={handleSendCheckoutEmail} disabled={sendingEmail || emailSent}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${emailSent ? 'bg-green-800 text-green-100' : 'bg-emerald-700 text-white hover:bg-emerald-800'} disabled:opacity-60`}>
                {emailSent ? <><Check size={16} /> Email enviado!</> : sendingEmail ? 'A enviar...' : <><Send size={16} /> Enviar por Email para {checkoutTarget.email}</>}
              </button>
            )}
            {checkoutTarget && !checkoutTarget.email && (
              <p className="text-xs text-yellow-500 text-center mt-1">Este clube não tem email configurado</p>
            )}
          </div>
        </div>
      )}

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
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="preview">Preview</option>
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
