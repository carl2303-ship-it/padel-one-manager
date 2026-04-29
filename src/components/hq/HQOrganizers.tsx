import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Search, Plus, X, ToggleLeft, ToggleRight, Crown, Award, Medal, Key, Calendar, Copy, Check, ExternalLink, Link2, Send } from 'lucide-react';

interface Organizer {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  club_name: string | null;
  subscription_status: string;
  subscription_plan: string;
  organizer_tier: string | null;
  is_active: boolean;
  created_at: string;
  contract_start: string | null;
  subscription_expires_at: string | null;
}

interface LicenseKey {
  id: string;
  license_key: string;
  plan_name: string;
  duration_months: number;
  status: string;
  custom_price: number | null;
  created_at: string;
  activated_at: string | null;
}

interface OrgForm {
  email: string;
  name: string;
  club_name: string;
  organizer_tier: string;
}

interface KeyForm {
  plan_name: string;
  duration_months: number;
  custom_price: string;
}

const emptyOrgForm: OrgForm = { email: '', name: '', club_name: '', organizer_tier: 'bronze' };

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Crown }> = {
  bronze: { label: 'Bronze', color: 'text-amber-600', bg: 'bg-amber-900/20 text-amber-500 border-amber-800/30', icon: Medal },
  silver: { label: 'Silver', color: 'text-gray-300', bg: 'bg-gray-700/30 text-gray-300 border-gray-600/30', icon: Award },
  gold:   { label: 'Gold',   color: 'text-yellow-400', bg: 'bg-yellow-900/20 text-yellow-400 border-yellow-700/30', icon: Crown },
};

const STATUS_COLORS: Record<string, string> = {
  trial: 'bg-yellow-900/30 text-yellow-400',
  active: 'bg-green-900/30 text-green-400',
  expired: 'bg-red-900/30 text-red-400',
  cancelled: 'bg-gray-700/30 text-gray-400',
};

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `PADEL-${seg()}-${seg()}-${seg()}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function contractBadge(expiresAt: string | null) {
  if (!expiresAt) return { text: 'Sem contrato', cls: 'bg-gray-700/30 text-gray-500' };
  const days = daysUntil(expiresAt)!;
  if (days < 0) return { text: `Expirado há ${Math.abs(days)}d`, cls: 'bg-red-900/30 text-red-400' };
  if (days <= 30) return { text: `Expira em ${days}d`, cls: 'bg-yellow-900/30 text-yellow-400' };
  return { text: `${days}d restantes`, cls: 'bg-green-900/30 text-green-400' };
}

export default function HQOrganizers() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [saving, setSaving] = useState<string | null>(null);

  const [showAddOrg, setShowAddOrg] = useState(false);
  const [orgForm, setOrgForm] = useState<OrgForm>(emptyOrgForm);
  const [addingOrg, setAddingOrg] = useState(false);

  const [editingTier, setEditingTier] = useState<string | null>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyTargetOrg, setKeyTargetOrg] = useState<Organizer | null>(null);
  const [keyForm, setKeyForm] = useState<KeyForm>({ plan_name: 'Bronze', duration_months: 12, custom_price: '' });
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgKeys, setOrgKeys] = useState<LicenseKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copiedCheckout, setCopiedCheckout] = useState(false);
  const [checkoutTargetOrg, setCheckoutTargetOrg] = useState<Organizer | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingTarget, setBillingTarget] = useState<Organizer | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [contractDates, setContractDates] = useState<Record<string, { start: string; expires: string }>>({});
  const [savingContract, setSavingContract] = useState<string | null>(null);

  useEffect(() => { loadOrganizers(); }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('organizers')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setOrganizers(data);
    setLoading(false);
  };

  const loadOrgKeys = async (orgId: string) => {
    setLoadingKeys(true);
    const { data } = await supabase
      .from('license_keys')
      .select('*')
      .eq('target_entity_id', orgId)
      .eq('target_type', 'organizer')
      .order('created_at', { ascending: false });
    if (data) setOrgKeys(data);
    setLoadingKeys(false);
  };

  const toggleExpanded = (org: Organizer) => {
    if (expandedOrg === org.id) { setExpandedOrg(null); return; }
    setExpandedOrg(org.id);
    loadOrgKeys(org.id);
    initOrgContractDates(org);
  };

  const toggleOrganizerActive = async (org: Organizer) => {
    setSaving(org.id);
    const { error } = await supabase.from('organizers').update({ is_active: !org.is_active }).eq('id', org.id);
    if (!error) setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
    setSaving(null);
  };

  const changeOrgStatus = async (org: Organizer, status: string) => {
    setSaving(org.id);
    const { error } = await supabase.from('organizers').update({ subscription_status: status }).eq('id', org.id);
    if (!error) setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, subscription_status: status } : o));
    setSaving(null);
  };

  const changeOrgTier = async (org: Organizer, tier: string) => {
    setSaving(org.id);
    const { error } = await supabase.from('organizers').update({ organizer_tier: tier, subscription_plan: tier }).eq('id', org.id);
    if (!error) setOrganizers(prev => prev.map(o => o.id === org.id ? { ...o, organizer_tier: tier, subscription_plan: tier } : o));
    setSaving(null);
    setEditingTier(null);
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
    if (!userId) { alert('Utilizador não encontrado com este email.'); setAddingOrg(false); return; }

    const { error } = await supabase.from('organizers').insert({
      user_id: userId, email: emailLower, name: orgForm.name.trim(),
      club_name: orgForm.club_name.trim() || null, subscription_plan: orgForm.organizer_tier,
      organizer_tier: orgForm.organizer_tier, subscription_status: 'active', is_active: true,
    });
    if (error) {
      if (error.code === '23505') alert('Este utilizador já é organizador.');
      else alert('Erro: ' + error.message);
    } else {
      await supabase.from('user_logo_settings').upsert(
        { user_id: userId, is_paid_organizer: true, role: 'organizer' },
        { onConflict: 'user_id' }
      );
      setShowAddOrg(false); setOrgForm(emptyOrgForm); loadOrganizers();
    }
    setAddingOrg(false);
  };

  const openKeyModal = (org: Organizer) => {
    setKeyTargetOrg(org);
    setKeyForm({ plan_name: org.organizer_tier || 'Bronze', duration_months: 12, custom_price: '' });
    setGeneratedKey(null); setCopiedKey(false);
    setShowKeyModal(true);
  };

  const handleGenerateKey = async () => {
    if (!keyTargetOrg) return;
    setGeneratingKey(true);
    const key = generateLicenseKey();

    const { error } = await supabase.from('license_keys').insert({
      license_key: key,
      target_type: 'organizer',
      plan_name: keyForm.plan_name,
      duration_months: keyForm.duration_months,
      target_entity_id: keyTargetOrg.id,
      target_user_id: keyTargetOrg.user_id,
      custom_price: keyForm.custom_price ? parseFloat(keyForm.custom_price) : null,
      status: 'active',
    });

    if (error) { alert('Erro: ' + error.message); }
    else { setGeneratedKey(key); }
    setGeneratingKey(false);
  };

  const copyKey = () => {
    if (generatedKey) { navigator.clipboard.writeText(generatedKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
  };

  const initOrgContractDates = (org: Organizer) => {
    if (!contractDates[org.id]) {
      setContractDates(prev => ({
        ...prev,
        [org.id]: {
          start: org.contract_start ? org.contract_start.split('T')[0] : '',
          expires: org.subscription_expires_at ? org.subscription_expires_at.split('T')[0] : '',
        }
      }));
    }
  };

  const saveOrgContractDates = async (orgId: string) => {
    const dates = contractDates[orgId];
    if (!dates) return;
    setSavingContract(orgId);
    const { error } = await supabase.from('organizers').update({
      contract_start: dates.start || null,
      subscription_expires_at: dates.expires || null,
    }).eq('id', orgId);
    if (error) { alert('Erro: ' + error.message); }
    else {
      setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, contract_start: dates.start || null, subscription_expires_at: dates.expires || null } : o));
    }
    setSavingContract(null);
  };

  const handleSendCheckoutEmail = async () => {
    if (!checkoutUrl || !checkoutTargetOrg?.email) return;
    setSendingEmail(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://rqiwnxcexsccguruiteq.supabase.co'}/functions/v1/send-checkout-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
          body: JSON.stringify({
            to_email: checkoutTargetOrg.email,
            to_name: checkoutTargetOrg.name || checkoutTargetOrg.email,
            checkout_url: checkoutUrl,
            plan_name: TIER_CONFIG[checkoutTargetOrg.organizer_tier || 'bronze']?.label || 'Bronze',
            target_type: 'organizer',
          }),
        }
      );
      const result = await resp.json();
      if (result.ok) { setEmailSent(true); setTimeout(() => setEmailSent(false), 3000); }
      else alert(result.error || 'Erro ao enviar email');
    } catch { alert('Erro de rede'); }
    setSendingEmail(false);
  };

  const openBillingModal = (org: Organizer) => {
    setBillingTarget(org);
    setBillingInterval('year');
    setShowBillingModal(true);
  };

  const handleCreateCheckoutLink = async () => {
    if (!billingTarget) return;
    const org = billingTarget;
    setCreatingCheckout(true);
    setCheckoutUrl(null);
    setCheckoutTargetOrg(org);
    setEmailSent(false);
    setShowBillingModal(false);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://rqiwnxcexsccguruiteq.supabase.co'}/functions/v1/create-platform-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
          body: JSON.stringify({
            target_type: 'organizer',
            plan_name: TIER_CONFIG[org.organizer_tier || 'bronze']?.label || 'Bronze',
            duration_months: billingInterval === 'month' ? 1 : 12,
            billing_interval: billingInterval,
            target_entity_id: org.id,
            payer_email: org.email,
            success_url: window.location.origin + '/?payment=success',
            cancel_url: window.location.origin + '/?payment=cancelled',
          }),
        }
      );
      const result = await resp.json();
      if (result.ok && result.url) {
        setCheckoutUrl(result.url);
      } else {
        alert(result.error || 'Erro ao criar link');
      }
    } catch { alert('Erro de rede'); }
    setCreatingCheckout(false);
  };

  const copyCheckout = () => {
    if (checkoutUrl) { navigator.clipboard.writeText(checkoutUrl); setCopiedCheckout(true); setTimeout(() => setCopiedCheckout(false), 2000); }
  };

  const filtered = organizers.filter(o => {
    if (filterTier !== 'all' && (o.organizer_tier || 'bronze') !== filterTier) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'active' && !o.is_active) return false;
      if (filterStatus === 'inactive' && o.is_active) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return o.email?.toLowerCase().includes(s) || o.name?.toLowerCase().includes(s) || o.club_name?.toLowerCase().includes(s);
    }
    return true;
  });

  const tierCounts = {
    bronze: organizers.filter(o => (o.organizer_tier || 'bronze') === 'bronze').length,
    silver: organizers.filter(o => o.organizer_tier === 'silver').length,
    gold: organizers.filter(o => o.organizer_tier === 'gold').length,
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
          <Crown size={24} className="text-yellow-400" />
          Organizadores
          <span className="text-sm font-normal text-gray-500 ml-2">({organizers.length})</span>
        </h1>
        <button onClick={() => { setOrgForm(emptyOrgForm); setShowAddOrg(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors">
          <Plus size={16} /> Adicionar Organizador
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['bronze', 'silver', 'gold'] as const).map(tier => {
          const cfg = TIER_CONFIG[tier];
          const Icon = cfg.icon;
          return (
            <div key={tier} className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 cursor-pointer hover:border-[#3a3a3a] transition-colors ${filterTier === tier ? 'ring-1 ring-[#D32F2F]' : ''}`}
              onClick={() => setFilterTier(filterTier === tier ? 'all' : tier)}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={20} className={cfg.color} />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg}`}>{cfg.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-100">{tierCounts[tier]}</div>
              <div className="text-xs text-gray-500 mt-1">organizadores</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Pesquisar por nome, email ou clube..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50" />
        </div>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none">
          <option value="all">Todos os níveis</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none">
          <option value="all">Todos os estados</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
          <div className="col-span-2">Organizador</div>
          <div className="col-span-2">Clube</div>
          <div className="col-span-1">Plano</div>
          <div className="col-span-2">Contrato</div>
          <div className="col-span-1">Estado</div>
          <div className="col-span-4">Ações</div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum organizador encontrado.</div>
        ) : (
          filtered.map(org => {
            const tier = org.organizer_tier || 'bronze';
            const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
            const TierIcon = tierCfg.icon;
            const badge = contractBadge(org.subscription_expires_at);
            const isExpanded = expandedOrg === org.id;

            return (
              <div key={org.id} className="border-b border-[#2a2a2a] last:border-b-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 hover:bg-[#151515] transition-colors items-center cursor-pointer"
                  onClick={() => toggleExpanded(org)}>
                  <div className="lg:col-span-2">
                    <div className="text-sm font-medium text-gray-100">{org.name || org.email}</div>
                    <div className="text-xs text-gray-500">{org.email}</div>
                  </div>
                  <div className="lg:col-span-2 text-sm text-gray-400">{org.club_name || '— independente —'}</div>
                  <div className="lg:col-span-1" onClick={e => e.stopPropagation()}>
                    {editingTier === org.id ? (
                      <div className="flex items-center gap-1">
                        <select value={tier} onChange={e => changeOrgTier(org, e.target.value)}
                          className="px-1.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-xs text-gray-300 focus:outline-none">
                          <option value="bronze">Bronze</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                        </select>
                        <button onClick={() => setEditingTier(null)} className="text-gray-500 hover:text-gray-300"><X size={12} /></button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setEditingTier(org.id); }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border hover:opacity-80 ${tierCfg.bg}`}>
                        <TierIcon size={10} />{tierCfg.label}
                      </button>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                      <Calendar size={10} />{badge.text}
                    </span>
                    {org.subscription_expires_at && (
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {org.contract_start ? new Date(org.contract_start).toLocaleDateString('pt-PT') + ' — ' : 'até '}
                        {new Date(org.subscription_expires_at).toLocaleDateString('pt-PT')}
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-1" onClick={e => e.stopPropagation()}>
                    <select value={org.subscription_status} onChange={e => changeOrgStatus(org, e.target.value)}
                      disabled={saving === org.id}
                      className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[org.subscription_status] || 'bg-[#2a2a2a] text-gray-400'}`}>
                      <option value="trial">Trial</option>
                      <option value="active">Ativo</option>
                      <option value="expired">Expirado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <div className="lg:col-span-4 flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openKeyModal(org)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 rounded-lg text-xs font-medium transition-colors">
                      <Key size={12} /> Chave
                    </button>
                    <button onClick={() => openBillingModal(org)} disabled={creatingCheckout}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                      <Link2 size={12} /> {creatingCheckout ? '...' : 'Stripe'}
                    </button>
                    <button onClick={() => toggleOrganizerActive(org)} disabled={saving === org.id}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        org.is_active ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                      }`}>
                      {org.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      {org.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>

                {/* Expanded: contract dates + license keys */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-[#151515]">
                    <div className="flex items-end gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Início do contrato</label>
                        <input type="date" value={contractDates[org.id]?.start || ''}
                          onChange={e => setContractDates(prev => ({ ...prev, [org.id]: { ...prev[org.id], start: e.target.value } }))}
                          className="px-2.5 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Expiração</label>
                        <input type="date" value={contractDates[org.id]?.expires || ''}
                          onChange={e => setContractDates(prev => ({ ...prev, [org.id]: { ...prev[org.id], expires: e.target.value } }))}
                          className="px-2.5 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <button onClick={() => saveOrgContractDates(org.id)} disabled={savingContract === org.id}
                        className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-medium hover:bg-emerald-900 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {savingContract === org.id ? '...' : <><Check size={12} /> Guardar</>}
                      </button>
                    </div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                      <Key size={12} /> Chaves de Licença
                    </h4>
                    {loadingKeys ? (
                      <div className="text-xs text-gray-500 py-2">A carregar...</div>
                    ) : orgKeys.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2">Nenhuma chave gerada.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {orgKeys.map(k => (
                          <div key={k.id} className="flex items-center gap-3 py-1.5 px-3 bg-[#1a1a1a] rounded-lg text-xs">
                            <span className="font-mono text-gray-200">{k.license_key}</span>
                            <span className="text-gray-500">{k.plan_name}</span>
                            <span className="text-gray-500">{k.duration_months}m</span>
                            {k.custom_price && <span className="text-gray-500">{k.custom_price}€</span>}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              k.status === 'active' ? 'bg-green-900/30 text-green-400' :
                              k.status === 'used' ? 'bg-blue-900/30 text-blue-400' :
                              'bg-gray-700/30 text-gray-400'
                            }`}>{k.status}</span>
                            {k.activated_at && (
                              <span className="text-gray-600">Ativada: {new Date(k.activated_at).toLocaleDateString('pt-PT')}</span>
                            )}
                            <span className="text-gray-600 ml-auto">{new Date(k.created_at).toLocaleDateString('pt-PT')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Tier info */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Award size={16} className="text-[#D32F2F]" /> Níveis de Organizador — Permissões
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['bronze', 'silver', 'gold'] as const).map(tier => {
            const cfg = TIER_CONFIG[tier]; const Icon = cfg.icon;
            return (
              <div key={tier} className={`rounded-lg border p-4 ${cfg.bg}`}>
                <div className="flex items-center gap-2 mb-3"><Icon size={18} /><span className="font-semibold text-sm">{cfg.label}</span></div>
                <ul className="space-y-1.5 text-xs opacity-80">
                  {tier === 'bronze' && <><li>• Tipos de torneios limitados</li><li>• Máx. jogadores: a definir</li><li>• Frequência: a definir</li></>}
                  {tier === 'silver' && <><li>• Mais tipos de torneios</li><li>• Máx. jogadores: a definir</li><li>• Frequência: a definir</li></>}
                  {tier === 'gold' && <><li>• Todos os tipos de torneios</li><li>• Máx. jogadores: a definir</li><li>• Frequência: a definir</li></>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Organizer Modal */}
      {showAddOrg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Crown size={20} className="text-yellow-400" /> Adicionar Organizador</h2>
              <button onClick={() => setShowAddOrg(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                <input type="email" value={orgForm.email} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })}
                  placeholder="email@exemplo.com" className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                <input type="text" value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="Nome do organizador" className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Clube (opcional)</label>
                <input type="text" value={orgForm.club_name} onChange={e => setOrgForm({ ...orgForm, club_name: e.target.value })}
                  placeholder="Nome do clube" className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Plano</label>
                <select value={orgForm.organizer_tier} onChange={e => setOrgForm({ ...orgForm, organizer_tier: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                  <option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">O utilizador precisa de ter uma conta registada.</p>
              <button onClick={handleAddOrganizer} disabled={addingOrg || !orgForm.email.trim() || !orgForm.name.trim()}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50">
                {addingOrg ? 'A adicionar...' : 'Adicionar Organizador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Key Modal */}
      {showKeyModal && keyTargetOrg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Key size={20} className="text-purple-400" /> Gerar Chave de Licença</h2>
              <button onClick={() => setShowKeyModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Para: <span className="text-gray-100 font-medium">{keyTargetOrg.name || keyTargetOrg.email}</span></p>

            {generatedKey ? (
              <div className="space-y-4">
                <div className="bg-[#111111] border border-purple-900/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">Chave gerada com sucesso:</p>
                  <p className="text-lg font-mono font-bold text-purple-300 tracking-wider">{generatedKey}</p>
                </div>
                <button onClick={copyKey}
                  className="w-full py-2.5 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition-colors flex items-center justify-center gap-2">
                  {copiedKey ? <><Check size={16} /> Copiada!</> : <><Copy size={16} /> Copiar Chave</>}
                </button>
                <button onClick={() => setShowKeyModal(false)}
                  className="w-full py-2 text-gray-400 hover:text-gray-200 text-sm">Fechar</button>
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
                <button onClick={handleGenerateKey} disabled={generatingKey}
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
            <p className="text-sm text-gray-400 mb-1">Para: <span className="text-gray-100 font-medium">{billingTarget.name || billingTarget.email}</span></p>
            <p className="text-xs text-gray-500 mb-4">Plano: <span className="text-gray-300">{TIER_CONFIG[billingTarget.organizer_tier || 'bronze']?.label || 'Bronze'}</span></p>
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
            <button onClick={handleCreateCheckoutLink} disabled={creatingCheckout}
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
              <button onClick={() => { setCheckoutUrl(null); setCheckoutTargetOrg(null); }} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            {checkoutTargetOrg && (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 mb-3 flex items-center gap-3">
                <User size={16} className="text-gray-500" />
                <div>
                  <p className="text-sm text-gray-200 font-medium">{checkoutTargetOrg.name || checkoutTargetOrg.email}</p>
                  <p className="text-xs text-gray-500">{checkoutTargetOrg.email}</p>
                </div>
              </div>
            )}
            <div className="bg-[#111111] border border-blue-900/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">URL de checkout Stripe:</p>
              <p className="text-sm text-blue-300 font-mono break-all">{checkoutUrl}</p>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={copyCheckout}
                className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2">
                {copiedCheckout ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
              </button>
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-[#2a2a2a] text-gray-200 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2">
                <ExternalLink size={16} /> Abrir
              </a>
            </div>
            {checkoutTargetOrg?.email && (
              <button onClick={handleSendCheckoutEmail} disabled={sendingEmail || emailSent}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${emailSent ? 'bg-green-800 text-green-100' : 'bg-emerald-700 text-white hover:bg-emerald-800'} disabled:opacity-60`}>
                {emailSent ? <><Check size={16} /> Email enviado!</> : sendingEmail ? 'A enviar...' : <><Send size={16} /> Enviar por Email para {checkoutTargetOrg.email}</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
