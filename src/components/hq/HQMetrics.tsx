import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart3, Building2, Crown, Users, CreditCard, TrendingUp,
  Calendar, Medal, Award, Euro
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

interface MonthlyRevenue { month: string; amount: number; }
interface TierDistribution { name: string; value: number; }
interface LicenseStats { total: number; active: number; used: number; expired: number; }

const TIER_COLORS: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#A0A0A0',
  Gold: '#FFD700',
  Preview: '#F59E0B',
};

const PIE_COLORS = ['#CD7F32', '#A0A0A0', '#FFD700', '#F59E0B'];

export default function HQMetrics() {
  const [loading, setLoading] = useState(true);

  const [totalClubs, setTotalClubs] = useState(0);
  const [activeClubs, setActiveClubs] = useState(0);
  const [totalOrganizers, setTotalOrganizers] = useState(0);
  const [activeOrganizers, setActiveOrganizers] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);

  const [clubTiers, setClubTiers] = useState<TierDistribution[]>([]);
  const [orgTiers, setOrgTiers] = useState<TierDistribution[]>([]);
  const [licenseStats, setLicenseStats] = useState<LicenseStats>({ total: 0, active: 0, used: 0, expired: 0 });

  const [clubsExpiringSoon, setClubsExpiringSoon] = useState(0);
  const [orgsExpiringSoon, setOrgsExpiringSoon] = useState(0);

  const [revenueByType, setRevenueByType] = useState<{ name: string; value: number }[]>([]);
  const [monthlyClubGrowth, setMonthlyClubGrowth] = useState<{ month: string; clubs: number; organizers: number }[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadCounts(),
      loadPlatformRevenue(),
      loadTierDistributions(),
      loadLicenseStats(),
      loadExpirations(),
      loadGrowth(),
    ]);
    setLoading(false);
  };

  const loadCounts = async () => {
    const [clubs, activeC, orgs, activeO, players] = await Promise.all([
      supabase.from('clubs').select('id', { count: 'exact', head: true }),
      supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organizers').select('id', { count: 'exact', head: true }),
      supabase.from('organizers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('player_accounts').select('id', { count: 'exact', head: true }),
    ]);
    setTotalClubs(clubs.count ?? 0);
    setActiveClubs(activeC.count ?? 0);
    setTotalOrganizers(orgs.count ?? 0);
    setActiveOrganizers(activeO.count ?? 0);
    setTotalPlayers(players.count ?? 0);
  };

  const loadPlatformRevenue = async () => {
    const { data } = await supabase.from('platform_payments').select('amount, created_at, target_type').eq('status', 'completed');
    if (!data) return;

    const total = data.reduce((s, p) => s + Number(p.amount || 0), 0);
    setTotalRevenue(total);

    // Monthly breakdown
    const byMonth: Record<string, number> = {};
    data.forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(p.amount || 0);
    });
    const months = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));
    setMonthlyRevenue(months);

    // Revenue by type
    const byType: Record<string, number> = {};
    data.forEach(p => {
      const t = p.target_type === 'club' ? 'Clubes' : 'Organizadores';
      byType[t] = (byType[t] || 0) + Number(p.amount || 0);
    });
    setRevenueByType(Object.entries(byType).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })));
  };

  const loadTierDistributions = async () => {
    const { data: clubs } = await supabase.from('clubs').select('plan_type');
    if (clubs) {
      const counts: Record<string, number> = {};
      clubs.forEach(c => { const t = c.plan_type || 'bronze'; counts[t] = (counts[t] || 0) + 1; });
      setClubTiers(Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), value
      })));
    }

    const { data: orgs } = await supabase.from('organizers').select('organizer_tier');
    if (orgs) {
      const counts: Record<string, number> = {};
      orgs.forEach(o => { const t = o.organizer_tier || 'bronze'; counts[t] = (counts[t] || 0) + 1; });
      setOrgTiers(Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), value
      })));
    }
  };

  const loadLicenseStats = async () => {
    const { data } = await supabase.from('license_keys').select('status');
    if (!data) return;
    setLicenseStats({
      total: data.length,
      active: data.filter(k => k.status === 'active').length,
      used: data.filter(k => k.status === 'used').length,
      expired: data.filter(k => k.status === 'expired').length,
    });
  };

  const loadExpirations = async () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const now = new Date().toISOString();
    const limit = thirtyDaysFromNow.toISOString();

    const { count: clubCount } = await supabase.from('clubs')
      .select('id', { count: 'exact', head: true })
      .gt('contract_expires_at', now)
      .lte('contract_expires_at', limit);

    const { count: orgCount } = await supabase.from('organizers')
      .select('id', { count: 'exact', head: true })
      .gt('subscription_expires_at', now)
      .lte('subscription_expires_at', limit);

    setClubsExpiringSoon(clubCount ?? 0);
    setOrgsExpiringSoon(orgCount ?? 0);
  };

  const loadGrowth = async () => {
    const [{ data: clubs }, { data: orgs }] = await Promise.all([
      supabase.from('clubs').select('created_at').order('created_at'),
      supabase.from('organizers').select('created_at').order('created_at'),
    ]);

    const months: Record<string, { clubs: number; organizers: number }> = {};
    (clubs || []).forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { clubs: 0, organizers: 0 };
      months[key].clubs++;
    });
    (orgs || []).forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { clubs: 0, organizers: 0 };
      months[key].organizers++;
    });

    setMonthlyClubGrowth(
      Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => ({ month, ...data }))
    );
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
        <BarChart3 size={24} className="text-[#D32F2F]" />
        Métricas Padel One HQ
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Clubes" value={totalClubs} sub={`${activeClubs} ativos`} icon={<Building2 size={20} />} />
        <KPICard label="Organizadores" value={totalOrganizers} sub={`${activeOrganizers} ativos`} icon={<Crown size={20} />} />
        <KPICard label="Jogadores" value={totalPlayers} icon={<Users size={20} />} />
        <KPICard label="Receita Total" value={`€${totalRevenue.toFixed(0)}`} icon={<Euro size={20} />} color="text-green-400" />
        <KPICard label="Chaves Geradas" value={licenseStats.total} sub={`${licenseStats.active} disponíveis`} icon={<CreditCard size={20} />} />
        <KPICard
          label="Expiram em 30d"
          value={clubsExpiringSoon + orgsExpiringSoon}
          sub={`${clubsExpiringSoon} clubes · ${orgsExpiringSoon} org.`}
          icon={<Calendar size={20} />}
          color={clubsExpiringSoon + orgsExpiringSoon > 0 ? 'text-amber-400' : 'text-gray-500'}
        />
      </div>

      {/* Revenue + Growth charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            Receita Plataforma / Mês (€)
          </h2>
          <div className="h-64">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }} />
                  <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} name="Receita (€)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Sem dados de receita</div>
            )}
          </div>
        </div>

        {/* Club & Org Growth */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#D32F2F]" />
            Crescimento Mensal
          </h2>
          <div className="h-64">
            {monthlyClubGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyClubGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }} />
                  <Legend wrapperStyle={{ color: '#888', fontSize: 12 }} />
                  <Line type="monotone" dataKey="clubs" stroke="#D32F2F" strokeWidth={2} dot={{ fill: '#D32F2F' }} name="Clubes" />
                  <Line type="monotone" dataKey="organizers" stroke="#FFD700" strokeWidth={2} dot={{ fill: '#FFD700' }} name="Organizadores" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Sem dados de crescimento</div>
            )}
          </div>
        </div>
      </div>

      {/* Tier distributions + Revenue by type + License stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Club Tiers */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-[#D32F2F]" />
            Clubes por Plano
          </h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clubTiers} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {clubTiers.map((entry, i) => (
                    <Cell key={i} fill={TIER_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Organizer Tiers */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Crown size={16} className="text-yellow-400" />
            Organizadores por Nível
          </h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orgTiers} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {orgTiers.map((entry, i) => (
                    <Cell key={i} fill={TIER_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by type + License stats */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-purple-400" />
            Resumo de Licenças
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Total geradas" value={licenseStats.total} color="text-gray-100" />
              <StatBox label="Disponíveis" value={licenseStats.active} color="text-green-400" />
              <StatBox label="Utilizadas" value={licenseStats.used} color="text-blue-400" />
              <StatBox label="Expiradas" value={licenseStats.expired} color="text-red-400" />
            </div>

            {revenueByType.length > 0 && (
              <div className="pt-3 border-t border-[#2a2a2a]">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Receita por tipo</p>
                {revenueByType.map(r => (
                  <div key={r.name} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-400">{r.name}</span>
                    <span className="text-sm font-semibold text-green-400">€{r.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier detail tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TierTable title="Clubes" icon={<Building2 size={16} className="text-[#D32F2F]" />} tiers={clubTiers} total={totalClubs} />
        <TierTable title="Organizadores" icon={<Crown size={16} className="text-yellow-400" />} tiers={orgTiers} total={totalOrganizers} />
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, icon, color }: {
  label: string; value: number | string; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={color || 'text-[#D32F2F]'}>{icon}</span>
      </div>
      <div className={`text-xl font-bold ${color || 'text-gray-100'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#111111] rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function TierTable({ title, icon, tiers, total }: {
  title: string; icon: React.ReactNode; tiers: TierDistribution[]; total: number;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">{icon} {title} por Nível</h3>
      <div className="space-y-2">
        {tiers.map(t => {
          const pct = total > 0 ? Math.round((t.value / total) * 100) : 0;
          const tierColor = TIER_COLORS[t.name] || '#666';
          return (
            <div key={t.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300 font-medium flex items-center gap-1.5">
                  {t.name === 'Gold' ? <Crown size={12} style={{ color: tierColor }} /> :
                   t.name === 'Silver' ? <Award size={12} style={{ color: tierColor }} /> :
                   <Medal size={12} style={{ color: tierColor }} />}
                  {t.name}
                </span>
                <span className="text-gray-500">{t.value} ({pct}%)</span>
              </div>
              <div className="w-full bg-[#111111] rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: tierColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
