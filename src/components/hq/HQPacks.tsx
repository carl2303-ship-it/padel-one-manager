import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Save, ToggleLeft, ToggleRight } from 'lucide-react';

interface PlatformPack {
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  compare_price_monthly: number | null;
  compare_price_annual: number | null;
  module_codes: string[];
  landing_features: string[];
  is_popular: boolean;
  sort_order: number;
  is_active: boolean;
}

interface PackForm {
  name: string;
  tagline: string;
  description: string;
  price_monthly: string;
  price_annual: string;
  compare_price_monthly: string;
  compare_price_annual: string;
  module_codes: string;
  landing_features: string;
  is_popular: boolean;
}

export default function HQPacks() {
  const [packs, setPacks] = useState<PlatformPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PackForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_packs').select('*').order('sort_order');
    if (data) setPacks(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (pack: PlatformPack) => {
    setEditing(pack.code);
    setForm({
      name: pack.name,
      tagline: pack.tagline || '',
      description: pack.description || '',
      price_monthly: String(pack.price_monthly),
      price_annual: String(pack.price_annual),
      compare_price_monthly: pack.compare_price_monthly != null ? String(pack.compare_price_monthly) : '',
      compare_price_annual: pack.compare_price_annual != null ? String(pack.compare_price_annual) : '',
      module_codes: JSON.stringify(pack.module_codes),
      landing_features: JSON.stringify(pack.landing_features),
      is_popular: pack.is_popular,
    });
  };

  const handleSave = async () => {
    if (!editing || !form) return;
    let module_codes: string[] = [];
    let landing_features: string[] = [];
    try {
      module_codes = JSON.parse(form.module_codes);
      landing_features = JSON.parse(form.landing_features);
    } catch {
      alert('JSON inválido em module_codes ou landing_features');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('platform_packs').update({
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      description: form.description.trim() || null,
      price_monthly: parseFloat(form.price_monthly),
      price_annual: parseFloat(form.price_annual),
      compare_price_monthly: form.compare_price_monthly ? parseFloat(form.compare_price_monthly) : null,
      compare_price_annual: form.compare_price_annual ? parseFloat(form.compare_price_annual) : null,
      module_codes,
      landing_features,
      is_popular: form.is_popular,
    }).eq('code', editing);
    if (error) alert('Erro: ' + error.message);
    else {
      setEditing(null);
      setForm(null);
      load();
    }
    setSaving(false);
  };

  const toggleActive = async (pack: PlatformPack) => {
    await supabase.from('platform_packs').update({ is_active: !pack.is_active }).eq('code', pack.code);
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
      <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
        <Package size={24} className="text-[#D32F2F]" />
        Packs Comerciais
      </h1>
      <p className="text-sm text-gray-400">Os 2 packs visíveis em padel1.app/clubs. Módulos individuais continuam disponíveis no HQ por cliente.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {packs.map(pack => (
          <div key={pack.code} className={`bg-[#1a1a1a] border rounded-xl p-5 ${pack.is_active ? 'border-[#2a2a2a]' : 'border-red-800/30 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-100">{pack.name}</h3>
                  {pack.is_popular && (
                    <span className="text-[10px] px-2 py-0.5 bg-[#D32F2F]/20 text-[#D32F2F] rounded-full font-semibold">Popular</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono">{pack.code}</p>
              </div>
              <button onClick={() => toggleActive(pack)} className="text-gray-400 hover:text-gray-100">
                {pack.is_active ? <ToggleRight size={24} className="text-green-400" /> : <ToggleLeft size={24} />}
              </button>
            </div>

            {editing === pack.code && form ? (
              <div className="space-y-2 text-sm">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-100" placeholder="Nome" />
                <input value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-100" placeholder="Preço mensal" />
                <input value={form.price_annual} onChange={e => setForm({ ...form, price_annual: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-100" placeholder="Preço anual" />
                <input value={form.compare_price_monthly} onChange={e => setForm({ ...form, compare_price_monthly: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-100" placeholder="Preço riscado mensal" />
                <textarea value={form.landing_features} onChange={e => setForm({ ...form, landing_features: e.target.value })}
                  rows={3} className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-gray-100 font-mono text-xs" />
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#D32F2F] text-white rounded-lg text-xs">
                    <Save size={12} /> Guardar
                  </button>
                  <button onClick={() => { setEditing(null); setForm(null); }}
                    className="px-3 py-1.5 bg-[#2a2a2a] text-gray-300 rounded-lg text-xs">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-black text-gray-100">{pack.price_monthly}€</span>
                  <span className="text-sm text-gray-500">/mês</span>
                  {pack.compare_price_monthly && (
                    <span className="text-sm text-gray-500 line-through ml-2">{pack.compare_price_monthly}€</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {pack.price_annual}€/ano
                  {pack.compare_price_annual && <span className="line-through ml-2">{pack.compare_price_annual}€</span>}
                </p>
                <p className="text-sm text-gray-400 mb-3">{pack.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {pack.module_codes.map(m => (
                    <span key={m} className="text-[10px] px-2 py-0.5 bg-purple-900/20 text-purple-400 rounded-full">{m}</span>
                  ))}
                </div>
                <button onClick={() => openEdit(pack)} className="text-xs text-gray-400 hover:text-gray-200">Editar</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
