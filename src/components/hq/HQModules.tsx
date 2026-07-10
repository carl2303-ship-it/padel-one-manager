import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Edit3, Trash2, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';

interface PlatformModule {
  code: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  price_annual: number | null;
  target_types: string[];
  requires_modules: string[];
  player_app_mode: string | null;
  landing_features: string[];
  sort_order: number;
  is_active: boolean;
}

interface ModuleForm {
  code: string;
  name: string;
  description: string;
  price_monthly: string;
  price_annual: string;
  target_types: string[];
  requires_modules: string;
  player_app_mode: string;
  landing_features: string;
  sort_order: string;
}

const emptyForm: ModuleForm = {
  code: '',
  name: '',
  description: '',
  price_monthly: '',
  price_annual: '',
  target_types: ['club'],
  requires_modules: '[]',
  player_app_mode: '',
  landing_features: '[]',
  sort_order: '0',
};

const MODULE_CODES = ['tournaments', 'manager', 'bar', 'ai_full', 'ai_light'];

export default function HQModules() {
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ModuleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_modules')
      .select('*')
      .order('sort_order');
    if (data) setModules(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (mod: PlatformModule) => {
    setEditing(mod.code);
    setForm({
      code: mod.code,
      name: mod.name,
      description: mod.description || '',
      price_monthly: mod.price_monthly?.toString() || '',
      price_annual: mod.price_annual?.toString() || '',
      target_types: mod.target_types,
      requires_modules: JSON.stringify(mod.requires_modules || []),
      player_app_mode: mod.player_app_mode || '',
      landing_features: JSON.stringify(mod.landing_features || []),
      sort_order: mod.sort_order.toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      alert('Código e nome são obrigatórios.');
      return;
    }
    let requires_modules: string[] = [];
    let landing_features: string[] = [];
    try {
      requires_modules = JSON.parse(form.requires_modules);
      landing_features = JSON.parse(form.landing_features);
    } catch {
      alert('JSON inválido em requires_modules ou landing_features.');
      return;
    }

    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_monthly: form.price_monthly ? parseFloat(form.price_monthly) : null,
      price_annual: form.price_annual ? parseFloat(form.price_annual) : null,
      target_types: form.target_types,
      requires_modules,
      player_app_mode: form.player_app_mode || null,
      landing_features,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: true,
    };

    if (editing) {
      const { error } = await supabase.from('platform_modules').update(payload).eq('code', editing);
      if (error) alert('Erro: ' + error.message);
    } else {
      const { error } = await supabase.from('platform_modules').insert(payload);
      if (error) alert('Erro: ' + error.message);
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  };

  const toggleActive = async (mod: PlatformModule) => {
    await supabase.from('platform_modules').update({ is_active: !mod.is_active }).eq('code', mod.code);
    load();
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Package size={24} className="text-[#D32F2F]" />
          Catálogo de Módulos
        </h1>
        <button
          onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C]"
        >
          <Plus size={16} /> Novo Módulo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modules.map(mod => (
          <div key={mod.code} className={`bg-[#1a1a1a] border rounded-xl p-5 ${mod.is_active ? 'border-[#2a2a2a]' : 'border-red-800/30 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-100">{mod.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#2a2a2a] rounded text-gray-400">{mod.code}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{mod.description}</p>
              </div>
              <button onClick={() => toggleActive(mod)} className="text-gray-400 hover:text-gray-100">
                {mod.is_active ? <ToggleRight size={24} className="text-green-400" /> : <ToggleLeft size={24} />}
              </button>
            </div>

            <div className="flex gap-4 mb-3 text-sm">
              {mod.price_monthly != null && (
                <span className="text-gray-300">€{mod.price_monthly}/mês</span>
              )}
              {mod.price_annual != null && (
                <span className="text-gray-500">€{mod.price_annual}/ano</span>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {mod.target_types.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 bg-blue-900/20 text-blue-400 rounded-full">{t}</span>
              ))}
              {mod.player_app_mode && (
                <span className="text-[10px] px-2 py-0.5 bg-purple-900/20 text-purple-400 rounded-full">
                  player: {mod.player_app_mode}
                </span>
              )}
            </div>

            {mod.landing_features?.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-0.5 mb-3">
                {mod.landing_features.slice(0, 4).map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            )}

            <button
              onClick={() => openEdit(mod)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            >
              <Edit3 size={12} /> Editar
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-100">{editing ? 'Editar Módulo' : 'Novo Módulo'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-100"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Código</label>
                <select
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  disabled={!!editing}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 disabled:opacity-50"
                >
                  <option value="">Selecionar...</option>
                  {MODULE_CODES.filter(c => !editing || c === editing).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Preço Mensal (€)</label>
                  <input type="number" step="0.01" value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Preço Anual (€)</label>
                  <input type="number" step="0.01" value={form.price_annual} onChange={e => setForm({ ...form, price_annual: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Types</label>
                <div className="flex gap-3">
                  {['club', 'organizer'].map(t => (
                    <label key={t} className="flex items-center gap-1.5 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.target_types.includes(t)}
                        onChange={e => {
                          const types = e.target.checked
                            ? [...form.target_types, t]
                            : form.target_types.filter(x => x !== t);
                          setForm({ ...form, target_types: types });
                        }}
                        className="rounded border-gray-600 text-[#D32F2F]"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Requires Modules (JSON array)</label>
                <input value={form.requires_modules} onChange={e => setForm({ ...form, requires_modules: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Landing Features (JSON array)</label>
                <textarea value={form.landing_features} onChange={e => setForm({ ...form, landing_features: e.target.value })}
                  rows={3} className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 font-mono resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Player App Mode</label>
                  <select value={form.player_app_mode} onChange={e => setForm({ ...form, player_app_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100">
                    <option value="">—</option>
                    <option value="lite">lite</option>
                    <option value="full">full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ordem</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] disabled:opacity-50">
                <Save size={14} /> {saving ? 'A guardar...' : 'Guardar'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#2a2a2a] text-gray-300 rounded-lg text-sm hover:bg-[#333]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
