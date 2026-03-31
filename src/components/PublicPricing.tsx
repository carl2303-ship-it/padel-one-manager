import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Court {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'covered';
  hourly_rate: number;
  peak_rate: number;
  price_90min: number | null;
  price_120min: number | null;
  peak_price_90min: number | null;
  peak_price_120min: number | null;
}

interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url_1: string | null;
}

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  benefits: string[];
  court_discount_percent: number;
  is_active: boolean;
}

interface EquipmentItem {
  name: string;
  price: string;
}

interface Props {
  clubId: string;
}

const formatPrice = (val: number) => {
  if (val === Math.floor(val)) return `${val}€`;
  return `${val.toFixed(2).replace('.', ',')}€`;
};

export default function PublicPricing({ clubId }: Props) {
  const [club, setClub] = useState<Club | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      let clubData: Club | null = null;
      let ownerId: string | null = null;

      const { data: byId } = await supabase
        .from('clubs')
        .select('id, name, logo_url, photo_url_1, owner_id, pricing_config')
        .eq('id', clubId)
        .maybeSingle();

      if (byId) {
        clubData = byId;
        ownerId = byId.owner_id;
      } else {
        const { data: byOwner } = await supabase
          .from('clubs')
          .select('id, name, logo_url, photo_url_1, owner_id, pricing_config')
          .eq('owner_id', clubId)
          .maybeSingle();
        if (byOwner) {
          clubData = byOwner;
          ownerId = byOwner.owner_id;
        }
      }

      if (clubData) {
        setClub(clubData);

        const cfg = (clubData as any).pricing_config;
        if (cfg?.equipment) setEquipment(cfg.equipment);

        if (ownerId) {
          const [courtRes, planRes] = await Promise.all([
            supabase
              .from('club_courts')
              .select('id, name, type, hourly_rate, peak_rate, price_90min, price_120min, peak_price_90min, peak_price_120min')
              .eq('user_id', ownerId)
              .order('type')
              .order('name'),
            supabase
              .from('membership_plans')
              .select('*')
              .eq('user_id', ownerId)
              .eq('is_active', true)
              .eq('show_on_pricing', true)
              .order('sort_order')
              .order('price'),
          ]);
          setCourts(courtRes.data || []);
          setMembershipPlans(planRes.data || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [clubId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="text-lg">Clube não encontrado</p>
      </div>
    );
  }

  const indoorCourts = courts.filter(c => c.type === 'indoor' || c.type === 'covered');
  const outdoorCourts = courts.filter(c => c.type === 'outdoor');

  const getAvgPrice = (group: Court[], field: keyof Court) => {
    const vals = group.map(c => Number(c[field]) || 0).filter(v => v > 0);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  const getPrice90 = (group: Court[]) => {
    const explicit = group.map(c => c.price_90min).filter(v => v != null && v > 0);
    if (explicit.length > 0) return Math.round((explicit.reduce((a, b) => a! + b!, 0)! / explicit.length) * 100) / 100;
    return Math.round(getAvgPrice(group, 'hourly_rate') * 1.5 * 100) / 100;
  };

  const getPrice120 = (group: Court[]) => {
    const explicit = group.map(c => c.price_120min).filter(v => v != null && v > 0);
    if (explicit.length > 0) return Math.round((explicit.reduce((a, b) => a! + b!, 0)! / explicit.length) * 100) / 100;
    return Math.round(getAvgPrice(group, 'hourly_rate') * 2 * 100) / 100;
  };

  const renderCourtPricing = (label: string, group: Court[], icon: string) => {
    if (group.length === 0) return null;
    const h1 = getAvgPrice(group, 'hourly_rate');
    const m90 = getPrice90(group);
    const h2 = getPrice120(group);

    const rows = [
      { dur: '1 Hora', court: h1, player: h1 / 4 },
      { dur: '90 Min', court: m90, player: m90 / 4 },
      { dur: '2 Horas', court: h2, player: h2 / 4 },
    ].filter(r => r.court > 0);

    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">{label}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div />
          <div className="text-center text-xs font-semibold text-orange-300 uppercase tracking-wider">Campo</div>
          <div className="text-center text-xs font-semibold text-orange-300 uppercase tracking-wider">Por Jogador</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid grid-cols-3 gap-2 py-3 ${i > 0 ? 'border-t border-white/10' : ''}`}>
            <div className="text-white font-semibold text-sm flex items-center">{r.dur}</div>
            <div className="text-center">
              <span className="text-white font-bold text-lg">{formatPrice(r.court)}</span>
            </div>
            <div className="text-center">
              <span className="bg-orange-500/20 text-orange-300 font-bold text-sm px-3 py-1 rounded-full">
                {formatPrice(r.player)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 -right-20 w-80 h-80 rounded-full bg-orange-400 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-400 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-orange-300 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8 pb-16">
        {/* Header */}
        <div className="text-center mb-8">
          {club.logo_url && (
            <img
              src={club.logo_url}
              alt={club.name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg shadow-orange-500/20 border-2 border-orange-400/30"
            />
          )}
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Preçário</h1>
          <p className="text-orange-400 font-semibold text-lg mt-1">{club.name}</p>
        </div>

        {/* Court Pricing */}
        <div className="space-y-4 mb-8">
          {renderCourtPricing('Campos Indoor', indoorCourts, '🏟️')}
          {renderCourtPricing('Campos Outdoor', outdoorCourts, '☀️')}
        </div>

        {/* Memberships */}
        {membershipPlans.length > 0 && (
        <div className="mb-8">
          <div className="text-center mb-5">
            <h2 className="text-xl font-extrabold text-white">
              Torna-te Sócio e Joga com
            </h2>
            <h2 className="text-xl font-extrabold text-orange-400">
              Vantagens o Ano inteiro!
            </h2>
          </div>

          <div className="space-y-3">
            {membershipPlans.map((plan, i) => {
              const isTop = i === 0 && plan.price >= 200;
              const durationLabel = plan.duration_months >= 12
                ? (plan.duration_months === 12 ? 'Anual' : `${Math.round(plan.duration_months / 12)} Anos`)
                : plan.duration_months === 6 ? 'Semestral'
                : plan.duration_months === 1 ? 'Mensal' : `${plan.duration_months} Meses`;
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isTop
                      ? 'border-orange-400/40 shadow-lg shadow-orange-500/10'
                      : 'border-white/10'
                  }`}
                >
                  <div className={`flex items-center justify-between px-4 py-3 ${
                    isTop
                      ? 'bg-gradient-to-r from-orange-500/30 to-orange-600/15'
                      : 'bg-white/8'
                  }`}>
                    <div>
                      <p className={`font-bold text-sm ${isTop ? 'text-orange-300' : 'text-white'}`}>
                        {plan.name}
                      </p>
                      <p className="text-xs text-slate-400">{durationLabel}</p>
                    </div>
                    <span className={`font-extrabold text-lg whitespace-nowrap ${
                      isTop ? 'text-orange-400' : 'text-white'
                    }`}>
                      {formatPrice(plan.price)}
                    </span>
                  </div>
                  {plan.benefits && plan.benefits.length > 0 && (
                    <div className={`px-4 py-2.5 ${isTop ? 'bg-orange-500/10' : 'bg-white/4'}`}>
                      {plan.benefits.map((b, bi) => (
                        <p key={bi} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span> {b}
                        </p>
                      ))}
                      {plan.court_discount_percent > 0 && (
                        <p className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">•</span> {plan.court_discount_percent}% desconto nos campos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-gradient-to-r from-orange-500/15 to-transparent rounded-xl p-4 border border-orange-400/20">
            <p className="text-orange-400 font-bold text-sm mb-1">Vantagens Membros:</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              Descontos nos Torneios, Promoções Exclusivas!
            </p>
          </div>
        </div>
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎾</span>
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Equipamentos</h3>
          </div>
          <div className="space-y-0">
            {equipment.map((item, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 ${i > 0 ? 'border-t border-white/10' : ''}`}>
                <span className="text-white text-sm font-medium">{item.name}</span>
                <span className="text-orange-300 font-bold text-sm bg-orange-500/15 px-3 py-1 rounded-full">{item.price}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-slate-400 text-xs">Powered by <span className="text-orange-400 font-semibold">PadelOne</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
