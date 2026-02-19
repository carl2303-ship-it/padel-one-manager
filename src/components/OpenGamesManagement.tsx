import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Gamepad2,
  Calendar,
  Clock,
  Users,
  MapPin,
  Filter,
  RefreshCw,
  Eye,
  UserCheck,
  UserX,
  UserPlus,
  X,
  ChevronDown,
  ChevronUp,
  Trophy,
  Heart,
  AlertCircle,
  TrendingUp,
  Search,
  Trash2,
  Loader2
} from 'lucide-react';

interface OpenGame {
  id: string;
  creator_user_id: string;
  club_id: string;
  court_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  game_type: 'competitive' | 'friendly';
  gender: string;
  level_min: number | null;
  level_max: number | null;
  price_per_player: number;
  max_players: number;
  status: 'open' | 'full' | 'cancelled' | 'completed';
  notes: string | null;
  created_at: string;
  // Joined data
  court_name?: string;
  creator_name?: string;
  creator_avatar?: string | null;
  players: OpenGamePlayer[];
}

interface OpenGamePlayer {
  id: string;
  user_id: string;
  player_account_id: string | null;
  status: 'confirmed' | 'pending' | 'rejected';
  position: number | null;
  name?: string;
  avatar_url?: string | null;
  level?: number | null;
  player_category?: string | null;
}

interface OpenGamesManagementProps {
  staffClubOwnerId?: string | null;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-PT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

function getGameTypeLabel(type: string): string {
  return type === 'competitive' ? 'Competitivo' : 'Amigável';
}

function getGenderLabel(gender: string): string {
  switch (gender) {
    case 'male': return 'Masculino';
    case 'female': return 'Feminino';
    case 'mixed': return 'Misto';
    default: return 'Todos';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'open': return 'Aberto';
    case 'full': return 'Completo';
    case 'cancelled': return 'Cancelado';
    case 'completed': return 'Concluído';
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return 'bg-green-100 text-green-800';
    case 'full': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function categoryColors(category?: string | null): { bg: string; hex: string } {
  switch (category) {
    case 'M1': return { bg: 'bg-purple-600', hex: '#9333ea' };
    case 'M2': return { bg: 'bg-blue-600', hex: '#2563eb' };
    case 'M3': return { bg: 'bg-green-600', hex: '#16a34a' };
    case 'M4': return { bg: 'bg-yellow-500', hex: '#eab308' };
    case 'M5': return { bg: 'bg-orange-500', hex: '#f97316' };
    case 'M6': return { bg: 'bg-gray-500', hex: '#6b7280' };
    case 'F1': return { bg: 'bg-purple-500', hex: '#a855f7' };
    case 'F2': return { bg: 'bg-blue-500', hex: '#3b82f6' };
    case 'F3': return { bg: 'bg-green-500', hex: '#22c55e' };
    case 'F4': return { bg: 'bg-yellow-400', hex: '#facc15' };
    case 'F5': return { bg: 'bg-orange-400', hex: '#fb923c' };
    case 'F6': return { bg: 'bg-gray-400', hex: '#9ca3af' };
    default: return { bg: 'bg-gray-400', hex: '#9ca3af' };
  }
}

export default function OpenGamesManagement({ staffClubOwnerId }: OpenGamesManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;

  const [games, setGames] = useState<OpenGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'full' | 'completed' | 'cancelled'>('all');
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Add player modal state
  const [addPlayerModal, setAddPlayerModal] = useState<{ gameId: string } | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<{
    id: string;
    name: string;
    avatar_url: string | null;
    level: number | null;
    player_category: string | null;
    phone_number: string | null;
  }[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      loadGames();
    }
  }, [effectiveUserId]);

  async function loadGames() {
    if (!effectiveUserId) return;
    setLoading(true);

    try {
      // First, get the club(s) owned by this user
      const { data: clubs, error: clubsError } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('owner_id', effectiveUserId);

      if (clubsError) {
        console.error('Error fetching clubs:', clubsError);
        setLoading(false);
        return;
      }

      if (!clubs || clubs.length === 0) {
        console.log('No clubs found for user');
        setGames([]);
        setLoading(false);
        return;
      }

      const clubIds = clubs.map(c => c.id);

      // Fetch open games for these clubs
      const { data: gamesData, error: gamesError } = await supabase
        .from('open_games')
        .select('*')
        .in('club_id', clubIds)
        .order('scheduled_at', { ascending: true });

      if (gamesError) {
        console.error('Error fetching open games:', gamesError);
        setLoading(false);
        return;
      }

      if (!gamesData || gamesData.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      // Get court names
      const courtIds = [...new Set(gamesData.filter(g => g.court_id).map(g => g.court_id))];
      let courtsMap: Record<string, string> = {};
      if (courtIds.length > 0) {
        const { data: courts } = await supabase
          .from('club_courts')
          .select('id, name')
          .in('id', courtIds);
        if (courts) {
          courts.forEach(c => { courtsMap[c.id] = c.name; });
        }
      }

      // Get all game players
      const gameIds = gamesData.map(g => g.id);
      const { data: playersData } = await supabase
        .from('open_game_players')
        .select('*')
        .in('game_id', gameIds);

      // Get player details from player_accounts
      let playerDetailsMap: Record<string, { name: string; avatar_url: string | null; level: number | null; player_category: string | null }> = {};
      if (playersData && playersData.length > 0) {
        const userIds = [...new Set(playersData.map(p => p.user_id))];
        const { data: accounts } = await supabase
          .from('player_accounts')
          .select('user_id, name, avatar_url, level, player_category')
          .in('user_id', userIds);
        if (accounts) {
          accounts.forEach(a => {
            playerDetailsMap[a.user_id] = {
              name: a.name,
              avatar_url: a.avatar_url,
              level: a.level,
              player_category: a.player_category
            };
          });
        }
      }

      // Build enriched games
      const enrichedGames: OpenGame[] = gamesData.map(game => {
        const gamePlayers = (playersData || [])
          .filter(p => p.game_id === game.id)
          .map(p => {
            const details = playerDetailsMap[p.user_id];
            return {
              ...p,
              name: details?.name || 'Jogador desconhecido',
              avatar_url: details?.avatar_url || null,
              level: details?.level ?? null,
              player_category: details?.player_category || null
            };
          });

        const creator = playerDetailsMap[game.creator_user_id];

        return {
          ...game,
          court_name: game.court_id ? courtsMap[game.court_id] : undefined,
          creator_name: creator?.name || 'Desconhecido',
          creator_avatar: creator?.avatar_url || null,
          players: gamePlayers
        };
      });

      setGames(enrichedGames);
    } catch (err) {
      console.error('Unexpected error loading games:', err);
    }

    setLoading(false);
  }

  const filteredGames = games.filter(game => {
    const matchesFilter = filter === 'all' || game.status === filter;
    const matchesSearch = searchTerm.trim() === '' ||
      game.creator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.court_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.players.some(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Group games by date
  const gamesByDate: Record<string, OpenGame[]> = {};
  filteredGames.forEach(game => {
    const dateKey = new Date(game.scheduled_at).toLocaleDateString('pt-PT');
    if (!gamesByDate[dateKey]) gamesByDate[dateKey] = [];
    gamesByDate[dateKey].push(game);
  });

  const stats = {
    total: games.length,
    open: games.filter(g => g.status === 'open').length,
    full: games.filter(g => g.status === 'full').length,
    completed: games.filter(g => g.status === 'completed').length,
    pendingRequests: games.reduce((acc, g) => acc + g.players.filter(p => p.status === 'pending').length, 0)
  };

  function renderPlayerCircle(player: OpenGamePlayer, size: 'sm' | 'md' = 'sm') {
    const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
    const colors = player.player_category ? categoryColors(player.player_category) : null;
    const firstName = player.name?.split(' ')[0] || '?';

    return (
      <div key={player.id} className="flex flex-col items-center gap-0.5">
        <div className="relative">
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.name}
              className={`${sizeClasses} rounded-full object-cover border-2 ${player.status === 'pending' ? 'border-yellow-400' : player.status === 'rejected' ? 'border-red-400' : 'border-green-400'}`}
            />
          ) : (
            <div className={`${sizeClasses} rounded-full flex items-center justify-center font-bold text-white ${player.status === 'pending' ? 'bg-yellow-500' : player.status === 'rejected' ? 'bg-red-500' : 'bg-gray-700'}`}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          {player.status === 'pending' && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white" />
          )}
        </div>
        <span className="text-[10px] text-gray-600 truncate max-w-[50px]" title={player.name}>
          {firstName}
        </span>
        {player.level !== undefined && player.level !== null && (
          <span
            className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full"
            style={{ backgroundColor: colors?.hex || '#9ca3af' }}
          >
            {player.level.toFixed(1)}
          </span>
        )}
      </div>
    );
  }

  function renderEmptySlot(idx: number) {
    return (
      <div key={`empty-${idx}`} className="flex flex-col items-center gap-0.5">
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
          <span className="text-gray-400 text-sm">+</span>
        </div>
        <span className="text-[10px] text-gray-400">Vazio</span>
      </div>
    );
  }

  async function handleUpdatePlayerStatus(gameId: string, playerId: string, newStatus: 'confirmed' | 'rejected') {
    const { error } = await supabase
      .from('open_game_players')
      .update({ status: newStatus })
      .eq('id', playerId);

    if (error) {
      console.error('Error updating player status:', error);
      alert('Erro ao atualizar status do jogador');
      return;
    }

    // Check if game is now full
    const game = games.find(g => g.id === gameId);
    if (game && newStatus === 'confirmed') {
      const confirmedCount = game.players.filter(p => p.status === 'confirmed').length + 1; // +1 for this player
      if (confirmedCount >= game.max_players) {
        await supabase
          .from('open_games')
          .update({ status: 'full' })
          .eq('id', gameId);
      }
    }

    loadGames();
  }

  async function handleCancelGame(gameId: string) {
    if (!confirm('Tem a certeza que deseja cancelar este jogo?')) return;

    const { error } = await supabase
      .from('open_games')
      .update({ status: 'cancelled' })
      .eq('id', gameId);

    if (error) {
      console.error('Error cancelling game:', error);
      alert('Erro ao cancelar jogo');
      return;
    }

    // Also cancel the linked court_booking (notes contain the game ID)
    await supabase
      .from('court_bookings')
      .update({ status: 'cancelled' })
      .eq('event_type', 'open_game')
      .like('notes', `%ID: ${gameId}%`);

    loadGames();
  }

  async function handleDeleteGame(gameId: string) {
    if (!confirm('Tem a certeza que deseja ELIMINAR permanentemente este jogo? Esta ação não pode ser desfeita.')) return;

    // Delete all game players first
    const { error: playersError } = await supabase
      .from('open_game_players')
      .delete()
      .eq('game_id', gameId);

    if (playersError) {
      console.error('Error deleting game players:', playersError);
      alert('Erro ao eliminar jogadores do jogo');
      return;
    }

    // Delete the linked court_booking
    await supabase
      .from('court_bookings')
      .delete()
      .eq('event_type', 'open_game')
      .like('notes', `%ID: ${gameId}%`);

    // Delete the game
    const { error: gameError } = await supabase
      .from('open_games')
      .delete()
      .eq('id', gameId);

    if (gameError) {
      console.error('Error deleting game:', gameError);
      alert('Erro ao eliminar jogo');
      return;
    }

    loadGames();
  }

  async function handleSearchPlayers(query: string) {
    setPlayerSearchQuery(query);
    if (query.length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    setPlayerSearchLoading(true);
    const { data, error } = await supabase
      .from('player_accounts')
      .select('id, name, avatar_url, level, player_category, phone_number')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10);

    if (!error && data) {
      setPlayerSearchResults(data);
    }
    setPlayerSearchLoading(false);
  }

  async function handleAddPlayerToGame(gameId: string, playerAccountId: string) {
    setAddingPlayer(true);
    const { data, error } = await supabase.rpc('add_player_to_open_game', {
      p_game_id: gameId,
      p_player_account_id: playerAccountId,
    });

    if (error) {
      console.error('Error adding player:', error);
      alert('Erro ao adicionar jogador: ' + error.message);
      setAddingPlayer(false);
      return;
    }

    const result = data as any;
    if (!result?.success) {
      alert(result?.error || 'Erro ao adicionar jogador');
      setAddingPlayer(false);
      return;
    }

    setAddPlayerModal(null);
    setPlayerSearchQuery('');
    setPlayerSearchResults([]);
    setAddingPlayer(false);
    loadGames();
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Gamepad2 className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Jogos Abertos</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500">A carregar jogos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jogos Abertos</h1>
            <p className="text-sm text-gray-500">Jogos criados pelos jogadores na app Player</p>
          </div>
        </div>
        <button
          onClick={loadGames}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">Abertos</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500 font-medium">Completos</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.full}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium">Concluídos</span>
          </div>
          <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500 font-medium">Pedidos</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filtrar:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'open', 'full', 'completed', 'cancelled'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'Todos' : getStatusLabel(f)}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por jogador, campo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Games List */}
      {filteredGames.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Gamepad2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum jogo encontrado</h3>
          <p className="text-sm text-gray-400">
            {filter !== 'all'
              ? 'Experimente alterar os filtros para ver mais jogos.'
              : 'Os jogos criados pelos jogadores na app Player aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(gamesByDate).map(([dateKey, dateGames]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-3 mt-4">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {formatDate(dateGames[0].scheduled_at)}
                </h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {dateGames.length} jogo{dateGames.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {dateGames.map(game => {
                  const isExpanded = expandedGame === game.id;
                  const confirmedPlayers = game.players.filter(p => p.status === 'confirmed');
                  const pendingPlayers = game.players.filter(p => p.status === 'pending');
                  const emptySlots = Math.max(0, game.max_players - confirmedPlayers.length);
                  const endTime = new Date(new Date(game.scheduled_at).getTime() + game.duration_minutes * 60000);

                  return (
                    <div
                      key={game.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Game Header */}
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedGame(isExpanded ? null : game.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {/* Time */}
                              <div className="flex items-center gap-1.5 text-indigo-600">
                                <Clock className="w-4 h-4" />
                                <span className="font-bold text-lg">
                                  {formatTime(game.scheduled_at)}
                                </span>
                                <span className="text-gray-400 text-sm">-</span>
                                <span className="text-sm text-gray-500">
                                  {formatTime(endTime.toISOString())}
                                </span>
                              </div>

                              {/* Status badge */}
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(game.status)}`}>
                                {getStatusLabel(game.status)}
                              </span>

                              {/* Game type */}
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                game.game_type === 'competitive'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-green-50 text-green-700'
                              }`}>
                                {game.game_type === 'competitive' ? (
                                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {getGameTypeLabel(game.game_type)}</span>
                                ) : (
                                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {getGameTypeLabel(game.game_type)}</span>
                                )}
                              </span>

                              {/* Gender */}
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                {getGenderLabel(game.gender)}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {game.court_name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {game.court_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {confirmedPlayers.length}/{game.max_players} jogadores
                              </span>
                              {game.level_min !== null && game.level_max !== null && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  Nível {game.level_min?.toFixed(1)} - {game.level_max?.toFixed(1)}
                                </span>
                              )}
                              {game.price_per_player > 0 && (
                                <span className="font-medium text-gray-700">
                                  €{game.price_per_player.toFixed(2)}/jogador
                                </span>
                              )}
                            </div>

                            {/* Creator info */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-400">Criado por:</span>
                              <div className="flex items-center gap-1.5">
                                {game.creator_avatar ? (
                                  <img src={game.creator_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                                    {game.creator_name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                )}
                                <span className="text-xs font-medium text-gray-600">{game.creator_name}</span>
                              </div>
                            </div>
                          </div>

                          {/* Player circles (compact view) */}
                          <div className="flex items-center gap-1.5 ml-4">
                            {confirmedPlayers.slice(0, 4).map(p => renderPlayerCircle(p))}
                            {Array.from({ length: Math.min(emptySlots, 4 - confirmedPlayers.slice(0, 4).length) }).map((_, i) => renderEmptySlot(i))}
                            {pendingPlayers.length > 0 && (
                              <div className="ml-2 flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                                <AlertCircle className="w-3 h-3 text-yellow-500" />
                                <span className="text-xs font-medium text-yellow-700">
                                  {pendingPlayers.length} pedido{pendingPlayers.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="ml-3">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Confirmed Players */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-green-500" />
                                Jogadores Confirmados ({confirmedPlayers.length}/{game.max_players})
                              </h4>
                              {confirmedPlayers.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Nenhum jogador confirmado</p>
                              ) : (
                                <div className="space-y-2">
                                  {confirmedPlayers.map(player => (
                                    <div key={player.id} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-100">
                                      {player.avatar_url ? (
                                        <img src={player.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">
                                          {player.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{player.name}</p>
                                        <div className="flex items-center gap-2">
                                          {player.level !== null && player.level !== undefined && (
                                            <span
                                              className="text-[10px] font-bold text-white px-1.5 py-0 rounded-full"
                                              style={{ backgroundColor: categoryColors(player.player_category).hex }}
                                            >
                                              Nv. {player.level.toFixed(1)}
                                            </span>
                                          )}
                                          {player.player_category && (
                                            <span className="text-[10px] text-gray-400">{player.player_category}</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                                        Confirmado
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Pending Requests */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-500" />
                                Pedidos Pendentes ({pendingPlayers.length})
                              </h4>
                              {pendingPlayers.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Sem pedidos pendentes</p>
                              ) : (
                                <div className="space-y-2">
                                  {pendingPlayers.map(player => (
                                    <div key={player.id} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-yellow-200">
                                      {player.avatar_url ? (
                                        <img src={player.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-yellow-300" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">
                                          {player.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{player.name}</p>
                                        <div className="flex items-center gap-2">
                                          {player.level !== null && player.level !== undefined && (
                                            <span
                                              className="text-[10px] font-bold text-white px-1.5 py-0 rounded-full"
                                              style={{ backgroundColor: categoryColors(player.player_category).hex }}
                                            >
                                              Nv. {player.level.toFixed(1)}
                                            </span>
                                          )}
                                          {player.player_category && (
                                            <span className="text-[10px] text-gray-400">{player.player_category}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleUpdatePlayerStatus(game.id, player.id, 'confirmed'); }}
                                          className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                          title="Aceitar"
                                        >
                                          <UserCheck className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleUpdatePlayerStatus(game.id, player.id, 'rejected'); }}
                                          className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                          title="Rejeitar"
                                        >
                                          <UserX className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Notes & Actions */}
                          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                            <div>
                              {game.notes && (
                                <p className="text-sm text-gray-500 italic">
                                  <span className="font-medium">Notas:</span> {game.notes}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                Criado em {formatDateTime(game.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {(game.status === 'open') && confirmedPlayers.length < game.max_players && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddPlayerModal({ gameId: game.id });
                                    setPlayerSearchQuery('');
                                    setPlayerSearchResults([]);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Adicionar jogador
                                </button>
                              )}
                              {game.status === 'open' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCancelGame(game.id); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                  Cancelar jogo
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteGame(game.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                                title="Eliminar permanentemente"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Player Modal */}
      {addPlayerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddPlayerModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  Adicionar Jogador
                </h3>
                <button onClick={() => setAddPlayerModal(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Pesquise e adicione um jogador ao jogo</p>
            </div>

            <div className="p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nome do jogador..."
                  value={playerSearchQuery}
                  onChange={(e) => handleSearchPlayers(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
                {playerSearchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>

              <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
                {playerSearchQuery.length >= 2 && playerSearchResults.length === 0 && !playerSearchLoading && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum jogador encontrado</p>
                )}
                {playerSearchResults.map(p => {
                  const pColors = categoryColors(p.player_category);
                  // Check if player is already in game
                  const gameData = games.find(g => g.id === addPlayerModal.gameId);
                  const alreadyInGame = gameData?.players.some(gp => gp.player_account_id === p.id);

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                        alreadyInGame ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!alreadyInGame && !addingPlayer) {
                          handleAddPlayerToGame(addPlayerModal.gameId, p.id);
                        }
                      }}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5">
                          {p.level != null && (
                            <span className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full" style={{ backgroundColor: pColors.hex }}>
                              {p.level.toFixed(1)}
                            </span>
                          )}
                          {p.player_category && <span className="text-[10px] text-gray-400">{p.player_category}</span>}
                          {p.phone_number && <span className="text-[10px] text-gray-400 ml-1">{p.phone_number}</span>}
                        </div>
                      </div>
                      {alreadyInGame ? (
                        <span className="text-[10px] text-gray-400 font-medium">Já no jogo</span>
                      ) : addingPlayer ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 text-indigo-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
