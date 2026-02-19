import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/authContext';
import {
  Gift,
  RefreshCw,
  Save,
  Edit3,
  X,
  Check,
  Star,
  Gamepad2,
  Trophy,
  Coffee,
  Zap,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Trash2,
  ShoppingBag,
  Image,
  Tag,
  Package,
  Eye,
  Clock,
  CheckCircle
} from 'lucide-react';

interface RewardRule {
  id: string;
  club_id: string;
  action_type: string;
  points: number;
  description: string | null;
  spend_threshold: number | null;
  is_active: boolean;
}

interface PlayerRewardEntry {
  player_account_id: string;
  player_name: string;
  player_avatar: string | null;
  total_points: number;
  tier: string;
}

interface CatalogItem {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  category: string;
  stock: number | null;
  is_active: boolean;
  sort_order: number;
}

interface Redemption {
  id: string;
  catalog_item_id: string;
  player_account_id: string;
  points_spent: number;
  status: string;
  redeemed_at: string;
  player_name?: string;
  item_title?: string;
}

interface RewardsManagementProps {
  staffClubOwnerId?: string | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: JSX.Element; description: string }> = {
  create_game: { label: 'Criar jogo aberto', icon: <Gamepad2 className="w-4 h-4" />, description: 'Pontos quando o jogador cria um jogo aberto' },
  join_game: { label: 'Entrar num jogo', icon: <Users className="w-4 h-4" />, description: 'Pontos quando o jogador entra num jogo aberto' },
  submit_result: { label: 'Submeter resultado', icon: <Edit3 className="w-4 h-4" />, description: 'Pontos quando o jogador submete um resultado' },
  confirm_result: { label: 'Confirmar resultado', icon: <Check className="w-4 h-4" />, description: 'Pontos quando o jogador confirma um resultado' },
  tournament_played: { label: 'Participar num torneio', icon: <Trophy className="w-4 h-4" />, description: 'Pontos quando o jogador participa num torneio' },
  bar_spend: { label: 'Consumo no bar', icon: <Coffee className="w-4 h-4" />, description: 'Pontos por cada X€ gastos no bar' },
  first_game: { label: 'Primeiro jogo', icon: <Zap className="w-4 h-4" />, description: 'Bónus pelo primeiro jogo na plataforma' },
  streak_3: { label: '3 jogos seguidos', icon: <TrendingUp className="w-4 h-4" />, description: 'Bónus por 3 jogos consecutivos' },
  streak_7: { label: '7 jogos seguidos', icon: <Star className="w-4 h-4" />, description: 'Bónus por 7 jogos consecutivos' },
  custom: { label: 'Personalizado', icon: <Gift className="w-4 h-4" />, description: 'Regra personalizada' },
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  drink: { label: 'Bebida', emoji: '🍹' },
  food: { label: 'Comida', emoji: '🍕' },
  court: { label: 'Campo', emoji: '🎾' },
  merchandise: { label: 'Merchandise', emoji: '👕' },
  lesson: { label: 'Aula', emoji: '📚' },
  discount: { label: 'Desconto', emoji: '💰' },
  experience: { label: 'Experiência', emoji: '⭐' },
  other: { label: 'Outros', emoji: '🎁' },
};

const TIER_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  silver: { label: 'Silver', color: 'bg-gray-100 text-gray-700', emoji: '🥈' },
  gold: { label: 'Gold', color: 'bg-yellow-100 text-yellow-700', emoji: '🥇' },
  platinum: { label: 'Platinum', color: 'bg-purple-100 text-purple-700', emoji: '🏅' },
  diamond: { label: 'Diamond', color: 'bg-cyan-100 text-cyan-700', emoji: '💎' },
};

export default function RewardsManagement({ staffClubOwnerId }: RewardsManagementProps) {
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;

  const [rules, setRules] = useState<RewardRule[]>([]);
  const [players, setPlayers] = useState<PlayerRewardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ points: number; isActive: boolean; spendThreshold: number }>({ points: 0, isActive: true, spendThreshold: 10 });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'catalog' | 'redemptions' | 'leaderboard'>('rules');
  const [searchTerm, setSearchTerm] = useState('');

  // Catalog state
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [editingCatalog, setEditingCatalog] = useState<CatalogItem | null>(null);
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogForm, setCatalogForm] = useState({
    title: '', description: '', image_url: '', cost_points: 50,
    category: 'other', stock: '', is_active: true, sort_order: 0,
  });

  // Redemptions state
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    if (!effectiveUserId) return;
    setLoading(true);

    // Get club id
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_id', effectiveUserId)
      .limit(1);

    if (!clubs || clubs.length === 0) {
      setLoading(false);
      return;
    }

    const cid = clubs[0].id;
    setClubId(cid);

    // Get reward rules
    const { data: rulesData } = await supabase
      .from('reward_rules')
      .select('*')
      .eq('club_id', cid)
      .order('action_type');

    if (rulesData) setRules(rulesData);

    // Get catalog items
    const { data: catalogData } = await supabase
      .from('reward_catalog')
      .select('*')
      .eq('club_id', cid)
      .order('sort_order', { ascending: true });

    if (catalogData) setCatalogItems(catalogData);

    // Get recent redemptions
    const { data: redemptionsData } = await supabase
      .from('reward_redemptions')
      .select('id, catalog_item_id, player_account_id, points_spent, status, redeemed_at')
      .eq('club_id', cid)
      .order('redeemed_at', { ascending: false })
      .limit(50);

    if (redemptionsData && redemptionsData.length > 0) {
      const rdPaIds = [...new Set(redemptionsData.map(r => r.player_account_id))];
      const rdItemIds = [...new Set(redemptionsData.map(r => r.catalog_item_id))];

      const [{ data: rdAccounts }, { data: rdItems }] = await Promise.all([
        supabase.from('player_accounts').select('id, name').in('id', rdPaIds),
        supabase.from('reward_catalog').select('id, title').in('id', rdItemIds),
      ]);

      const rdAccMap = new Map((rdAccounts || []).map(a => [a.id, a.name]));
      const rdItemMap = new Map((rdItems || []).map(i => [i.id, i.title]));

      setRedemptions(redemptionsData.map(r => ({
        ...r,
        player_name: rdAccMap.get(r.player_account_id) || 'Jogador',
        item_title: rdItemMap.get(r.catalog_item_id) || 'Item',
      })));
    }

    // Get player rankings
    const { data: playerData } = await supabase
      .from('player_rewards')
      .select('player_account_id, total_points, tier')
      .eq('club_id', cid)
      .order('total_points', { ascending: false })
      .limit(50);

    if (playerData && playerData.length > 0) {
      const paIds = playerData.map(p => p.player_account_id);
      const { data: accounts } = await supabase
        .from('player_accounts')
        .select('id, name, avatar_url')
        .in('id', paIds);

      const accountMap = new Map((accounts || []).map(a => [a.id, a]));

      setPlayers(playerData.map(p => {
        const acct = accountMap.get(p.player_account_id);
        return {
          player_account_id: p.player_account_id,
          player_name: acct?.name || 'Jogador',
          player_avatar: acct?.avatar_url || null,
          total_points: p.total_points,
          tier: p.tier || 'silver',
        };
      }));
    }

    setLoading(false);
  }

  async function saveRule(ruleId: string) {
    setSaving(true);
    const { error } = await supabase
      .from('reward_rules')
      .update({
        points: editValues.points,
        is_active: editValues.isActive,
        spend_threshold: editValues.spendThreshold,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId);

    if (error) {
      alert('Erro ao guardar: ' + error.message);
    } else {
      setRules(prev => prev.map(r =>
        r.id === ruleId
          ? { ...r, points: editValues.points, is_active: editValues.isActive, spend_threshold: editValues.spendThreshold }
          : r
      ));
      setEditingRule(null);
    }
    setSaving(false);
  }

  async function createMissingRules() {
    if (!clubId) return;
    setSaving(true);

    const existingTypes = new Set(rules.map(r => r.action_type));
    const missing = Object.keys(ACTION_LABELS).filter(t => !existingTypes.has(t));

    if (missing.length === 0) {
      alert('Todas as regras já estão criadas!');
      setSaving(false);
      return;
    }

    const defaults: Record<string, number> = {
      create_game: 15, join_game: 10, submit_result: 5, confirm_result: 5,
      tournament_played: 20, bar_spend: 5, first_game: 25, streak_3: 15, streak_7: 30, custom: 10,
    };

    const inserts = missing.map(actionType => ({
      club_id: clubId,
      action_type: actionType,
      points: defaults[actionType] || 10,
      description: ACTION_LABELS[actionType]?.description || '',
      is_active: true,
    }));

    const { error } = await supabase.from('reward_rules').insert(inserts);
    if (error) {
      alert('Erro: ' + error.message);
    } else {
      loadData();
    }
    setSaving(false);
  }

  async function saveCatalogItem() {
    if (!clubId || !catalogForm.title.trim()) return;
    setSaving(true);

    const payload = {
      club_id: clubId,
      title: catalogForm.title.trim(),
      description: catalogForm.description.trim() || null,
      image_url: catalogForm.image_url.trim() || null,
      cost_points: catalogForm.cost_points,
      category: catalogForm.category,
      stock: catalogForm.stock ? parseInt(catalogForm.stock) : null,
      is_active: catalogForm.is_active,
      sort_order: catalogForm.sort_order,
    };

    if (editingCatalog) {
      const { error } = await supabase
        .from('reward_catalog')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingCatalog.id);
      if (error) alert('Erro: ' + error.message);
      else {
        setCatalogItems(prev => prev.map(i => i.id === editingCatalog.id ? { ...i, ...payload } as CatalogItem : i));
      }
    } else {
      const { data, error } = await supabase
        .from('reward_catalog')
        .insert(payload)
        .select()
        .single();
      if (error) alert('Erro: ' + error.message);
      else if (data) setCatalogItems(prev => [...prev, data as CatalogItem]);
    }

    setShowCatalogForm(false);
    setEditingCatalog(null);
    setCatalogForm({ title: '', description: '', image_url: '', cost_points: 50, category: 'other', stock: '', is_active: true, sort_order: 0 });
    setSaving(false);
  }

  async function deleteCatalogItem(itemId: string) {
    if (!confirm('Tem certeza que quer apagar esta recompensa?')) return;
    const { error } = await supabase.from('reward_catalog').delete().eq('id', itemId);
    if (error) alert('Erro: ' + error.message);
    else setCatalogItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function toggleCatalogActive(item: CatalogItem) {
    const { error } = await supabase
      .from('reward_catalog')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (!error) setCatalogItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  async function updateRedemptionStatus(redemptionId: string, newStatus: string) {
    const updateData: any = { status: newStatus };
    if (newStatus === 'approved') updateData.approved_at = new Date().toISOString();
    if (newStatus === 'used') updateData.used_at = new Date().toISOString();

    const { error } = await supabase
      .from('reward_redemptions')
      .update(updateData)
      .eq('id', redemptionId);

    if (error) alert('Erro: ' + error.message);
    else {
      setRedemptions(prev => prev.map(r => r.id === redemptionId ? { ...r, status: newStatus } : r));

      // If cancelled, refund points
      if (newStatus === 'cancelled') {
        const redemption = redemptions.find(r => r.id === redemptionId);
        if (redemption) {
          await supabase.rpc('award_reward_points', {
            p_player_account_id: redemption.player_account_id,
            p_club_id: clubId,
            p_action_type: 'custom',
            p_custom_description: 'Reembolso: resgate cancelado',
          });
        }
      }
    }
  }

  function openEditCatalog(item: CatalogItem) {
    setEditingCatalog(item);
    setCatalogForm({
      title: item.title,
      description: item.description || '',
      image_url: item.image_url || '',
      cost_points: item.cost_points,
      category: item.category,
      stock: item.stock !== null ? String(item.stock) : '',
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setShowCatalogForm(true);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Gift className="w-8 h-8 text-amber-600" />
          <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500">A carregar...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gift className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sistema de Rewards</h1>
            <p className="text-sm text-gray-500">Configure pontos de reward para ações dos jogadores</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500 font-medium">Regras ativas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{rules.filter(r => r.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500 font-medium">Jogadores com pontos</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{players.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500 font-medium">Total pontos distribuídos</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{players.reduce((sum, p) => sum + p.total_points, 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500 font-medium">Líder</span>
          </div>
          <p className="text-lg font-bold text-purple-600 truncate">{players[0]?.player_name || '-'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'rules' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ⚙️ Regras
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'catalog' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🎁 Catálogo ({catalogItems.length})
        </button>
        <button
          onClick={() => setActiveTab('redemptions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === 'redemptions' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📋 Resgates
          {redemptions.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
              {redemptions.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'leaderboard' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏆 Ranking
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Sem regras configuradas</h3>
              <p className="text-sm text-gray-400 mb-4">Configure as regras de reward para o seu clube</p>
              <button
                onClick={createMissingRules}
                disabled={saving}
                className="px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'A criar...' : '✨ Criar regras padrão'}
              </button>
            </div>
          ) : (
            <>
              {Object.keys(ACTION_LABELS).filter(t => !rules.some(r => r.action_type === t)).length > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                  <p className="text-sm text-amber-700">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Existem {Object.keys(ACTION_LABELS).filter(t => !rules.some(r => r.action_type === t)).length} regras por criar
                  </p>
                  <button
                    onClick={createMissingRules}
                    disabled={saving}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    Criar
                  </button>
                </div>
              )}

              {rules.map(rule => {
                const actionInfo = ACTION_LABELS[rule.action_type] || { label: rule.action_type, icon: <Gift className="w-4 h-4" />, description: '' };
                const isEditing = editingRule === rule.id;

                return (
                  <div
                    key={rule.id}
                    className={`bg-white rounded-xl border ${rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-4 transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rule.is_active ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                          {actionInfo.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{actionInfo.label}</p>
                          <p className="text-xs text-gray-400">{actionInfo.description}</p>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500">Pontos:</label>
                            <input
                              type="number"
                              min="0"
                              max="1000"
                              value={editValues.points}
                              onChange={e => setEditValues(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                              className="w-20 text-center py-1 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          {rule.action_type === 'bar_spend' && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500">Por cada:</label>
                              <input
                                type="number"
                                min="1"
                                value={editValues.spendThreshold}
                                onChange={e => setEditValues(prev => ({ ...prev, spendThreshold: parseInt(e.target.value) || 10 }))}
                                className="w-16 text-center py-1 border border-gray-200 rounded-lg text-sm"
                              />
                              <span className="text-xs text-gray-400">€</span>
                            </div>
                          )}
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editValues.isActive}
                              onChange={e => setEditValues(prev => ({ ...prev, isActive: e.target.checked }))}
                              className="w-4 h-4 text-amber-600 rounded"
                            />
                            <span className="text-xs text-gray-500">Ativo</span>
                          </label>
                          <button
                            onClick={() => saveRule(rule.id)}
                            disabled={saving}
                            className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingRule(null)}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xl font-bold text-amber-600">{rule.points}</span>
                            <span className="text-xs text-gray-400 ml-1">pts</span>
                            {rule.action_type === 'bar_spend' && rule.spend_threshold && (
                              <p className="text-[10px] text-gray-400">por cada {rule.spend_threshold}€</p>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            rule.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {rule.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingRule(rule.id);
                              setEditValues({ points: rule.points, isActive: rule.is_active, spendThreshold: rule.spend_threshold || 10 });
                            }}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Defina as recompensas que os jogadores podem resgatar com os seus pontos</p>
            <button
              onClick={() => {
                setEditingCatalog(null);
                setCatalogForm({ title: '', description: '', image_url: '', cost_points: 50, category: 'other', stock: '', is_active: true, sort_order: catalogItems.length });
                setShowCatalogForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar recompensa
            </button>
          </div>

          {catalogItems.length === 0 && !showCatalogForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Catálogo vazio</h3>
              <p className="text-sm text-gray-400 mb-4">Adicione recompensas para os jogadores poderem resgatar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalogItems.map(item => {
                const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border ${item.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'} overflow-hidden transition-all hover:shadow-md`}
                  >
                    {item.image_url && (
                      <div className="h-32 bg-gray-100 overflow-hidden">
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span>{cat.emoji}</span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 font-medium">{cat.label}</span>
                          </div>
                          <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <p className="text-lg font-bold text-amber-600">{item.cost_points}</p>
                          <p className="text-[10px] text-gray-400">pontos</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          {item.stock !== null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                              Stock: {item.stock}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleCatalogActive(item)}
                            className={`p-1.5 rounded-lg transition-colors ${item.is_active ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}
                            title={item.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {item.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => openEditCatalog(item)}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteCatalogItem(item.id)}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Apagar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Catalog Form Modal */}
          {showCatalogForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCatalogForm(false)}>
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingCatalog ? '✏️ Editar recompensa' : '➕ Nova recompensa'}
                  </h3>
                  <button onClick={() => setShowCatalogForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Título *</label>
                    <input
                      type="text"
                      value={catalogForm.title}
                      onChange={e => setCatalogForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Café grátis"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Descrição</label>
                    <textarea
                      value={catalogForm.description}
                      onChange={e => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição da recompensa..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Custo (pontos) *</label>
                      <input
                        type="number"
                        min="1"
                        value={catalogForm.cost_points}
                        onChange={e => setCatalogForm(prev => ({ ...prev, cost_points: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Categoria</label>
                      <select
                        value={catalogForm.category}
                        onChange={e => setCatalogForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                          <option key={key} value={key}>{val.emoji} {val.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Stock (vazio = ilimitado)</label>
                      <input
                        type="number"
                        min="0"
                        value={catalogForm.stock}
                        onChange={e => setCatalogForm(prev => ({ ...prev, stock: e.target.value }))}
                        placeholder="Ilimitado"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Ordem</label>
                      <input
                        type="number"
                        min="0"
                        value={catalogForm.sort_order}
                        onChange={e => setCatalogForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">URL da imagem (opcional)</label>
                    <input
                      type="text"
                      value={catalogForm.image_url}
                      onChange={e => setCatalogForm(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={catalogForm.is_active}
                      onChange={e => setCatalogForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Ativo (visível para jogadores)</span>
                  </label>
                </div>
                <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCatalogForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveCatalogItem}
                    disabled={saving || !catalogForm.title.trim()}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                  >
                    {saving ? 'A guardar...' : editingCatalog ? 'Guardar alterações' : 'Criar recompensa'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Redemptions Tab */}
      {activeTab === 'redemptions' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-3">Pedidos de resgate dos jogadores. Aprove ou cancele cada pedido.</p>
          
          {redemptions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Sem resgates</h3>
              <p className="text-sm text-gray-400">Quando os jogadores resgatarem recompensas, aparecerão aqui</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jogador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Recompensa</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Pontos</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(r.redeemed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.player_name}</td>
                      <td className="px-4 py-3 text-gray-700">{r.item_title}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{r.points_spent}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          r.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          r.status === 'used' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {r.status === 'pending' ? '⏳ Pendente' :
                           r.status === 'approved' ? '✓ Aprovado' :
                           r.status === 'used' ? '✅ Utilizado' :
                           '✗ Cancelado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.status === 'pending' && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateRedemptionStatus(r.id, 'approved')}
                              className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                              title="Aprovar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => updateRedemptionStatus(r.id, 'cancelled')}
                              className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                              title="Cancelar (reembolsar)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {r.status === 'approved' && (
                          <button
                            onClick={() => updateRedemptionStatus(r.id, 'used')}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                          >
                            Marcar utilizado
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar jogador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {players.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Sem jogadores ainda</h3>
              <p className="text-sm text-gray-400">Quando os jogadores acumularem pontos, aparecerão aqui</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Jogador</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Pontos</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {players
                    .filter(p => !searchTerm || p.player_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((p, idx) => {
                      const tierInfo = TIER_LABELS[p.tier] || TIER_LABELS.silver;
                      return (
                        <tr key={p.player_account_id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {p.player_avatar ? (
                                <img src={p.player_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">
                                  {p.player_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-gray-900">{p.player_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-amber-600">{p.total_points}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierInfo.color}`}>
                              {tierInfo.emoji} {tierInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
