import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Calendar,
  List,
  Plus,
  X,
  Clock,
  MapPin,
  Phone,
  User,
  ChevronLeft,
  ChevronRight,
  Check,
  Edit2,
  Trash2,
  Award,
  Users,
  Trophy,
  Heart,
  AlertCircle,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface Court {
  id: string;
  name: string;
  type: string;
  hourly_rate: number;
  peak_rate: number;
}

interface Booking {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  booked_by_name: string | null;
  booked_by_phone: string | null;
  player1_name: string | null;
  player2_name: string | null;
  player3_name: string | null;
  player4_name: string | null;
  player1_phone: string | null;
  player2_phone: string | null;
  player3_phone: string | null;
  player4_phone: string | null;
  player1_is_member: boolean;
  player2_is_member: boolean;
  player3_is_member: boolean;
  player4_is_member: boolean;
  player1_discount: number;
  player2_discount: number;
  player3_discount: number;
  player4_discount: number;
  status: string;
  price: number;
  payment_status: string;
  notes: string | null;
  event_type: string;
  court?: Court;
}

interface MemberMatch {
  id: string;
  member_name: string;
  member_phone: string;
  discount_percent: number;
  plan_name: string;
}

interface PlayerData {
  name: string;
  phone: string;
  isMember: boolean;
  discount: number;
  planName: string;
}

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
  payment_status?: 'pending' | 'paid';
  name?: string;
  avatar_url?: string | null;
  level?: number | null;
  player_category?: string | null;
  phone_number?: string | null;
  is_member?: boolean;
  discount_percent?: number;
  price?: number;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

// Helper functions for Open Games
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

function formatGameTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
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

function getGameStatusLabel(status: string): string {
  switch (status) {
    case 'open': return 'Aberto';
    case 'full': return 'Completo';
    case 'cancelled': return 'Cancelado';
    case 'completed': return 'Concluído';
    default: return status;
  }
}

function getGameStatusColor(status: string): string {
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

const eventTypeColors: Record<string, { bg: string; bgHover: string; bgDragging: string; text: string; textSecondary: string }> = {
  match: {
    bg: 'bg-blue-100',
    bgHover: 'hover:bg-blue-200',
    bgDragging: 'bg-blue-200',
    text: 'text-blue-900',
    textSecondary: 'text-blue-700'
  },
  tournament: {
    bg: 'bg-amber-100',
    bgHover: 'hover:bg-amber-200',
    bgDragging: 'bg-amber-200',
    text: 'text-amber-900',
    textSecondary: 'text-amber-700'
  },
  training: {
    bg: 'bg-emerald-100',
    bgHover: 'hover:bg-emerald-200',
    bgDragging: 'bg-emerald-200',
    text: 'text-emerald-900',
    textSecondary: 'text-emerald-700'
  },
  event: {
    bg: 'bg-rose-100',
    bgHover: 'hover:bg-rose-200',
    bgDragging: 'bg-rose-200',
    text: 'text-rose-900',
    textSecondary: 'text-rose-700'
  },
  maintenance: {
    bg: 'bg-gray-200',
    bgHover: 'hover:bg-gray-300',
    bgDragging: 'bg-gray-300',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600'
  },
  open_game: {
    bg: 'bg-indigo-100',
    bgHover: 'hover:bg-indigo-200',
    bgDragging: 'bg-indigo-200',
    text: 'text-indigo-900',
    textSecondary: 'text-indigo-700'
  }
};

const getEventColors = (eventType: string) => {
  return eventTypeColors[eventType] || eventTypeColors.match;
};

interface CourtBookingsProps {
  staffClubOwnerId?: string | null;
}

export default function CourtBookings({ staffClubOwnerId }: CourtBookingsProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string; hour: number } | null>(null);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [searchingPlayer, setSearchingPlayer] = useState<number | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ courtId: string; time: string } | null>(null);
  const [openGamePlayers, setOpenGamePlayers] = useState<{ [bookingId: string]: any[] }>({});
  const [selectedOpenGame, setSelectedOpenGame] = useState<OpenGame | null>(null);

  const emptyPlayer: PlayerData = { name: '', phone: '', isMember: false, discount: 0, planName: '' };
  const [players, setPlayers] = useState<PlayerData[]>([
    { ...emptyPlayer },
    { ...emptyPlayer },
    { ...emptyPlayer },
    { ...emptyPlayer }
  ]);

  const [newBooking, setNewBooking] = useState({
    court_id: '',
    date: '',
    startTime: '09:00',
    duration: 1.5,
    notes: '',
    payment_status: 'pending',
    event_type: 'match'
  });

  const [operatingHours, setOperatingHours] = useState({ start: '08:00', end: '22:00' });

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId, selectedDate]);

  const loadData = async () => {
    if (!effectiveUserId) return;

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [courtsResult, bookingsResult, settingsResult, clubResult] = await Promise.all([
      supabase
        .from('club_courts')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
      supabase
        .from('court_bookings')
        .select(`
          *,
          court:club_courts(*)
        `)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .order('start_time'),
      supabase
        .from('user_logo_settings')
        .select('booking_start_time, booking_end_time')
        .eq('user_id', effectiveUserId)
        .maybeSingle(),
      supabase
        .from('clubs')
        .select('id')
        .eq('owner_id', effectiveUserId)
        .maybeSingle()
    ]);

    if (courtsResult.data) {
      setCourts(courtsResult.data);
    }

    if (bookingsResult.data) {
      const filteredBookings = bookingsResult.data.filter(
        (b: any) => b.court?.user_id === effectiveUserId
      );
      setBookings(filteredBookings as Booking[]);
      
      // Load players for open_game bookings
      const openGameBookings = filteredBookings.filter((b: any) => b.event_type === 'open_game');
      if (openGameBookings.length > 0) {
        const playersMap: { [bookingId: string]: any[] } = {};
        
        for (const booking of openGameBookings) {
          // Extract open_game ID from notes
          const idMatch = booking.notes?.match(/ID:\s*([0-9a-f-]+)/i);
          if (idMatch?.[1]) {
            const { data: players } = await supabase
              .from('open_game_players')
              .select(`
                player_account_id,
                player_name,
                player_phone,
                player_accounts(name, phone_number, level, category)
              `)
              .eq('game_id', idMatch[1]);
            
            if (players) {
              playersMap[booking.id] = players;
            }
          }
        }
        
        setOpenGamePlayers(playersMap);
      }
    }

    if (settingsResult.data) {
      setOperatingHours({
        start: settingsResult.data.booking_start_time || '08:00',
        end: settingsResult.data.booking_end_time || '22:00'
      });
    }

    setLoading(false);
  };

  const searchMemberForPlayer = async (playerIndex: number, name: string, phone: string) => {
    if (!effectiveUserId) return;
    if ((!name || name.length < 2) && (!phone || phone.length < 6)) {
      const newPlayers = [...players];
      newPlayers[playerIndex] = { ...newPlayers[playerIndex], isMember: false, discount: 0, planName: '' };
      setPlayers(newPlayers);
      return;
    }

    setSearchingPlayer(playerIndex);
    const normalizedPhone = phone ? normalizePhone(phone) : '';

    let query = supabase
      .from('member_subscriptions')
      .select(`
        id,
        member_name,
        member_phone,
        plan:membership_plans(name, court_discount_percent)
      `)
      .eq('club_owner_id', effectiveUserId)
      .eq('status', 'active');

    if (normalizedPhone && normalizedPhone.length >= 6) {
      query = query.or(`member_phone.ilike.%${normalizedPhone}%,member_phone.ilike.%${phone}%`);
    } else if (name && name.length >= 2) {
      query = query.ilike('member_name', `%${name}%`);
    }

    const { data } = await query.limit(1).maybeSingle();

    const newPlayers = [...players];
    if (data && data.plan) {
      newPlayers[playerIndex] = {
        name: data.member_name || name,
        phone: data.member_phone || phone,
        isMember: true,
        discount: (data.plan as any).court_discount_percent || 0,
        planName: (data.plan as any).name || ''
      };
    } else {
      newPlayers[playerIndex] = { ...newPlayers[playerIndex], isMember: false, discount: 0, planName: '' };
    }
    setPlayers(newPlayers);
    setSearchingPlayer(null);
  };

  const handlePlayerNameChange = (playerIndex: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[playerIndex] = { ...newPlayers[playerIndex], name };
    setPlayers(newPlayers);
    if (name.length >= 2) {
      searchMemberForPlayer(playerIndex, name, players[playerIndex].phone);
    }
  };

  const handlePlayerPhoneChange = (playerIndex: number, phone: string) => {
    const newPlayers = [...players];
    newPlayers[playerIndex] = { ...newPlayers[playerIndex], phone };
    setPlayers(newPlayers);
    if (phone.length >= 6) {
      searchMemberForPlayer(playerIndex, players[playerIndex].name, phone);
    }
  };

  const getBasePrice = () => {
    const court = courts.find(c => c.id === newBooking.court_id);
    if (!court) return 0;
    return newBooking.duration * court.hourly_rate;
  };

  const getPriceBreakdown = () => {
    const basePrice = getBasePrice();
    const pricePerPlayer = basePrice / 4;
    let totalDiscount = 0;

    const breakdown = players.map((player, idx) => {
      if (player.isMember && player.discount > 0) {
        const playerDiscount = pricePerPlayer * (player.discount / 100);
        totalDiscount += playerDiscount;
        return {
          playerNum: idx + 1,
          name: player.name || `Player ${idx + 1}`,
          originalPrice: pricePerPlayer,
          discount: playerDiscount,
          finalPrice: pricePerPlayer - playerDiscount,
          isMember: true,
          discountPercent: player.discount
        };
      }
      return {
        playerNum: idx + 1,
        name: player.name || `Player ${idx + 1}`,
        originalPrice: pricePerPlayer,
        discount: 0,
        finalPrice: pricePerPlayer,
        isMember: false,
        discountPercent: 0
      };
    });

    return {
      basePrice,
      totalDiscount,
      finalPrice: basePrice - totalDiscount,
      breakdown
    };
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !newBooking.court_id) return;

    const court = courts.find(c => c.id === newBooking.court_id);
    if (!court) return;

    const [hours, minutes] = newBooking.startTime.split(':').map(Number);
    const startTime = new Date(newBooking.date);
    startTime.setHours(hours, minutes, 0, 0);
    const endTime = new Date(startTime);
    const durationMinutes = newBooking.duration * 60;
    endTime.setMinutes(startTime.getMinutes() + durationMinutes);

    const pricing = getPriceBreakdown();

    const bookingData = {
      court_id: newBooking.court_id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      booked_by_name: players[0].name || null,
      booked_by_phone: players[0].phone || null,
      player1_name: players[0].name || null,
      player1_phone: players[0].phone || null,
      player1_is_member: players[0].isMember,
      player1_discount: players[0].discount,
      player2_name: players[1].name || null,
      player2_phone: players[1].phone || null,
      player2_is_member: players[1].isMember,
      player2_discount: players[1].discount,
      player3_name: players[2].name || null,
      player3_phone: players[2].phone || null,
      player3_is_member: players[2].isMember,
      player3_discount: players[2].discount,
      player4_name: players[3].name || null,
      player4_phone: players[3].phone || null,
      player4_is_member: players[3].isMember,
      player4_discount: players[3].discount,
      notes: newBooking.notes || null,
      price: pricing.finalPrice,
      payment_status: newBooking.payment_status,
      event_type: newBooking.event_type
    };

    if (editingBooking) {
      const { error } = await supabase
        .from('court_bookings')
        .update(bookingData)
        .eq('id', editingBooking.id);

      if (!error) {
        setShowNewBooking(false);
        setEditingBooking(null);
        resetBookingForm();
        loadData();
      }
    } else {
      const { error } = await supabase
        .from('court_bookings')
        .insert({
          ...bookingData,
          user_id: effectiveUserId,
          status: 'confirmed'
        });

      if (!error) {
        setShowNewBooking(false);
        resetBookingForm();
        loadData();
      }
    }
  };

  const loadOpenGameDetails = async (gameId: string) => {
    if (!effectiveUserId) return;

    try {
      // Fetch the open game
      const { data: gameData, error: gameError } = await supabase
        .from('open_games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !gameData) {
        console.error('Error fetching open game:', gameError);
        return;
      }

      // Get court name
      let courtName = '';
      if (gameData.court_id) {
        const { data: court } = await supabase
          .from('club_courts')
          .select('name')
          .eq('id', gameData.court_id)
          .single();
        if (court) courtName = court.name;
      }

      // Get all game players
      const { data: playersData } = await supabase
        .from('open_game_players')
        .select('*')
        .eq('game_id', gameId);

      // Get player details from player_accounts
      let playerDetailsMap: Record<string, { name: string; avatar_url: string | null; level: number | null; player_category: string | null; phone_number: string | null }> = {};
      if (playersData && playersData.length > 0) {
        const userIds = [...new Set(playersData.map(p => p.user_id))];
        const { data: accounts } = await supabase
          .from('player_accounts')
          .select('user_id, name, avatar_url, level, player_category, phone_number')
          .in('user_id', userIds);
        if (accounts) {
          accounts.forEach(a => {
            playerDetailsMap[a.user_id] = {
              name: a.name,
              avatar_url: a.avatar_url,
              level: a.level,
              player_category: a.player_category,
              phone_number: a.phone_number
            };
          });
        }
      }

      // Get creator details
      const creatorDetails = playerDetailsMap[gameData.creator_user_id];

      // Check which players are club members
      const playerPhones = Object.values(playerDetailsMap)
        .map(p => p.phone_number)
        .filter(Boolean)
        .map(normalizePhone);
      
      let memberDiscountsMap: Record<string, number> = {};
      if (playerPhones.length > 0) {
        const { data: members } = await supabase
          .from('member_subscriptions')
          .select(`
            member_phone,
            plan:membership_plans(court_discount_percent)
          `)
          .eq('club_owner_id', effectiveUserId)
          .eq('status', 'active')
          .in('member_phone', playerPhones);
        
        if (members) {
          members.forEach((m: any) => {
            if (m.member_phone && m.plan) {
              memberDiscountsMap[normalizePhone(m.member_phone)] = m.plan.court_discount_percent || 0;
            }
          });
        }
      }

      // Map players with details, member status, and calculate prices
      const basePrice = gameData.price_per_player || 0;
      const players: OpenGamePlayer[] = (playersData || []).map(p => {
        const playerDetails = playerDetailsMap[p.user_id];
        const playerPhone = playerDetails?.phone_number ? normalizePhone(playerDetails.phone_number) : null;
        const isMember = playerPhone ? memberDiscountsMap.hasOwnProperty(playerPhone) : false;
        const discountPercent = isMember && playerPhone ? memberDiscountsMap[playerPhone] : 0;
        const finalPrice = basePrice - (basePrice * discountPercent / 100);
        
        return {
          ...p,
          name: playerDetails?.name || 'Jogador',
          avatar_url: playerDetails?.avatar_url,
          level: playerDetails?.level,
          player_category: playerDetails?.player_category,
          phone_number: playerDetails?.phone_number,
          is_member: isMember,
          discount_percent: discountPercent,
          price: finalPrice
        };
      });

      const openGame: OpenGame = {
        ...gameData,
        court_name: courtName,
        creator_name: creatorDetails?.name || 'Desconhecido',
        creator_avatar: creatorDetails?.avatar_url,
        players
      };

      setSelectedOpenGame(openGame);
    } catch (error) {
      console.error('Error loading open game details:', error);
    }
  };

  const handleCancelOpenGame = async (gameId: string) => {
    if (!confirm('Cancelar este jogo? Todos os jogadores serão notificados.')) {
      return;
    }

    const { error } = await supabase
      .from('open_games')
      .update({ status: 'cancelled' })
      .eq('id', gameId);

    if (!error) {
      // Also cancel the court booking
      const { data: bookings } = await supabase
        .from('court_bookings')
        .select('id')
        .eq('event_type', 'open_game')
        .ilike('notes', `%ID: ${gameId}%`);
      
      if (bookings && bookings.length > 0) {
        await supabase
          .from('court_bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookings[0].id);
      }

      setSelectedOpenGame(null);
      loadData();
    }
  };

  const handleDeleteOpenGame = async (gameId: string) => {
    if (!confirm('Eliminar este jogo permanentemente? Esta ação não pode ser revertida.')) {
      return;
    }

    // Delete the court booking first
    const { data: bookings } = await supabase
      .from('court_bookings')
      .select('id')
      .eq('event_type', 'open_game')
      .ilike('notes', `%ID: ${gameId}%`);
    
    if (bookings && bookings.length > 0) {
      await supabase
        .from('court_bookings')
        .delete()
        .eq('id', bookings[0].id);
    }

    // Delete the open game (players will be deleted automatically due to CASCADE)
    const { error } = await supabase
      .from('open_games')
      .delete()
      .eq('id', gameId);

    if (!error) {
      setSelectedOpenGame(null);
      loadData();
    }
  };

  const handleTogglePlayerPayment = async (playerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    
    // Update payment status
    const { error } = await supabase
      .from('open_game_players')
      .update({ payment_status: newStatus })
      .eq('id', playerId);

    if (!error && selectedOpenGame) {
      const player = selectedOpenGame.players.find(p => p.id === playerId);
      if (player) {
        const normalizedPhone = player.phone?.replace(/\s+/g, '').startsWith('+')
          ? player.phone.replace(/\s+/g, '')
          : '+' + player.phone?.replace(/\s+/g, '');

        // 1. Create or update player_account
        const { data: existingAccount } = await supabase
          .from('player_accounts')
          .select('id, user_id')
          .eq('phone_number', normalizedPhone)
          .maybeSingle();

        let playerAccountId = existingAccount?.id;

        if (!existingAccount) {
          // Create new player account
          const { data: newAccount } = await supabase
            .from('player_accounts')
            .insert({
              phone_number: normalizedPhone,
              name: player.name,
              level: player.level,
              player_category: player.category
            })
            .select('id')
            .single();
          
          playerAccountId = newAccount?.id;
        }

        if (newStatus === 'paid') {
          // 2. Create player_transaction with correct individual price
          await supabase
            .from('player_transactions')
            .insert({
              club_owner_id: user?.id,
              player_account_id: playerAccountId,
              player_name: player.name,
              player_phone: normalizedPhone,
              transaction_type: 'open_game',
              amount: player.finalPrice,
              reference_id: selectedOpenGame.id,
              reference_type: 'open_game',
              notes: `Jogo Aberto: ${selectedOpenGame.gameTypeName} - ${selectedOpenGame.courtName}`
            });
        } else {
          // 3. Remove transaction when payment is cancelled
          await supabase
            .from('player_transactions')
            .delete()
            .eq('reference_id', selectedOpenGame.id)
            .eq('reference_type', 'open_game')
            .eq('player_name', player.name);
        }
      }

      // Reload the game details to refresh
      await loadOpenGameDetails(selectedOpenGame.id);
    }
  };

  const handleEditBooking = async (booking: Booking) => {
    // Se for open_game, mostrar modal dedicado
    if (booking.event_type === 'open_game') {
      const idMatch = booking.notes?.match(/ID:\s*([0-9a-f-]+)/i);
      if (idMatch?.[1]) {
        await loadOpenGameDetails(idMatch[1]);
        return;
      }
    }
    
    // Fluxo normal para outros tipos
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    const duration = (endDate.getTime() - startDate.getTime()) / 3600000;
    const startTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;

    setEditingBooking(booking);
    setNewBooking({
      court_id: booking.court_id,
      date: startDate.toISOString().split('T')[0],
      startTime: startTimeStr,
      duration,
      notes: booking.notes || '',
      payment_status: booking.payment_status,
      event_type: booking.event_type || 'match'
    });

    setPlayers([
      {
        name: booking.player1_name || booking.booked_by_name || '',
        phone: booking.player1_phone || booking.booked_by_phone || '',
        isMember: booking.player1_is_member || false,
        discount: booking.player1_discount || 0,
        planName: ''
      },
      {
        name: booking.player2_name || '',
        phone: booking.player2_phone || '',
        isMember: booking.player2_is_member || false,
        discount: booking.player2_discount || 0,
        planName: ''
      },
      {
        name: booking.player3_name || '',
        phone: booking.player3_phone || '',
        isMember: booking.player3_is_member || false,
        discount: booking.player3_discount || 0,
        planName: ''
      },
      {
        name: booking.player4_name || '',
        phone: booking.player4_phone || '',
        isMember: booking.player4_is_member || false,
        discount: booking.player4_discount || 0,
        planName: ''
      }
    ]);

    setShowNewBooking(true);
  };

  const resetBookingForm = () => {
    setNewBooking({
      court_id: '',
      date: '',
      startTime: operatingHours.start,
      duration: 1.5,
      notes: '',
      payment_status: 'pending',
      event_type: 'match'
    });
    setPlayers([
      { ...emptyPlayer },
      { ...emptyPlayer },
      { ...emptyPlayer },
      { ...emptyPlayer }
    ]);
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const [startHour, startMin] = operatingHours.start.split(':').map(Number);
    const [endHour, endMin] = operatingHours.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let m = startMinutes; m < endMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleDragStart = (booking: Booking) => {
    setDraggingBooking(booking);
  };

  const handleDragOver = (e: React.DragEvent, courtId: string, time: string) => {
    e.preventDefault();
    setDragOverSlot({ courtId, time });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, courtId: string, time: string) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggingBooking) return;

    const isBooked = isSlotBooked(courtId, time);
    if (isBooked && draggingBooking.court_id !== courtId) return;

    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    const oldStart = new Date(draggingBooking.start_time);
    const oldEnd = new Date(draggingBooking.end_time);
    const duration = (oldEnd.getTime() - oldStart.getTime()) / 60000;

    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + duration);

    const { error } = await supabase
      .from('court_bookings')
      .update({
        court_id: courtId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      })
      .eq('id', draggingBooking.id);

    if (!error) {
      loadData();
    }

    setDraggingBooking(null);
  };

  const handleCancelBooking = async (bookingId: string) => {
    // First, get the booking to check if it's an open_game
    const { data: booking } = await supabase
      .from('court_bookings')
      .select('id, event_type, notes')
      .eq('id', bookingId)
      .single();

    const { error } = await supabase
      .from('court_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (!error) {
      // If this is an open_game booking, also cancel the linked open_game
      if (booking?.event_type === 'open_game' && booking?.notes) {
        const idMatch = booking.notes.match(/ID:\s*([0-9a-f-]+)/i);
        if (idMatch?.[1]) {
          await supabase
            .from('open_games')
            .update({ status: 'cancelled' })
            .eq('id', idMatch[1]);
        }
      }
      loadData();
    }
  };

  const handleSlotClick = (courtId: string, slotTime: string) => {
    const isBooked = isSlotBooked(courtId, slotTime);

    if (!isBooked) {
      setSelectedSlot({ courtId, hour: 0 });
      const dateStr = selectedDate.toISOString().split('T')[0];
      setNewBooking({
        ...newBooking,
        court_id: courtId,
        date: dateStr,
        startTime: slotTime
      });
      setShowNewBooking(true);
    }
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const generateCalendarSlots = () => {
    const slots: { time: string; label: string }[] = [];
    const [startH, startM] = operatingHours.start.split(':').map(Number);
    const [endH, endM] = operatingHours.end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    for (let m = startMin; m < endMin; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const time = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({ time, label: time });
    }
    return slots;
  };

  const calendarSlots = generateCalendarSlots();

  const getBookingForSlot = (courtId: string, slotTime: string): Booking | null => {
    const [slotH, slotM] = slotTime.split(':').map(Number);
    const slotMinutes = slotH * 60 + slotM;

    return bookings.find(b => {
      if (b.court_id !== courtId) return false;

      const bookingStart = new Date(b.start_time);
      const startMinutes = bookingStart.getHours() * 60 + bookingStart.getMinutes();

      return startMinutes >= slotMinutes && startMinutes < slotMinutes + 30;
    }) || null;
  };

  const isSlotBooked = (courtId: string, slotTime: string): boolean => {
    const [slotH, slotM] = slotTime.split(':').map(Number);
    const slotMinutes = slotH * 60 + slotM;

    return bookings.some(b => {
      const bookingStart = new Date(b.start_time);
      const bookingEnd = new Date(b.end_time);
      const startMinutes = bookingStart.getHours() * 60 + bookingStart.getMinutes();
      const endMinutes = bookingEnd.getHours() * 60 + bookingEnd.getMinutes();
      return b.court_id === courtId && slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.bookings.title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              {t.bookings.calendar}
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4 inline mr-1" />
              {t.bookings.list}
            </button>
          </div>
          <button
            onClick={() => {
              setEditingBooking(null);
              resetBookingForm();
              setNewBooking({
                ...newBooking,
                date: selectedDate.toISOString().split('T')[0]
              });
              setShowNewBooking(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.bookings.newBooking}
          </button>
        </div>
      </div>

      {courts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t.courts.noCourts}</h3>
          <p className="text-gray-500">{t.courts.addFirst}</p>
        </div>
      ) : view === 'calendar' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Date Navigation */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{formatDate(selectedDate)}</h2>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t.bookings.today}
              </button>
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Court Headers */}
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(${courts.length}, 1fr)` }}>
                <div className="p-3 bg-gray-50 border-b border-r border-gray-100"></div>
                {courts.map(court => (
                  <div key={court.id} className="p-3 bg-gray-50 border-b border-r border-gray-100 text-center">
                    <div className="font-medium text-gray-900">{court.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{t.courts[court.type as keyof typeof t.courts] || court.type}</div>
                  </div>
                ))}
              </div>

              {/* Time Slots - Single Grid */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `80px repeat(${courts.length}, 1fr)`,
                  gridTemplateRows: `repeat(${calendarSlots.length}, minmax(60px, auto))`
                }}
              >
                {calendarSlots.map((slot, slotIndex) => (
                  <>
                    {/* Time Label */}
                    <div
                      key={`time-${slot.time}`}
                      className="p-2 border-b border-r border-gray-100 text-xs text-gray-500 text-center flex items-center justify-center"
                      style={{ gridRow: slotIndex + 1, gridColumn: 1 }}
                    >
                      {slot.label}
                    </div>

                    {/* Court Slots */}
                    {courts.map((court, courtIndex) => {
                      const booking = getBookingForSlot(court.id, slot.time);
                      const booked = isSlotBooked(court.id, slot.time);

                      if (booking) {
                        const durationSlots = Math.round((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 1800000);
                        const isDragging = draggingBooking?.id === booking.id;
                        const colors = getEventColors(booking.event_type);
                        return (
                          <div
                            key={`${court.id}-${slot.time}`}
                            className="border-b border-r border-gray-100 p-1"
                            style={{
                              gridRow: `${slotIndex + 1} / span ${durationSlots}`,
                              gridColumn: courtIndex + 2
                            }}
                          >
                            <div
                              draggable
                              onDragStart={() => handleDragStart(booking)}
                              onDragEnd={() => setDraggingBooking(null)}
                              onClick={() => handleEditBooking(booking)}
                              className={`h-full w-full rounded-lg p-2 text-xs text-left transition group cursor-move ${
                                isDragging ? `opacity-50 ${colors.bgDragging}` : `${colors.bg} ${colors.bgHover}`
                              }`}
                            >
                              {booking.event_type === 'open_game' ? (
                                // Open Game Layout
                                <div className="flex flex-col h-full gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">🎾</span>
                                    <span className={`font-semibold ${colors.text} text-[10px] leading-tight`}>
                                      Jogo Aberto
                                    </span>
                                  </div>
                                  {openGamePlayers[booking.id] && openGamePlayers[booking.id].length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                                      {openGamePlayers[booking.id].map((p: any, idx: number) => (
                                        <div
                                          key={idx}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colors.text} bg-white/60 truncate max-w-full`}
                                          title={p.player_name || p.player_accounts?.name || 'Jogador'}
                                        >
                                          {(p.player_name || p.player_accounts?.name || 'Jogador').split(' ')[0]}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-auto flex items-center justify-between">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                      booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {t.bookings[booking.payment_status as keyof typeof t.bookings] || booking.payment_status}
                                    </span>
                                    <Edit2 className={`w-3 h-3 ${colors.textSecondary} opacity-0 group-hover:opacity-100 transition flex-shrink-0`} />
                                  </div>
                                </div>
                              ) : (
                                // Regular Booking Layout
                                <>
                                  <div className="flex items-start justify-between">
                                    <div className={`font-medium ${colors.text} truncate flex-1`}>
                                      {booking.event_type === 'tournament'
                                        ? (booking.booked_by_name || 'Tournament')
                                        : booking.event_type === 'match'
                                        ? (booking.booked_by_name || 'Guest')
                                        : (t.bookings?.[booking.event_type as keyof typeof t.bookings] || booking.event_type)
                                      }
                                    </div>
                                    <Edit2 className={`w-3 h-3 ${colors.textSecondary} opacity-0 group-hover:opacity-100 transition flex-shrink-0`} />
                                  </div>
                                  {booking.event_type === 'match' && booking.booked_by_phone && (
                                    <div className={`${colors.textSecondary} truncate`}>{booking.booked_by_phone}</div>
                                  )}
                                  {booking.notes && booking.event_type !== 'match' && (
                                    <div className={`${colors.textSecondary} truncate text-xs`}>{booking.notes}</div>
                                  )}
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {t.bookings[booking.payment_status as keyof typeof t.bookings] || booking.payment_status}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (booked) {
                        const isDropTarget = dragOverSlot?.courtId === court.id && dragOverSlot?.time === slot.time;
                        return (
                          <div
                            key={`${court.id}-${slot.time}`}
                            onDragOver={(e) => handleDragOver(e, court.id, slot.time)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, court.id, slot.time)}
                            className={`border-b border-r border-gray-100 ${isDropTarget ? 'bg-blue-100' : ''}`}
                            style={{
                              gridRow: slotIndex + 1,
                              gridColumn: courtIndex + 2
                            }}
                          ></div>
                        );
                      }

                      const isDropTarget = dragOverSlot?.courtId === court.id && dragOverSlot?.time === slot.time;
                      return (
                        <div
                          key={`${court.id}-${slot.time}`}
                          onDragOver={(e) => handleDragOver(e, court.id, slot.time)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, court.id, slot.time)}
                          onClick={() => handleSlotClick(court.id, slot.time)}
                          className={`border-b border-r border-gray-100 transition cursor-pointer ${
                            isDropTarget ? 'bg-blue-100' : 'hover:bg-green-50'
                          }`}
                          style={{
                            gridRow: slotIndex + 1,
                            gridColumn: courtIndex + 2
                          }}
                        ></div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-wrap gap-4 justify-center text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                <span className="text-gray-600">{t.bookings?.match || 'Match'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
                <span className="text-gray-600">{t.bookings?.tournament || 'Tournament'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
                <span className="text-gray-600">{t.bookings?.training || 'Training'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-rose-100 border border-rose-200"></div>
                <span className="text-gray-600">{t.bookings?.event || 'Event'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-200 border border-gray-300"></div>
                <span className="text-gray-600">{t.bookings?.maintenance || 'Maintenance'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t.bookings.allBookings}</h2>
          </div>
          {bookings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t.bookings.noBookings}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {bookings.map(booking => {
                const colors = getEventColors(booking.event_type);
                return (
                <div key={booking.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 ${colors.bg} rounded-lg`}>
                      <MapPin className={`w-5 h-5 ${colors.textSecondary}`} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {booking.court?.name}
                        <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                          {booking.event_type === 'tournament'
                            ? (booking.booked_by_name || 'Tournament')
                            : booking.event_type === 'open_game'
                            ? `🎮 Jogo Aberto`
                            : (t.bookings?.[booking.event_type as keyof typeof t.bookings] || booking.event_type)
                          }
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {booking.booked_by_name && booking.event_type === 'match' && (
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {booking.booked_by_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {booking.price.toFixed(2)} EUR - {t.bookings[booking.payment_status as keyof typeof t.bookings]}
                    </span>
                    <button
                      onClick={() => handleEditBooking(booking)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* New Booking Modal */}
      {showNewBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBooking ? (t.common?.edit || 'Edit') : t.bookings.newBooking}
              </h2>
              <button onClick={() => { setShowNewBooking(false); setEditingBooking(null); resetBookingForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBooking} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.selectCourt}</label>
                <select
                  value={newBooking.court_id}
                  onChange={(e) => setNewBooking({ ...newBooking, court_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">{t.bookings.selectCourt}</option>
                  {courts.map(court => (
                    <option key={court.id} value={court.id}>{court.name} - {court.hourly_rate} EUR/h</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.selectDate}</label>
                <input
                  type="date"
                  value={newBooking.date}
                  onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings?.eventType || 'Event Type'}</label>
                <select
                  value={newBooking.event_type}
                  onChange={(e) => setNewBooking({ ...newBooking, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="match">{t.bookings?.match || 'Match/Game'}</option>
                  <option value="tournament">{t.bookings?.tournament || 'Tournament'}</option>
                  <option value="training">{t.bookings?.training || 'Training'}</option>
                  <option value="event">{t.bookings?.event || 'Event'}</option>
                  <option value="maintenance">{t.bookings?.maintenance || 'Maintenance'}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.selectTime}</label>
                  <select
                    value={newBooking.startTime}
                    onChange={(e) => setNewBooking({ ...newBooking, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timeSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.duration}</label>
                  <select
                    value={newBooking.duration}
                    onChange={(e) => setNewBooking({ ...newBooking, duration: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>1h</option>
                    <option value={1.5}>1h30</option>
                    <option value={2}>2h</option>
                    <option value={2.5}>2h30</option>
                  </select>
                </div>
              </div>
              {newBooking.event_type === 'match' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <User className="w-4 h-4" />
                    {t.bookings?.players || 'Players'} (Padel - 4 {t.bookings?.players || 'players'})
                  </div>
                  {players.map((player, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${player.isMember ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">
                        {t.bookings?.player || 'Player'} {idx + 1} {idx === 0 ? `(${t.bookings?.booker || 'Booker'})` : `(${t.common?.optional || 'optional'})`}
                      </span>
                      {player.isMember && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Award className="w-3 h-3" />
                          {player.planName} - {player.discount}% {t.members?.discount || 'discount'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => handlePlayerNameChange(idx, e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t.bookings?.name || 'Name'}
                          required={idx === 0}
                        />
                        {searchingPlayer === idx && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="tel"
                          value={player.phone}
                          onChange={(e) => handlePlayerPhoneChange(idx, e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t.bookings?.phone || 'Phone'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.paymentStatus}</label>
                <select
                  value={newBooking.payment_status}
                  onChange={(e) => setNewBooking({ ...newBooking, payment_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">{t.bookings.unpaid}</option>
                  <option value="paid">{t.bookings.paid}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.bookings.notes}</label>
                <textarea
                  value={newBooking.notes}
                  onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>

              {newBooking.court_id && (() => {
                const pricing = getPriceBreakdown();
                const hasMemberDiscount = pricing.totalDiscount > 0;
                return (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="text-sm text-gray-600">{t.bookings.price}:</div>
                    {hasMemberDiscount ? (
                      <>
                        <div className="space-y-1">
                          {pricing.breakdown.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className={p.isMember ? 'text-emerald-700' : 'text-gray-500'}>
                                {p.name || `Player ${p.playerNum}`}
                                {p.isMember && ` (-${p.discountPercent}%)`}
                              </span>
                              <span className={p.isMember ? 'text-emerald-700 font-medium' : 'text-gray-600'}>
                                {p.finalPrice.toFixed(2)} EUR
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                          <div>
                            <div className="text-xs text-gray-400 line-through">{pricing.basePrice.toFixed(2)} EUR</div>
                            <div className="text-xs text-emerald-600">-{pricing.totalDiscount.toFixed(2)} EUR {t.members?.discount || 'discount'}</div>
                          </div>
                          <div className="text-lg font-bold text-emerald-600">{pricing.finalPrice.toFixed(2)} EUR</div>
                        </div>
                      </>
                    ) : (
                      <div className="text-lg font-bold text-gray-900">{pricing.basePrice.toFixed(2)} EUR</div>
                    )}
                  </div>
                );
              })()}

              {editingBooking && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t.bookings?.confirmCancel || 'Cancel this booking?')) {
                      handleCancelBooking(editingBooking.id);
                      setShowNewBooking(false);
                      setEditingBooking(null);
                      resetBookingForm();
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.bookings?.cancelBooking || 'Cancel Booking'}
                </button>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowNewBooking(false); setEditingBooking(null); resetBookingForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingBooking ? (t.common?.save || 'Save') : t.bookings.book}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Game Details Modal */}
      {selectedOpenGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Clock className="w-5 h-5" />
                    <span className="font-bold text-xl">
                      {formatGameTime(selectedOpenGame.scheduled_at)}
                    </span>
                    <span className="text-gray-400">-</span>
                    <span className="text-gray-500">
                      {formatGameTime(new Date(new Date(selectedOpenGame.scheduled_at).getTime() + selectedOpenGame.duration_minutes * 60000).toISOString())}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGameStatusColor(selectedOpenGame.status)}`}>
                    {getGameStatusLabel(selectedOpenGame.status)}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedOpenGame.game_type === 'competitive'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}>
                    {selectedOpenGame.game_type === 'competitive' ? (
                      <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {getGameTypeLabel(selectedOpenGame.game_type)}</span>
                    ) : (
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {getGameTypeLabel(selectedOpenGame.game_type)}</span>
                    )}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                    {getGenderLabel(selectedOpenGame.gender)}
                  </span>
                  {selectedOpenGame.court_name && (
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {selectedOpenGame.court_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    {selectedOpenGame.players.filter(p => p.status === 'confirmed').length}/{selectedOpenGame.max_players} jogadores
                  </span>
                  {selectedOpenGame.level_min !== null && selectedOpenGame.level_max !== null && (
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <TrendingUp className="w-4 h-4" />
                      Nível {selectedOpenGame.level_min?.toFixed(1)} - {selectedOpenGame.level_max?.toFixed(1)}
                    </span>
                  )}
                  {selectedOpenGame.price_per_player > 0 && (
                    <span className="font-medium text-gray-700 text-sm">
                      €{selectedOpenGame.price_per_player.toFixed(2)}/jogador
                    </span>
                  )}
                </div>

                {/* Creator */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-400">Criado por:</span>
                  <div className="flex items-center gap-2">
                    {selectedOpenGame.creator_avatar ? (
                      <img src={selectedOpenGame.creator_avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white font-bold">
                        {selectedOpenGame.creator_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">{selectedOpenGame.creator_name}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedOpenGame(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Players */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Confirmed Players */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    Jogadores Confirmados ({selectedOpenGame.players.filter(p => p.status === 'confirmed').length}/{selectedOpenGame.max_players})
                  </h4>
                  {selectedOpenGame.players.filter(p => p.status === 'confirmed').length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum jogador confirmado</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedOpenGame.players
                        .filter(p => p.status === 'confirmed')
                        .map(player => (
                          <div key={player.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold">
                                {player.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-900">{player.name}</p>
                                {player.is_member && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    Membro
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {player.level !== null && player.level !== undefined && (
                                  <span
                                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: categoryColors(player.player_category).hex }}
                                  >
                                    Nv. {player.level.toFixed(1)}
                                  </span>
                                )}
                                {player.player_category && (
                                  <span className="text-xs text-gray-500">{player.player_category}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-sm font-semibold ${player.is_member ? 'text-emerald-600' : 'text-gray-900'}`}>
                                  €{player.price?.toFixed(2) || '0.00'}
                                </span>
                                {player.is_member && player.discount_percent && player.discount_percent > 0 && (
                                  <span className="text-[10px] text-emerald-600">
                                    (-{player.discount_percent}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleTogglePlayerPayment(player.id, player.payment_status || 'pending')}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                                player.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title={player.payment_status === 'paid' ? 'Marcar como não pago' : 'Marcar como pago'}
                            >
                              <Check className={`w-4 h-4 ${player.payment_status === 'paid' ? 'opacity-100' : 'opacity-30'}`} />
                              <span className="text-xs font-medium">
                                {player.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Pending Players */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    Pedidos Pendentes ({selectedOpenGame.players.filter(p => p.status === 'pending').length})
                  </h4>
                  {selectedOpenGame.players.filter(p => p.status === 'pending').length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Sem pedidos pendentes</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedOpenGame.players
                        .filter(p => p.status === 'pending')
                        .map(player => (
                          <div key={player.id} className="flex items-center gap-3 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-yellow-300" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white text-sm font-bold">
                                {player.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{player.name}</p>
                              <div className="flex items-center gap-2">
                                {player.level !== null && player.level !== undefined && (
                                  <span
                                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: categoryColors(player.player_category).hex }}
                                  >
                                    Nv. {player.level.toFixed(1)}
                                  </span>
                                )}
                                {player.player_category && (
                                  <span className="text-xs text-gray-500">{player.player_category}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-yellow-600 font-medium">
                              Pendente
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes & Actions */}
              {(selectedOpenGame.notes || selectedOpenGame.status === 'open') && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  {selectedOpenGame.notes && (
                    <p className="text-sm text-gray-600 italic mb-4">
                      <span className="font-medium">Notas:</span> {selectedOpenGame.notes}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mb-4">
                    Criado em {formatDateTime(selectedOpenGame.created_at)}
                  </p>
                  <div className="flex items-center gap-3">
                    {selectedOpenGame.status === 'open' && (
                      <button
                        onClick={() => handleCancelOpenGame(selectedOpenGame.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                      >
                        <X className="w-4 h-4" />
                        Cancelar jogo
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOpenGame(selectedOpenGame.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
