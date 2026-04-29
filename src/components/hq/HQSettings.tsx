import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, CreditCard, Save, Plus, X, Edit3, Trash2, Eye, EyeOff, Package } from 'lucide-react';

interface StripeConfig {
  id: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  webhook_secret: string | null;
  updated_at: string;
}

interface PlatformPlan {
  id: string;
  name: string;
  target_type: 'club' | 'organizer';
  price_monthly: number | null;
  price_annual: number | null;
  is_active: boolean;
  features: Record<string, unknown>;
  created_at: string;
}

interface PlanForm {
  name: string;
  target_type: 'club' | 'organizer';
  price_monthly: string;
  price_annual: string;
  features: string;
}

const emptyPlanForm: PlanForm = { name: '', target_type: 'club', price_monthly: '', price_annual: '', features: '{}' };

export default function HQSettings() {
  const [stripeConfig, setStripeConfig] = useState<StripeConfig | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stripe' | 'plans'>('stripe');

  const [pkKey, setPkKey] = useState('');
  const [skKey, setSkKey] = useState('');
  const [whSecret, setWhSecret] = useState('');
  const [savingStripe, setSavingStripe] = useState(false);
  const [showSk, setShowSk] = useState(false);
  const [showWh, setShowWh] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [configRes, plansRes] = await Promise.all([
      supabase.from('platform_stripe_config').select('*').limit(1).maybeSingle(),
      supabase.from('platform_plans').select('*').order('target_type').order('price_monthly', { ascending: true }),
    ]);
    if (configRes.data) {
      setStripeConfig(configRes.data);
      setPkKey(configRes.data.stripe_publishable_key);
      setSkKey(configRes.data.stripe_secret_key);
      setWhSecret(configRes.data.webhook_secret || '');
    }
    if (plansRes.data) setPlans(plansRes.data);
    setLoading(false);
  };

  const handleSaveStripe = async () => {
    if (!pkKey.trim() || !skKey.trim()) { alert('Publishable Key e Secret Key são obrigatórias.'); return; }
    setSavingStripe(true);

    if (stripeConfig) {
      const { error } = await supabase.from('platform_stripe_config').update({
        stripe_publishable_key: pkKey.trim(),
        stripe_secret_key: skKey.trim(),
        webhook_secret: whSecret.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', stripeConfig.id);
      if (error) alert('Erro: ' + error.message);
      else { alert('Credenciais Stripe atualizadas!'); loadAll(); }
    } else {
      const { error } = await supabase.from('platform_stripe_config').insert({
        stripe_publishable_key: pkKey.trim(),
        stripe_secret_key: skKey.trim(),
        webhook_secret: whSecret.trim() || null,
      });
      if (error) alert('Erro: ' + error.message);
      else { alert('Credenciais Stripe guardadas!'); loadAll(); }
    }
    setSavingStripe(false);
  };

  const openPlanModal = (plan?: PlatformPlan) => {
    if (plan) {
      setEditingPlan(plan.id);
      setPlanForm({
        name: plan.name,
        target_type: plan.target_type,
        price_monthly: plan.price_monthly?.toString() || '',
        price_annual: plan.price_annual?.toString() || '',
        features: JSON.stringify(plan.features, null, 2),
      });
    } else {
      setEditingPlan(null);
      setPlanForm(emptyPlanForm);
    }
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) { alert('Nome é obrigatório.'); return; }
    setSavingPlan(true);

    let features = {};
    try { features = JSON.parse(planForm.features); } catch { alert('Features JSON inválido.'); setSavingPlan(false); return; }

    const payload = {
      name: planForm.name.trim(),
      target_type: planForm.target_type,
      price_monthly: planForm.price_monthly ? parseFloat(planForm.price_monthly) : null,
      price_annual: planForm.price_annual ? parseFloat(planForm.price_annual) : null,
      features,
    };

    if (editingPlan) {
      const { error } = await supabase.from('platform_plans').update(payload).eq('id', editingPlan);
      if (error) alert('Erro: ' + error.message);
    } else {
      const { error } = await supabase.from('platform_plans').insert(payload);
      if (error) alert('Erro: ' + error.message);
    }

    setShowPlanModal(false);
    setSavingPlan(false);
    loadAll();
  };

  const togglePlanActive = async (plan: PlatformPlan) => {
    await supabase.from('platform_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    loadAll();
  };

  const deletePlan = async (plan: PlatformPlan) => {
    if (!confirm(`Eliminar plano "${plan.name}"?`)) return;
    await supabase.from('platform_plans').delete().eq('id', plan.id);
    loadAll();
  };

  const maskKey = (key: string) => key ? key.slice(0, 8) + '••••••••••••' + key.slice(-4) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#D32F2F]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <Settings size={24} className="text-[#D32F2F]" />
        Configurações
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0a0a] p-1 rounded-lg w-fit">
        <button onClick={() => setTab('stripe')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'stripe' ? 'bg-[#D32F2F] text-white' : 'text-gray-400 hover:text-gray-100'}`}>
          <CreditCard size={14} className="inline mr-1.5" />
          Stripe
        </button>
        <button onClick={() => setTab('plans')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-[#D32F2F] text-white' : 'text-gray-400 hover:text-gray-100'}`}>
          <Package size={14} className="inline mr-1.5" />
          Planos ({plans.length})
        </button>
      </div>

      {tab === 'stripe' ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-100 mb-1 flex items-center gap-2">
            <CreditCard size={18} className="text-[#D32F2F]" />
            Credenciais Stripe da Plataforma
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Estas são as chaves Stripe da Padel One para receber pagamentos de licenças de clubes e organizadores.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Publishable Key *</label>
              <input type="text" value={pkKey} onChange={e => setPkKey(e.target.value)}
                placeholder="pk_live_..."
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono focus:outline-none focus:border-[#D32F2F]/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Secret Key *</label>
              <div className="relative">
                <input type={showSk ? 'text' : 'password'} value={skKey} onChange={e => setSkKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full px-3 py-2 pr-10 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono focus:outline-none focus:border-[#D32F2F]/50" />
                <button onClick={() => setShowSk(!showSk)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showSk ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Webhook Secret (opcional)</label>
              <div className="relative">
                <input type={showWh ? 'text' : 'password'} value={whSecret} onChange={e => setWhSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="w-full px-3 py-2 pr-10 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono focus:outline-none focus:border-[#D32F2F]/50" />
                <button onClick={() => setShowWh(!showWh)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showWh ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {stripeConfig && (
              <p className="text-xs text-gray-500">
                Última atualização: {new Date(stripeConfig.updated_at).toLocaleString('pt-PT')}
              </p>
            )}

            <button onClick={handleSaveStripe} disabled={savingStripe || !pkKey.trim() || !skKey.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50">
              <Save size={16} />
              {savingStripe ? 'A guardar...' : stripeConfig ? 'Atualizar Credenciais' : 'Guardar Credenciais'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">Planos da Plataforma</h2>
            <button onClick={() => openPlanModal()}
              className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors">
              <Plus size={16} /> Novo Plano
            </button>
          </div>

          {/* Club plans */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Planos para Clubes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.filter(p => p.target_type === 'club').map(plan => (
                <div key={plan.id} className={`bg-[#1a1a1a] border rounded-xl p-5 ${plan.is_active ? 'border-[#2a2a2a]' : 'border-red-900/30 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-bold text-gray-100">{plan.name}</h4>
                    <div className="flex gap-1">
                      <button onClick={() => openPlanModal(plan)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] rounded-lg">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => deletePlan(plan)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {plan.price_monthly != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-100">{plan.price_monthly}€</span>
                        <span className="text-xs text-gray-500">/mês</span>
                      </div>
                    )}
                    {plan.price_annual != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold text-green-400">{plan.price_annual}€</span>
                        <span className="text-xs text-gray-500">/ano</span>
                        {plan.price_monthly != null && plan.price_annual != null && (
                          <span className="text-[10px] text-green-500 ml-1">
                            (-{Math.round((1 - plan.price_annual / (plan.price_monthly * 12)) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {plan.features && Object.keys(plan.features).length > 0 && (
                    <div className="border-t border-[#2a2a2a] pt-3 space-y-1">
                      {Object.entries(plan.features).map(([k, v]) => (
                        <div key={k} className="text-xs text-gray-400 flex items-center gap-1.5">
                          <span className={typeof v === 'boolean' ? (v ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}>
                            {typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v)}
                          </span>
                          <span>{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => togglePlanActive(plan)}
                    className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      plan.is_active ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    }`}>
                    {plan.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Organizer plans */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Planos para Organizadores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.filter(p => p.target_type === 'organizer').map(plan => (
                <div key={plan.id} className={`bg-[#1a1a1a] border rounded-xl p-5 ${plan.is_active ? 'border-[#2a2a2a]' : 'border-red-900/30 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-bold text-gray-100">{plan.name}</h4>
                    <div className="flex gap-1">
                      <button onClick={() => openPlanModal(plan)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] rounded-lg">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => deletePlan(plan)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {plan.price_monthly != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-100">{plan.price_monthly}€</span>
                        <span className="text-xs text-gray-500">/mês</span>
                      </div>
                    )}
                    {plan.price_annual != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold text-green-400">{plan.price_annual}€</span>
                        <span className="text-xs text-gray-500">/ano</span>
                        {plan.price_monthly != null && plan.price_annual != null && (
                          <span className="text-[10px] text-green-500 ml-1">
                            (-{Math.round((1 - plan.price_annual / (plan.price_monthly * 12)) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {plan.features && Object.keys(plan.features).length > 0 && (
                    <div className="border-t border-[#2a2a2a] pt-3 space-y-1">
                      {Object.entries(plan.features).map(([k, v]) => (
                        <div key={k} className="text-xs text-gray-400 flex items-center gap-1.5">
                          <span className={typeof v === 'boolean' ? (v ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}>
                            {typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v)}
                          </span>
                          <span>{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => togglePlanActive(plan)}
                    className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      plan.is_active ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
                    }`}>
                    {plan.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100">
                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
              </h2>
              <button onClick={() => setShowPlanModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
                  <input type="text" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Ex: Pro"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
                  <select value={planForm.target_type} onChange={e => setPlanForm({ ...planForm, target_type: e.target.value as 'club' | 'organizer' })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none">
                    <option value="club">Clube</option>
                    <option value="organizer">Organizador</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Preço Mensal (€)</label>
                  <input type="number" step="0.01" value={planForm.price_monthly} onChange={e => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                    placeholder="29.99"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Preço Anual (€)</label>
                  <input type="number" step="0.01" value={planForm.price_annual} onChange={e => setPlanForm({ ...planForm, price_annual: e.target.value })}
                    placeholder="299.99"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-[#D32F2F]/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Features (JSON)</label>
                <textarea value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })}
                  rows={4}
                  placeholder='{"max_courts": 4, "bar_module": true}'
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono focus:outline-none focus:border-[#D32F2F]/50" />
              </div>
              <button onClick={handleSavePlan} disabled={savingPlan || !planForm.name.trim()}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50">
                {savingPlan ? 'A guardar...' : editingPlan ? 'Atualizar Plano' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
