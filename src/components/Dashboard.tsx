import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  CalendarDays,
  Users,
  GraduationCap,
  ShoppingBag,
  Plus,
  Clock,
  MapPin,
  Search,
  X,
  Phone,
  Mail
} from 'lucide-react';

interface StaffPermissions {
  isStaff: boolean;
  isOwner: boolean;
  clubOwnerId: string | null;
  staffName: string | null;
  perm_bookings: boolean;
  perm_members: boolean;
  perm_bar: boolean;
  perm_academy: boolean;
  perm_reports: boolean;
  role: string | null;
}

interface DashboardProps {
  onNavigate: (view: 'dashboard' | 'bookings' | 'members' | 'academy' | 'bar' | 'open-games' | 'settings') => void;
  staffPermissions?: StaffPermissions;
}

interface Court {
  id: string;
  name: string;
  type: string;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  booked_by_name: string | null;
  status: string;
  court: Court;
}

interface Stats {
  todayBookings: number;
  activeMembers: number;
  todayClasses: number;
  pendingOrders: number;
  monthRevenue: number;
}

interface Member {
  id: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  status: string;
  plan?: {
    name: string;
  };
}

export default function Dashboard({ onNavigate, staffPermissions }: DashboardProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffPermissions?.clubOwnerId || user?.id;
  const [stats, setStats] = useState<Stats>({
    todayBookings: 0,
    activeMembers: 0,
    todayClasses: 0,
    pendingOrders: 0,
    monthRevenue: 0
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      loadDashboardData();
    }
  }, [effectiveUserId]);

  const loadDashboardData = async () => {
    if (!effectiveUserId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      bookingsResult,
      membersResult,
      classesResult,
      ordersResult,
      recentBookingsResult
    ] = await Promise.all([
      supabase
        .from('court_bookings')
        .select('id, club_courts!inner(user_id)')
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .eq('club_courts.user_id', effectiveUserId)
        .eq('status', 'confirmed'),
      supabase
        .from('member_subscriptions')
        .select('id')
        .eq('club_owner_id', effectiveUserId)
        .eq('status', 'active'),
      supabase
        .from('club_classes')
        .select('id')
        .eq('club_owner_id', effectiveUserId)
        .gte('scheduled_at', today.toISOString())
        .lt('scheduled_at', tomorrow.toISOString()),
      supabase
        .from('bar_orders')
        .select('id')
        .eq('club_owner_id', effectiveUserId)
        .in('status', ['pending', 'preparing']),
      supabase
        .from('court_bookings')
        .select(`
          id,
          start_time,
          end_time,
          booked_by_name,
          status,
          court:club_courts(id, name, type)
        `)
        .eq('club_courts.user_id', effectiveUserId)
        .eq('status', 'confirmed')
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: true })
        .limit(5)
    ]);

    setStats({
      todayBookings: bookingsResult.data?.length || 0,
      activeMembers: membersResult.data?.length || 0,
      todayClasses: classesResult.data?.length || 0,
      pendingOrders: ordersResult.data?.length || 0,
      monthRevenue: 0
    });

    setRecentBookings(recentBookingsResult.data as unknown as Booking[] || []);
    setLoading(false);
  };

  const handleMemberSearch = async (query: string) => {
    setMemberSearchQuery(query);
    if (!effectiveUserId || query.length < 2) {
      setMemberSearchResults([]);
      return;
    }

    setSearchingMembers(true);
    const { data } = await supabase
      .from('member_subscriptions')
      .select(`
        id,
        member_name,
        member_email,
        member_phone,
        status,
        plan:membership_plans(name)
      `)
      .eq('club_owner_id', effectiveUserId)
      .or(`member_name.ilike.%${query}%,member_email.ilike.%${query}%,member_phone.ilike.%${query}%`)
      .limit(10);

    setMemberSearchResults(data as unknown as Member[] || []);
    setSearchingMembers(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statCards = [
    {
      title: t.dashboard.todayBookings,
      value: stats.todayBookings,
      icon: CalendarDays,
      color: 'bg-blue-500',
      onClick: () => onNavigate('bookings')
    },
    {
      title: t.dashboard.activeMembers,
      value: stats.activeMembers,
      icon: Users,
      color: 'bg-emerald-500',
      onClick: () => onNavigate('members')
    },
    {
      title: t.dashboard.todayClasses,
      value: stats.todayClasses,
      icon: GraduationCap,
      color: 'bg-amber-500',
      onClick: () => onNavigate('academy')
    },
    {
      title: t.dashboard.pendingOrders,
      value: stats.pendingOrders,
      icon: ShoppingBag,
      color: 'bg-rose-500',
      onClick: () => onNavigate('bar')
    }
  ];

  const quickActions = [
    { label: t.dashboard.newBooking, icon: Plus, onClick: () => onNavigate('bookings'), color: 'bg-blue-600 hover:bg-blue-700' },
    { label: t.dashboard.addMember, icon: Users, onClick: () => onNavigate('members'), color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: t.dashboard.viewMember || 'View Member', icon: Search, onClick: () => setShowMemberSearch(true), color: 'bg-teal-600 hover:bg-teal-700' },
    { label: t.dashboard.scheduleClass, icon: GraduationCap, onClick: () => onNavigate('academy'), color: 'bg-amber-600 hover:bg-amber-700' },
  ];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">{t.message.loading}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
        <p className="text-gray-600 mt-1">{t.dashboard.welcome}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={card.onClick}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-600 mt-1">{card.title}</div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t.dashboard.upcomingBookings || 'Upcoming Bookings'}</h2>
          </div>
          <div className="p-5">
            {recentBookings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t.dashboard.noBookingsToday}</p>
            ) : (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {booking.court?.name || 'Court'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.booked_by_name || 'Guest'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-3 h-3" />
                        {formatTime(booking.start_time)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTime(booking.end_time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t.dashboard.quickActions}</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className={`${action.color} text-white rounded-lg p-4 flex flex-col items-center gap-2 transition-all`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium text-center">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showMemberSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t.dashboard.viewMember || 'View Member'}</h2>
              <button
                onClick={() => {
                  setShowMemberSearch(false);
                  setMemberSearchQuery('');
                  setMemberSearchResults([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
              {searchingMembers ? (
                <div className="text-center py-8 text-gray-500">{t.message.loading}</div>
              ) : memberSearchQuery.length < 2 ? (
                <div className="text-center py-8 text-gray-500">
                  {t.common.search}...
                </div>
              ) : memberSearchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">{t.common.noResults}</div>
              ) : (
                <div className="space-y-3">
                  {memberSearchResults.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      onClick={() => {
                        setShowMemberSearch(false);
                        setMemberSearchQuery('');
                        setMemberSearchResults([]);
                        onNavigate('members');
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{member.member_name}</div>
                          {member.plan && (
                            <div className="text-sm text-blue-600 mt-1">{member.plan.name}</div>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          member.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {member.status === 'active' ? t.members.active : member.status}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {member.member_email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {member.member_email}
                          </div>
                        )}
                        {member.member_phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {member.member_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
