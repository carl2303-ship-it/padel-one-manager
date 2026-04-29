import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Building2, Trophy, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface KPI {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
}

interface MonthlyData { month: string; count: number; }
interface TxnByType { type: string; total: number; }
interface PlanData { name: string; value: number; }

const PIE_COLORS = ['#D32F2F', '#555555'];

export default function HQDashboard() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<MonthlyData[]>([]);
  const [txnsByType, setTxnsByType] = useState<TxnByType[]>([]);
  const [planData, setPlanData] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadKPIs(), loadMonthlyUsers(), loadTxnsByType(), loadPlanData()]);
    setLoading(false);
  };

  const loadKPIs = async () => {
    const [players, clubs, organizers, txns] = await Promise.all([
      supabase.from('player_accounts').select('id', { count: 'exact', head: true }),
      supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organizers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('player_transactions').select('amount'),
    ]);

    const totalVolume = (txns.data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);

    setKpis([
      { label: 'Jogadores', value: players.count ?? 0, icon: <Users size={22} className="text-[#D32F2F]" /> },
      { label: 'Clubes Ativos', value: clubs.count ?? 0, icon: <Building2 size={22} className="text-[#D32F2F]" /> },
      { label: 'Organizadores', value: organizers.count ?? 0, icon: <Trophy size={22} className="text-[#D32F2F]" /> },
      { label: 'Volume Transações', value: `€${totalVolume.toFixed(0)}`, icon: <ArrowLeftRight size={22} className="text-[#D32F2F]" /> },
    ]);
  };

  const loadMonthlyUsers = async () => {
    const { data } = await supabase
      .from('player_accounts')
      .select('created_at')
      .order('created_at');

    if (!data) return;
    const byMonth: Record<string, number> = {};
    data.forEach(row => {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    setMonthlyUsers(
      Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, count]) => ({ month, count }))
    );
  };

  const loadTxnsByType = async () => {
    const { data } = await supabase.from('player_transactions').select('transaction_type, amount');
    if (!data) return;
    const byType: Record<string, number> = {};
    data.forEach(row => {
      const t = row.transaction_type || 'other';
      byType[t] = (byType[t] || 0) + Number(row.amount || 0);
    });
    setTxnsByType(
      Object.entries(byType).map(([type, total]) => ({
        type: type === 'booking' ? 'Reservas' : type === 'open_game' ? 'Open Games' : type === 'academy' ? 'Academia' : type === 'bar' ? 'Bar' : type,
        total: Math.round(total)
      }))
    );
  };

  const loadPlanData = async () => {
    const { data } = await supabase.from('clubs').select('plan_type');
    if (!data) return;
    const bronze = data.filter(c => c.plan_type === 'bronze').length;
    const silver = data.filter(c => c.plan_type === 'silver').length;
    const gold = data.filter(c => c.plan_type === 'gold').length;
    setPlanData([
      { name: 'Bronze', value: bronze || 0 },
      { name: 'Silver', value: silver || 0 },
      { name: 'Gold', value: gold || 0 },
    ]);
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
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{kpi.label}</span>
              {kpi.icon}
            </div>
            <div className="text-2xl font-bold text-gray-100">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Users */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#D32F2F]" />
            Novos Jogadores / Mês
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyUsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }}
                />
                <Line type="monotone" dataKey="count" stroke="#D32F2F" strokeWidth={2} dot={{ fill: '#D32F2F' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions by type */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingDown size={16} className="text-[#D32F2F]" />
            Transações por Tipo (€)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={txnsByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="type" tick={{ fill: '#888', fontSize: 11 }} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }}
                />
                <Bar dataKey="total" fill="#D32F2F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie chart: plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Clubes por Plano</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {planData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#eee' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
