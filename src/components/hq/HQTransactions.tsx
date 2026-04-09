import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/authContext';
import { ArrowLeftRight, Search, Plus, X, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  club_owner_id: string;
  player_account_id: string | null;
  player_name: string;
  player_phone: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
  transaction_date: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  booking: 'Reserva',
  open_game: 'Open Game',
  academy: 'Academia',
  bar: 'Bar',
  bar_tab: 'Conta Bar',
  adjustment: 'Ajuste',
};

const TYPE_COLORS: Record<string, string> = {
  booking: 'bg-blue-900/30 text-blue-400',
  open_game: 'bg-purple-900/30 text-purple-400',
  academy: 'bg-yellow-900/30 text-yellow-400',
  bar: 'bg-orange-900/30 text-orange-400',
  bar_tab: 'bg-orange-900/30 text-orange-400',
  adjustment: 'bg-[#D32F2F]/20 text-[#D32F2F]',
};

export default function HQTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showInject, setShowInject] = useState(false);
  const [clubs, setClubs] = useState<{ id: string; owner_id: string; name: string }[]>([]);

  // Inject form
  const [injectClubOwnerId, setInjectClubOwnerId] = useState('');
  const [injectPlayerName, setInjectPlayerName] = useState('');
  const [injectPlayerPhone, setInjectPlayerPhone] = useState('');
  const [injectAmount, setInjectAmount] = useState('');
  const [injectNotes, setInjectNotes] = useState('');
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadClubs();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('player_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(500);
    if (data) setTransactions(data);
    setLoading(false);
  };

  const loadClubs = async () => {
    const { data } = await supabase.from('clubs').select('id, owner_id, name').order('name');
    if (data) setClubs(data);
  };

  const handleInject = async () => {
    if (!injectClubOwnerId || !injectPlayerName || !injectPlayerPhone || !injectAmount) return;
    setInjecting(true);
    const { error } = await supabase.from('player_transactions').insert({
      club_owner_id: injectClubOwnerId,
      player_name: injectPlayerName,
      player_phone: injectPlayerPhone,
      transaction_type: 'adjustment',
      amount: parseFloat(injectAmount),
      notes: injectNotes || `Ajuste manual por super admin`,
      transaction_date: new Date().toISOString(),
    });
    if (error) {
      alert('Erro: ' + error.message);
    } else {
      setShowInject(false);
      setInjectClubOwnerId('');
      setInjectPlayerName('');
      setInjectPlayerPhone('');
      setInjectAmount('');
      setInjectNotes('');
      loadTransactions();
    }
    setInjecting(false);
  };

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.transaction_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.player_name.toLowerCase().includes(s) || t.player_phone.includes(s);
    }
    return true;
  });

  const totalFiltered = filtered.reduce((sum, t) => sum + Number(t.amount || 0), 0);

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
          <ArrowLeftRight size={24} className="text-[#D32F2F]" />
          Transações
          <span className="text-sm font-normal text-gray-500 ml-2">({transactions.length})</span>
        </h1>
        <button
          onClick={() => setShowInject(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors"
        >
          <Plus size={16} />
          Injetar / Corrigir
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-[#D32F2F]/50"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-300 text-sm focus:outline-none"
        >
          <option value="all">Todos os tipos</option>
          <option value="booking">Reservas</option>
          <option value="open_game">Open Games</option>
          <option value="academy">Academia</option>
          <option value="bar">Bar</option>
          <option value="adjustment">Ajustes</option>
        </select>
        <div className="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm">
          <span className="text-gray-500">Total: </span>
          <span className="font-bold text-gray-100">€{totalFiltered.toFixed(2)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#151515] text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
          <div className="col-span-2">Data</div>
          <div className="col-span-3">Jogador</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Valor</div>
          <div className="col-span-3">Notas</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma transação encontrada.</div>
        ) : (
          filtered.slice(0, 200).map(txn => (
            <div key={txn.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-3 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#151515] transition-colors">
              <div className="lg:col-span-2 text-sm text-gray-400">
                {new Date(txn.transaction_date).toLocaleDateString('pt-PT')}
              </div>
              <div className="lg:col-span-3">
                <div className="text-sm text-gray-100">{txn.player_name}</div>
                <div className="text-xs text-gray-500">{txn.player_phone}</div>
              </div>
              <div className="lg:col-span-2">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[txn.transaction_type] || 'bg-[#2a2a2a] text-gray-400'}`}>
                  {TYPE_LABELS[txn.transaction_type] || txn.transaction_type}
                </span>
              </div>
              <div className="lg:col-span-2 text-sm font-medium text-gray-100">
                €{Number(txn.amount).toFixed(2)}
              </div>
              <div className="lg:col-span-3 text-sm text-gray-500 truncate">
                {txn.notes || '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inject Modal */}
      {showInject && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100">Injetar / Corrigir Transação</h2>
              <button onClick={() => setShowInject(false)} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Clube</label>
                <select
                  value={injectClubOwnerId}
                  onChange={e => setInjectClubOwnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none"
                >
                  <option value="">Selecionar clube...</option>
                  {clubs.map(c => (
                    <option key={c.id} value={c.owner_id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Jogador</label>
                <input
                  type="text"
                  value={injectPlayerName}
                  onChange={e => setInjectPlayerName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Telefone</label>
                <input
                  type="text"
                  value={injectPlayerPhone}
                  onChange={e => setInjectPlayerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none"
                  placeholder="+351..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Valor (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={injectAmount}
                  onChange={e => setInjectAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none"
                  placeholder="Ex: 10.00 ou -5.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Notas</label>
                <textarea
                  value={injectNotes}
                  onChange={e => setInjectNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-lg text-sm text-gray-100 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Motivo do ajuste..."
                />
              </div>
              <button
                onClick={handleInject}
                disabled={injecting || !injectClubOwnerId || !injectPlayerName || !injectPlayerPhone || !injectAmount}
                className="w-full py-2.5 bg-[#D32F2F] text-white rounded-lg text-sm font-medium hover:bg-[#B71C1C] transition-colors disabled:opacity-50"
              >
                {injecting ? 'A guardar...' : 'Criar Transação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
