import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface PlatformPlan {
  id: string;
  name: string;
  target_type: 'club' | 'organizer';
  price_monthly: number | null;
  price_annual: number | null;
  features: Record<string, unknown>;
}

const FEATURE_LABELS: Record<string, string> = {
  max_courts: 'Campos',
  bar_module: 'Módulo Bar',
  tour_license: 'Licença Torneios',
  analytics: 'Analytics',
  max_players_per_tournament: 'Máx. jogadores/torneio',
  max_tournaments_month: 'Torneios/mês',
};

export default function PlatformPricing() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });
    if (data) setPlans(data);
    setLoading(false);
  };

  const clubPlans = plans.filter(p => p.target_type === 'club');
  const orgPlans = plans.filter(p => p.target_type === 'organizer');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Padel One
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            A plataforma completa para gestão de clubes de padel e organização de torneios.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'monthly' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'annual' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Anual <span className="text-xs opacity-75 ml-1">(-17%)</span>
            </button>
          </div>
        </div>

        {/* Club Plans */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Para Clubes</h2>
          <p className="text-sm text-slate-400 text-center mb-8">Gerencie o seu clube com todas as ferramentas necessárias</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {clubPlans.map((plan, idx) => {
              const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
              const isPopular = idx === clubPlans.length - 1;
              return (
                <div key={plan.id} className={`relative bg-slate-800 rounded-2xl border p-6 ${
                  isPopular ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700'
                }`}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    {price != null ? (
                      <>
                        <span className="text-3xl font-bold text-white">{price}€</span>
                        <span className="text-sm text-slate-400">/{billingCycle === 'annual' ? 'ano' : 'mês'}</span>
                      </>
                    ) : (
                      <span className="text-lg text-slate-400">Contacte-nos</span>
                    )}
                  </div>

                  {plan.features && Object.keys(plan.features).length > 0 && (
                    <ul className="space-y-3 mb-6">
                      {Object.entries(plan.features).map(([k, v]) => (
                        <li key={k} className="flex items-center gap-2 text-sm">
                          {typeof v === 'boolean' ? (
                            v ? (
                              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            )
                          ) : (
                            <span className="text-red-400 font-semibold text-xs w-4 shrink-0">{String(v)}</span>
                          )}
                          <span className={typeof v === 'boolean' && !v ? 'text-slate-500' : 'text-slate-300'}>
                            {FEATURE_LABELS[k] || k.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <a
                    href="mailto:info@padelone.app?subject=Subscrição Padel One - Clube"
                    className={`block w-full py-3 rounded-xl text-center text-sm font-semibold transition-colors ${
                      isPopular
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    Começar agora
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Organizer Plans */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Para Organizadores</h2>
          <p className="text-sm text-slate-400 text-center mb-8">Crie e gerencie torneios sem precisar de um clube</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {orgPlans.map((plan, idx) => {
              const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
              const isPopular = idx === 1;
              const tierColors: Record<string, string> = {
                Bronze: 'from-amber-900/20 to-amber-800/10 border-amber-700/50',
                Silver: 'from-slate-700/30 to-slate-600/10 border-slate-500/50',
                Gold: 'from-yellow-900/20 to-yellow-800/10 border-yellow-600/50',
              };

              return (
                <div key={plan.id} className={`relative bg-gradient-to-b rounded-2xl border p-6 ${
                  tierColors[plan.name] || 'border-slate-700'
                } ${isPopular ? 'ring-1 ring-slate-400' : ''}`}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Recomendado
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    {price != null ? (
                      <>
                        <span className="text-3xl font-bold text-white">{price}€</span>
                        <span className="text-sm text-slate-400">/{billingCycle === 'annual' ? 'ano' : 'mês'}</span>
                      </>
                    ) : (
                      <span className="text-lg text-slate-400">Contacte-nos</span>
                    )}
                  </div>

                  {plan.features && Object.keys(plan.features).length > 0 && (
                    <ul className="space-y-3 mb-6">
                      {Object.entries(plan.features).map(([k, v]) => (
                        <li key={k} className="flex items-center gap-2 text-sm">
                          <span className="text-red-400 font-semibold text-xs w-auto shrink-0">
                            {typeof v === 'number' && v === -1 ? '∞' : String(v)}
                          </span>
                          <span className="text-slate-300">
                            {FEATURE_LABELS[k] || k.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <a
                    href="mailto:info@padelone.app?subject=Subscrição Padel One - Organizador"
                    className={`block w-full py-3 rounded-xl text-center text-sm font-semibold transition-colors ${
                      isPopular
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    Começar agora
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500">
            Tem dúvidas? Contacte-nos em{' '}
            <a href="mailto:info@padelone.app" className="text-red-400 hover:text-red-300">
              info@padelone.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
