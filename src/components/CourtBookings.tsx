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
  Award
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

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

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

  const handleEditBooking = (booking: Booking) => {
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
    </div>
  );
}
