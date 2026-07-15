import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, CreditCard, Trophy, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';
import {
  fetchClubTournaments,
  loadTournamentDetails,
  normalizePhone,
  openBarTabsForTournament,
  type TournamentDetails,
  type TournamentListItem,
} from '../lib/tournamentBarUtils';

interface TournamentBarManagementProps {
  staffClubOwnerId?: string | null;
  clubId?: string | null;
}

export default function TournamentBarManagement({ staffClubOwnerId, clubId }: TournamentBarManagementProps) {
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [selected, setSelected] = useState<TournamentDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchClubTournaments(effectiveUserId, clubId);
      setTournaments(list);
    } catch (err) {
      console.error('[TournamentBar] load tournaments:', err);
      setLoadError('Não foi possível carregar os torneios.');
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, clubId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openTournament = async (tournamentId: string) => {
    if (!effectiveUserId) return;
    setDetailLoading(true);
    try {
      const details = await loadTournamentDetails(tournamentId, effectiveUserId);
      setSelected(details);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelected = async () => {
    if (!selected || !effectiveUserId) return;
    const details = await loadTournamentDetails(selected.id, effectiveUserId);
    setSelected(details);
    await loadList();
  };

  const handleTogglePayment = async (playerId: string, currentStatus: string) => {
    if (!selected || !effectiveUserId) return;
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const player = selected.players.find(p => p.id === playerId);
    if (!player) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ payment_status: newStatus })
        .eq('id', playerId);
      if (error) throw error;

      const normalizedPhone = normalizePhone(player.phone_number);
      let playerAccountId: string | null = null;
      if (normalizedPhone) {
        const { data: existingAccount } = await supabase
          .from('player_accounts')
          .select('id')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();
        playerAccountId = existingAccount?.id || null;
        if (!existingAccount) {
          const { data: newAccount } = await supabase
            .from('player_accounts')
            .insert({ phone_number: normalizedPhone, name: player.name })
            .select('id')
            .single();
          playerAccountId = newAccount?.id || null;
        }
      }

      if (newStatus === 'paid') {
        const rpcParams: Record<string, unknown> = {
          p_club_owner_id: effectiveUserId,
          p_player_name: player.name,
          p_player_phone: normalizedPhone || 'unknown',
          p_transaction_type: 'tournament',
          p_amount: player.final_price || 0,
          p_reference_id: selected.id,
          p_reference_type: 'tournament',
          p_notes: `Torneio: ${selected.name}${player.category_name ? ' - ' + player.category_name : ''}`,
        };
        if (playerAccountId) rpcParams.p_player_account_id = playerAccountId;
        await supabase.rpc('insert_player_transaction', rpcParams);
      } else {
        await supabase.rpc('delete_player_transaction', {
          p_club_owner_id: effectiveUserId,
          p_reference_id: selected.id,
          p_reference_type: 'tournament',
          p_player_name: player.name,
        });
      }

      await refreshSelected();
    } catch (err) {
      console.error('[TournamentBar] payment toggle:', err);
      alert('Erro ao atualizar pagamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBarTabs = async () => {
    if (!selected || !effectiveUserId) return;
    setSaving(true);
    try {
      const result = await openBarTabsForTournament(selected, effectiveUserId);
      if (result.created === 0) {
        alert('Todos os jogadores já têm conta aberta no bar para este torneio.');
      } else {
        alert(`${result.created} conta(s) criada(s) no bar com sucesso!`);
      }
    } catch (err) {
      console.error('[TournamentBar] open tabs:', err);
      alert('Erro ao criar contas no bar.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-500" />
          Torneios
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Inscritos e contas de bar por torneio
        </p>
      </div>

      {loadError && (
        <div className="card p-4 border border-red-200 bg-red-50 text-red-700 text-sm">{loadError}</div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-gray-500">A carregar torneios...</div>
      ) : tournaments.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Sem torneios neste clube</p>
          <p className="text-sm text-gray-400 mt-1">Os torneios criados no Tour aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tournaments.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => void openTournament(t.id)}
              disabled={detailLoading}
              className="card p-4 text-left hover:shadow-md hover:border-amber-200 transition-all border border-gray-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(t.start_date)}
                    {t.end_date !== t.start_date && ` — ${formatDate(t.end_date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800 capitalize">
                    {t.status}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    {t.player_count}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-xl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{selected.name}</h2>
                <p className="text-sm text-white/90 mt-0.5">
                  {formatDate(selected.start_date)} — {formatDate(selected.end_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700">Estado</p>
                  <p className="text-sm font-bold text-amber-900 capitalize">{selected.status}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-700">Inscritos</p>
                  <p className="text-sm font-bold text-blue-900">{selected.players.length}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-700">Pagos</p>
                  <p className="text-sm font-bold text-green-900">
                    {selected.players.filter(p => p.payment_status === 'paid').length}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  Jogadores Inscritos ({selected.players.length})
                </h3>

                {selected.players.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center">Nenhum jogador inscrito</p>
                ) : (
                  <div className="space-y-2">
                    {selected.players.map(player => (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 rounded-lg p-3 border ${
                          player.payment_status === 'paid'
                            ? 'bg-green-50 border-green-200'
                            : player.payment_status === 'exempt'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          player.is_staff ? 'bg-blue-500' : player.is_member ? 'bg-green-500' : 'bg-gray-400'
                        }`}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
                            {player.category_name && (
                              <span className="text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                {player.category_name}
                              </span>
                            )}
                          </div>
                          {player.phone_number && (
                            <p className="text-xs text-gray-500">{player.phone_number}</p>
                          )}
                        </div>
                        <div className="text-right mr-1">
                          {player.is_staff ? (
                            <p className="text-sm font-bold text-blue-600">Isento</p>
                          ) : (
                            <p className="text-sm font-bold text-gray-900">
                              {player.final_price === 0 ? 'Grátis' : `${player.final_price}€`}
                            </p>
                          )}
                        </div>
                        {selected.allow_club_payment && player.payment_status !== 'exempt' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleTogglePayment(player.id, player.payment_status)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                              player.payment_status === 'paid'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {player.payment_status === 'paid' ? (
                              <><Check className="w-3.5 h-3.5" /> Pago</>
                            ) : (
                              <><Clock className="w-3.5 h-3.5" /> Pendente</>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.players.length > 0 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleOpenBarTabs()}
                  className="w-full px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  Abrir Contas no Bar para Jogadores
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
