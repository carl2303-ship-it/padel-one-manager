import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  BarChart3,
  Calendar,
  Users,
  GraduationCap,
  Coffee,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MapPin,
  DollarSign,
  Megaphone,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  Building2,
  Target,
  FileText,
  Trophy
} from 'lucide-react';

interface ClubMetricsProps {
  staffClubOwnerId?: string | null;
}

interface CourtBookingMetric {
  courtId: string;
  courtName: string;
  totalBookings: number;
  totalRevenue: number;
  totalHours: number;
}

interface HourlyMetric {
  hour: number;
  count: number;
  revenue: number;
}

interface MemberBookingMetric {
  memberId: string;
  memberName: string;
  totalBookings: number;
  totalSpent: number;
}

interface CoachMetric {
  coachId: string;
  coachName: string;
  totalClasses: number;
  totalStudents: number;
  totalRevenue: number;
}

interface StudentMetric {
  studentName: string;
  totalClasses: number;
  totalSpent: number;
}

interface ProductMetric {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
}

interface CategoryMetric {
  categoryId: string;
  categoryName: string;
  quantity: number;
  revenue: number;
}

interface CustomerMetric {
  customerName: string;
  totalOrders: number;
  totalSpent: number;
}

interface PlayerTotalSpending {
  playerName: string;
  bookingsSpent: number;
  tournamentSpent: number;
  academySpent: number;
  barSpent: number;
  totalSpent: number;
}

interface Sponsor {
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string | null;
  contract_start: string | null;
  contract_end: string | null;
  monthly_value: number;
  total_value: number;
  payment_frequency: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  notes: string | null;
}

interface SponsorPayment {
  id: string;
  sponsor_id: string;
  amount: number;
  payment_date: string;
  reference_period: string | null;
  status: string;
  notes: string | null;
}

interface FinancialSummary {
  bookingsRevenue: number;
  academyRevenue: number;
  barRevenue: number;
  sponsorsRevenue: number;
  tournamentsRevenue: number;
  tournamentsCount: number;
  tournamentsRegistrations: number;
  totalRevenue: number;
}

interface TournamentMetric {
  tournamentId: string;
  tournamentName: string;
  startDate: string;
  registrations: number;
  revenue: number;
}

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type ActiveTab = 'overview' | 'players' | 'sponsors';

export default function ClubMetrics({ staffClubOwnerId }: ClubMetricsProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [loading, setLoading] = useState(true);

  const [courtMetrics, setCourtMetrics] = useState<CourtBookingMetric[]>([]);
  const [hourlyMetrics, setHourlyMetrics] = useState<HourlyMetric[]>([]);
  const [memberBookings, setMemberBookings] = useState<MemberBookingMetric[]>([]);

  const [coachMetrics, setCoachMetrics] = useState<CoachMetric[]>([]);
  const [studentMetrics, setStudentMetrics] = useState<StudentMetric[]>([]);

  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [categoryMetrics, setCategoryMetrics] = useState<CategoryMetric[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetric[]>([]);

  const [playerTotalSpending, setPlayerTotalSpending] = useState<PlayerTotalSpending[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    bookingsRevenue: 0,
    academyRevenue: 0,
    barRevenue: 0,
    sponsorsRevenue: 0,
    tournamentsRevenue: 0,
    tournamentsCount: 0,
    tournamentsRegistrations: 0,
    totalRevenue: 0
  });
  const [tournamentMetrics, setTournamentMetrics] = useState<TournamentMetric[]>([]);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorPayments, setSponsorPayments] = useState<SponsorPayment[]>([]);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedSponsorForPayment, setSelectedSponsorForPayment] = useState<Sponsor | null>(null);
  const [saving, setSaving] = useState(false);

  const [sponsorForm, setSponsorForm] = useState({
    name: '',
    type: 'sponsor' as string,
    description: '',
    location: '',
    contract_start: '',
    contract_end: '',
    monthly_value: 0,
    total_value: 0,
    payment_frequency: 'monthly' as string,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    reference_period: '',
    status: 'paid' as string,
    notes: ''
  });

  const [expandedSections, setExpandedSections] = useState({
    financial: true,
    bookings: false,
    academy: false,
    bar: false,
    tournaments: false
  });

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        endDate = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
        break;
    }

    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  useEffect(() => {
    if (effectiveUserId) {
      loadAllMetrics();
    }
  }, [effectiveUserId, dateFilter]);

  const loadAllMetrics = async () => {
    setLoading(true);
    await Promise.all([
      loadBookingMetrics(),
      loadAcademyMetrics(),
      loadBarMetrics(),
      loadSponsorsData(),
      loadTournamentMetrics()
    ]);
    setLoading(false);
  };

  const loadBookingMetrics = async () => {
    if (!effectiveUserId) return;

    const { startDate, endDate } = getDateRange();

    const { data: courts } = await supabase
      .from('club_courts')
      .select('id, name')
      .eq('user_id', effectiveUserId);

    if (!courts) return;

    const { data: bookings } = await supabase
      .from('court_bookings')
      .select(`
        id,
        court_id,
        start_time,
        end_time,
        price,
        event_type,
        booked_by_name,
        player1_name,
        player2_name,
        player3_name,
        player4_name,
        player1_is_member,
        player2_is_member,
        player3_is_member,
        player4_is_member,
        club_courts!inner(user_id)
      `)
      .eq('club_courts.user_id', effectiveUserId)
      .eq('status', 'confirmed')
      .neq('event_type', 'open_game')
      .gte('start_time', startDate)
      .lte('start_time', endDate);

    if (!bookings) return;

    const courtMap = new Map<string, CourtBookingMetric>();
    courts.forEach(c => {
      courtMap.set(c.id, {
        courtId: c.id,
        courtName: c.name,
        totalBookings: 0,
        totalRevenue: 0,
        totalHours: 0
      });
    });

    const hourMap = new Map<number, HourlyMetric>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { hour: i, count: 0, revenue: 0 });
    }

    const memberMap = new Map<string, MemberBookingMetric>();

    bookings.forEach(b => {
      const court = courtMap.get(b.court_id);
      if (court) {
        court.totalBookings++;
        court.totalRevenue += Number(b.price) || 0;
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        court.totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      const hour = new Date(b.start_time).getHours();
      const hourMetric = hourMap.get(hour);
      if (hourMetric) {
        hourMetric.count++;
        hourMetric.revenue += Number(b.price) || 0;
      }

      const players = [
        { name: b.player1_name, isMember: b.player1_is_member },
        { name: b.player2_name, isMember: b.player2_is_member },
        { name: b.player3_name, isMember: b.player3_is_member },
        { name: b.player4_name, isMember: b.player4_is_member }
      ];

      players.forEach(p => {
        if (p.name) {
          const key = p.name.toLowerCase();
          const existing = memberMap.get(key);
          const playerShare = (Number(b.price) || 0) / 4;
          if (existing) {
            existing.totalBookings++;
            existing.totalSpent += playerShare;
          } else {
            memberMap.set(key, {
              memberId: key,
              memberName: p.name,
              totalBookings: 1,
              totalSpent: playerShare
            });
          }
        }
      });
    });

    setCourtMetrics(Array.from(courtMap.values()).sort((a, b) => b.totalBookings - a.totalBookings));
    setHourlyMetrics(Array.from(hourMap.values()).filter(h => h.count > 0));
    setMemberBookings(Array.from(memberMap.values()).sort((a, b) => b.totalBookings - a.totalBookings));
  };

  const loadAcademyMetrics = async () => {
    if (!effectiveUserId) return;

    const { startDate, endDate } = getDateRange();

    const { data: classTypes } = await supabase
      .from('class_types')
      .select('id, name, price_per_class')
      .eq('club_owner_id', effectiveUserId);

    const classTypeMap = new Map(classTypes?.map(ct => [ct.id, ct]) || []);

    const { data: classes } = await supabase
      .from('club_classes')
      .select(`
        id,
        coach_id,
        class_type_id,
        scheduled_at,
        coach:club_staff(id, name),
        class_type:class_types(name, price_per_class)
      `)
      .eq('club_owner_id', effectiveUserId)
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate);

    if (!classes) return;

    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select(`
        id,
        class_id,
        student_name,
        status
      `)
      .in('class_id', classes.map(c => c.id))
      .in('status', ['enrolled', 'attended']);

    const coachMap = new Map<string, CoachMetric>();
    const studentMap = new Map<string, StudentMetric>();

    classes.forEach(c => {
      const coachData = c.coach as { id: string; name: string } | null;
      const classTypeData = c.class_type as { name: string; price_per_class: number } | null;
      const classEnrollments = enrollments?.filter(e => e.class_id === c.id) || [];
      const classRevenue = (classTypeData?.price_per_class || 0) * classEnrollments.length;

      if (coachData) {
        const existing = coachMap.get(coachData.id);

        if (existing) {
          existing.totalClasses++;
          existing.totalStudents += classEnrollments.length;
          existing.totalRevenue += classRevenue;
        } else {
          coachMap.set(coachData.id, {
            coachId: coachData.id,
            coachName: coachData.name,
            totalClasses: 1,
            totalStudents: classEnrollments.length,
            totalRevenue: classRevenue
          });
        }
      }

      classEnrollments.forEach(e => {
        if (e.student_name) {
          const key = e.student_name.toLowerCase();
          const existing = studentMap.get(key);
          const pricePerStudent = classTypeData?.price_per_class || 0;
          if (existing) {
            existing.totalClasses++;
            existing.totalSpent += pricePerStudent;
          } else {
            studentMap.set(key, {
              studentName: e.student_name,
              totalClasses: 1,
              totalSpent: pricePerStudent
            });
          }
        }
      });
    });

    setCoachMetrics(Array.from(coachMap.values()).sort((a, b) => b.totalClasses - a.totalClasses));
    setStudentMetrics(Array.from(studentMap.values()).sort((a, b) => b.totalClasses - a.totalClasses));
  };

  const loadBarMetrics = async () => {
    if (!effectiveUserId) return;

    const { startDate, endDate } = getDateRange();

    const { data: orders } = await supabase
      .from('bar_orders')
      .select(`
        id,
        customer_name,
        user_id,
        total,
        status
      `)
      .eq('club_owner_id', effectiveUserId)
      .neq('status', 'cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: orderItems } = await supabase
      .from('bar_order_items')
      .select(`
        id,
        order_id,
        menu_item_id,
        quantity,
        price,
        menu_item:menu_items(id, name, category_id, category:menu_categories(id, name))
      `)
      .in('order_id', orders?.map(o => o.id) || []);

    const productMap = new Map<string, ProductMetric>();
    const categoryMap = new Map<string, CategoryMetric>();
    const customerMap = new Map<string, CustomerMetric>();

    orderItems?.forEach(item => {
      const menuItem = item.menu_item as { id: string; name: string; category_id: string; category: { id: string; name: string } | null } | null;
      if (menuItem) {
        const existing = productMap.get(menuItem.id);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += Number(item.price) * item.quantity;
        } else {
          productMap.set(menuItem.id, {
            productId: menuItem.id,
            productName: menuItem.name,
            category: menuItem.category?.name || 'N/A',
            quantity: item.quantity,
            revenue: Number(item.price) * item.quantity
          });
        }

        if (menuItem.category) {
          const catExisting = categoryMap.get(menuItem.category.id);
          if (catExisting) {
            catExisting.quantity += item.quantity;
            catExisting.revenue += Number(item.price) * item.quantity;
          } else {
            categoryMap.set(menuItem.category.id, {
              categoryId: menuItem.category.id,
              categoryName: menuItem.category.name,
              quantity: item.quantity,
              revenue: Number(item.price) * item.quantity
            });
          }
        }
      }
    });

    orders?.forEach(o => {
      const customerKey = (o.customer_name || 'Guest').toLowerCase();
      const existing = customerMap.get(customerKey);
      if (existing) {
        existing.totalOrders++;
        existing.totalSpent += Number(o.total) || 0;
      } else {
        customerMap.set(customerKey, {
          customerName: o.customer_name || 'Guest',
          totalOrders: 1,
          totalSpent: Number(o.total) || 0
        });
      }
    });

    setProductMetrics(Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity));
    setCategoryMetrics(Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue));
    setCustomerMetrics(Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
  };

  const loadSponsorsData = async () => {
    if (!effectiveUserId) return;

    const { startDate, endDate } = getDateRange();

    const { data: sponsorsData } = await supabase
      .from('club_sponsors')
      .select('*')
      .eq('club_owner_id', effectiveUserId)
      .order('name');

    if (sponsorsData) {
      setSponsors(sponsorsData);

      const sponsorIds = sponsorsData.map(s => s.id);
      if (sponsorIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('club_sponsor_payments')
          .select('*')
          .in('sponsor_id', sponsorIds)
          .gte('payment_date', startDate.split('T')[0])
          .lte('payment_date', endDate.split('T')[0])
          .order('payment_date', { ascending: false });

        setSponsorPayments(paymentsData || []);
      }
    }
  };

  const loadTournamentMetrics = async () => {
    if (!effectiveUserId) return;

    const { startDate, endDate } = getDateRange();
    const startDateOnly = startDate.split('T')[0];
    const endDateOnly = endDate.split('T')[0];

    const { data: clubData } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_id', effectiveUserId)
      .maybeSingle();

    if (!clubData) {
      setTournamentMetrics([]);
      return;
    }

    const { data: tournaments } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        start_date,
        end_date
      `)
      .eq('club_id', clubData.id)
      .gte('start_date', startDateOnly)
      .lte('start_date', endDateOnly)
      .order('start_date', { ascending: false });

    if (!tournaments || tournaments.length === 0) {
      setTournamentMetrics([]);
      return;
    }

    const tournamentIds = tournaments.map(t => t.id);

    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('tournament_id, amount, status')
      .in('tournament_id', tournamentIds)
      .eq('status', 'succeeded');

    const { data: players } = await supabase
      .from('players')
      .select('tournament_id')
      .in('tournament_id', tournamentIds);

    const metrics: TournamentMetric[] = tournaments.map(t => {
      const tournamentPayments = payments?.filter(p => p.tournament_id === t.id) || [];
      const tournamentPlayers = players?.filter(p => p.tournament_id === t.id) || [];

      const revenue = tournamentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const registrations = tournamentPlayers.length;

      return {
        tournamentId: t.id,
        tournamentName: t.name,
        startDate: t.start_date,
        registrations,
        revenue
      };
    });

    setTournamentMetrics(metrics);
  };

  const calculateFinancialSummary = () => {
    const bookingsRevenue = courtMetrics.reduce((sum, c) => sum + c.totalRevenue, 0);
    const academyRevenue = coachMetrics.reduce((sum, c) => sum + c.totalRevenue, 0);
    const barRevenue = categoryMetrics.reduce((sum, c) => sum + c.revenue, 0);
    const sponsorsRevenue = sponsorPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
    const tournamentsRevenue = tournamentMetrics.reduce((sum, t) => sum + t.revenue, 0);
    const tournamentsRegistrations = tournamentMetrics.reduce((sum, t) => sum + t.registrations, 0);

    setFinancialSummary({
      bookingsRevenue,
      academyRevenue,
      barRevenue,
      sponsorsRevenue,
      tournamentsRevenue,
      tournamentsCount: tournamentMetrics.length,
      tournamentsRegistrations,
      totalRevenue: bookingsRevenue + academyRevenue + barRevenue + sponsorsRevenue + tournamentsRevenue
    });
  };

  useEffect(() => {
    calculateFinancialSummary();
  }, [courtMetrics, coachMetrics, categoryMetrics, sponsorPayments, tournamentMetrics]);

  const loadPlayerTransactions = async () => {
    if (!effectiveUserId) return [];

    const { startDate, endDate } = getDateRange();

    const { data: transactions, error } = await supabase
      .from('player_transactions')
      .select('*')
      .eq('club_owner_id', effectiveUserId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    console.log('[Metrics] Player transactions loaded:', { transactions, error, effectiveUserId, startDate, endDate });
    return transactions || [];
  };

  useEffect(() => {
    const aggregatePlayerSpending = async () => {
      const customerMap = new Map<string, CustomerMetric>();
      customerMetrics.forEach(c => customerMap.set(c.customerName.toLowerCase(), c));

      const playerMap = new Map<string, PlayerTotalSpending>();

      // Add regular bookings from court_bookings
      memberBookings.forEach(member => {
        const key = member.memberName.toLowerCase();
        playerMap.set(key, {
          playerName: member.memberName,
          bookingsSpent: member.totalSpent,
          tournamentSpent: 0,
          academySpent: 0,
          barSpent: 0,
          totalSpent: member.totalSpent
        });
      });

      // Add player_transactions (open games, tournaments, individual pricing)
      const transactions = await loadPlayerTransactions();
      transactions.forEach(tx => {
        const key = tx.player_name.toLowerCase();
        const existing = playerMap.get(key);
        const amount = Number(tx.amount);
        const isTournament = tx.reference_type === 'tournament';
        
        if (existing) {
          if (isTournament) {
            existing.tournamentSpent += amount;
          } else if (tx.transaction_type === 'open_game' || tx.transaction_type === 'booking') {
            existing.bookingsSpent += amount;
          } else if (tx.transaction_type === 'academy') {
            existing.academySpent += amount;
          } else if (tx.transaction_type === 'bar') {
            existing.barSpent += amount;
          }
          existing.totalSpent += amount;
        } else {
          playerMap.set(key, {
            playerName: tx.player_name,
            bookingsSpent: !isTournament && (tx.transaction_type === 'open_game' || tx.transaction_type === 'booking') ? amount : 0,
            tournamentSpent: isTournament ? amount : 0,
            academySpent: tx.transaction_type === 'academy' ? amount : 0,
            barSpent: tx.transaction_type === 'bar' ? amount : 0,
            totalSpent: amount
          });
        }
      });

      // Add academy from class bookings
      studentMetrics.forEach(student => {
        const key = student.studentName.toLowerCase();
        const existing = playerMap.get(key);
        if (existing) {
          existing.academySpent += student.totalSpent;
          existing.totalSpent += student.totalSpent;
        } else {
          playerMap.set(key, {
            playerName: student.studentName,
            bookingsSpent: 0,
            tournamentSpent: 0,
            academySpent: student.totalSpent,
            barSpent: 0,
            totalSpent: student.totalSpent
          });
        }
      });

      // Add bar from orders
      customerMap.forEach((customer, key) => {
        const existing = playerMap.get(key);
        if (existing) {
          existing.barSpent += customer.totalSpent;
          existing.totalSpent += customer.totalSpent;
        } else {
          playerMap.set(key, {
            playerName: customer.customerName,
            bookingsSpent: 0,
            tournamentSpent: 0,
            academySpent: 0,
            barSpent: customer.totalSpent,
            totalSpent: customer.totalSpent
          });
        }
      });

      setPlayerTotalSpending(Array.from(playerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
    };

    aggregatePlayerSpending();
  }, [memberBookings, studentMetrics, customerMetrics, dateFilter]);

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    setSaving(true);

    const sponsorData = {
      club_owner_id: effectiveUserId,
      name: sponsorForm.name,
      type: sponsorForm.type,
      description: sponsorForm.description || null,
      location: sponsorForm.location || null,
      contract_start: sponsorForm.contract_start || null,
      contract_end: sponsorForm.contract_end || null,
      monthly_value: sponsorForm.monthly_value,
      total_value: sponsorForm.total_value,
      payment_frequency: sponsorForm.payment_frequency,
      contact_name: sponsorForm.contact_name || null,
      contact_email: sponsorForm.contact_email || null,
      contact_phone: sponsorForm.contact_phone || null,
      notes: sponsorForm.notes || null
    };

    if (editingSponsor) {
      await supabase
        .from('club_sponsors')
        .update(sponsorData)
        .eq('id', editingSponsor.id);
    } else {
      await supabase.from('club_sponsors').insert(sponsorData);
    }

    setShowSponsorForm(false);
    setEditingSponsor(null);
    resetSponsorForm();
    loadSponsorsData();
    setSaving(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSponsorForPayment) return;

    setSaving(true);

    await supabase.from('club_sponsor_payments').insert({
      sponsor_id: selectedSponsorForPayment.id,
      amount: paymentForm.amount,
      payment_date: paymentForm.payment_date,
      reference_period: paymentForm.reference_period || null,
      status: paymentForm.status,
      notes: paymentForm.notes || null
    });

    setShowPaymentForm(false);
    setSelectedSponsorForPayment(null);
    resetPaymentForm();
    loadSponsorsData();
    setSaving(false);
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!confirm(t.message?.confirmDelete || 'Are you sure?')) return;
    await supabase.from('club_sponsors').delete().eq('id', id);
    loadSponsorsData();
  };

  const handleEditSponsor = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setSponsorForm({
      name: sponsor.name,
      type: sponsor.type,
      description: sponsor.description || '',
      location: sponsor.location || '',
      contract_start: sponsor.contract_start || '',
      contract_end: sponsor.contract_end || '',
      monthly_value: sponsor.monthly_value,
      total_value: sponsor.total_value,
      payment_frequency: sponsor.payment_frequency,
      contact_name: sponsor.contact_name || '',
      contact_email: sponsor.contact_email || '',
      contact_phone: sponsor.contact_phone || '',
      notes: sponsor.notes || ''
    });
    setShowSponsorForm(true);
  };

  const resetSponsorForm = () => {
    setSponsorForm({
      name: '',
      type: 'sponsor',
      description: '',
      location: '',
      contract_start: '',
      contract_end: '',
      monthly_value: 0,
      total_value: 0,
      payment_frequency: 'monthly',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      notes: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      reference_period: '',
      status: 'paid',
      notes: ''
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: 'today', label: t.bookings?.today || 'Today' },
    { value: 'week', label: t.bookings?.thisWeek || 'This Week' },
    { value: 'month', label: t.dashboard?.thisMonth || 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: t.common?.all || 'All Time' }
  ];

  const sponsorTypes = [
    { value: 'sponsor', label: 'Sponsor' },
    { value: 'court_ad', label: 'Court Advertising' },
    { value: 'outdoor', label: 'Outdoor/Billboard' },
    { value: 'digital', label: 'Digital' },
    { value: 'event', label: 'Event Sponsor' },
    { value: 'other', label: 'Other' }
  ];

  const paymentFrequencies = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'one_time', label: 'One Time' }
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">{t.message?.loading || 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav?.metrics || 'Metrics'}</h1>
            <p className="text-gray-600 text-sm">Analytics and financial overview</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {dateFilterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setDateFilter(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                dateFilter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'overview' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </span>
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'players' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Player Spending
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sponsors')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'sponsors' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Sponsors
          </span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">Financial Balance</h2>
                <p className="text-emerald-100 text-sm">Total revenue breakdown</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-emerald-200" />
                  <span className="text-sm text-emerald-100">Bookings</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.bookingsRevenue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-4 h-4 text-emerald-200" />
                  <span className="text-sm text-emerald-100">Academy</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.academyRevenue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coffee className="w-4 h-4 text-emerald-200" />
                  <span className="text-sm text-emerald-100">Bar</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.barRevenue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-emerald-200" />
                  <span className="text-sm text-emerald-100">Tournaments</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.tournamentsRevenue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-4 h-4 text-emerald-200" />
                  <span className="text-sm text-emerald-100">Sponsors</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.sponsorsRevenue)}</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4 border-2 border-white/30">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-white" />
                  <span className="text-sm font-medium">TOTAL</span>
                </div>
                <div className="text-3xl font-bold">{formatCurrency(financialSummary.totalRevenue)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('bookings')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">{t.nav?.bookings || 'Bookings'}</span>
                <span className="text-emerald-600 font-medium">{formatCurrency(financialSummary.bookingsRevenue)}</span>
              </div>
              {expandedSections.bookings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.bookings && (
              <div className="border-t border-gray-200 p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    By Court
                  </h3>
                  {courtMetrics.length === 0 ? (
                    <p className="text-sm text-gray-500">No data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b border-gray-200">
                            <th className="pb-2 font-medium">Court</th>
                            <th className="pb-2 font-medium text-right">Bookings</th>
                            <th className="pb-2 font-medium text-right">Hours</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courtMetrics.map(court => (
                            <tr key={court.courtId} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 font-medium text-gray-900">{court.courtName}</td>
                              <td className="py-3 text-right text-gray-700">{court.totalBookings}</td>
                              <td className="py-3 text-right text-gray-700">{court.totalHours.toFixed(1)}h</td>
                              <td className="py-3 text-right text-emerald-600 font-medium">{formatCurrency(court.totalRevenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    By Hour
                  </h3>
                  {hourlyMetrics.length === 0 ? (
                    <p className="text-sm text-gray-500">No data available</p>
                  ) : (
                    <div className="flex gap-1 items-end h-32">
                      {Array.from({ length: 24 }, (_, i) => {
                        const metric = hourlyMetrics.find(h => h.hour === i);
                        const maxCount = Math.max(...hourlyMetrics.map(h => h.count), 1);
                        const height = metric ? (metric.count / maxCount) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div
                              className={`w-full rounded-t transition-all ${metric && metric.count > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
                              style={{ height: `${height}%`, minHeight: metric && metric.count > 0 ? '4px' : '2px' }}
                              title={metric ? `${i}h: ${metric.count} bookings - ${formatCurrency(metric.revenue)}` : `${i}h: 0`}
                            />
                            {i % 4 === 0 && <span className="text-xs text-gray-500 mt-1">{i}h</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('academy')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-gray-900">{t.nav?.academy || 'Academy'}</span>
                <span className="text-emerald-600 font-medium">{formatCurrency(financialSummary.academyRevenue)}</span>
              </div>
              {expandedSections.academy ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.academy && (
              <div className="border-t border-gray-200 p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">By Coach</h3>
                  {coachMetrics.length === 0 ? (
                    <p className="text-sm text-gray-500">No data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b border-gray-200">
                            <th className="pb-2 font-medium">Coach</th>
                            <th className="pb-2 font-medium text-right">Classes</th>
                            <th className="pb-2 font-medium text-right">Students</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coachMetrics.map(coach => (
                            <tr key={coach.coachId} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 font-medium text-gray-900">{coach.coachName}</td>
                              <td className="py-3 text-right text-gray-700">{coach.totalClasses}</td>
                              <td className="py-3 text-right text-amber-600 font-medium">{coach.totalStudents}</td>
                              <td className="py-3 text-right text-emerald-600 font-medium">{formatCurrency(coach.totalRevenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('bar')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <Coffee className="w-5 h-5 text-rose-600" />
                <span className="font-semibold text-gray-900">{t.nav?.bar || 'Bar'}</span>
                <span className="text-emerald-600 font-medium">{formatCurrency(financialSummary.barRevenue)}</span>
              </div>
              {expandedSections.bar ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.bar && (
              <div className="border-t border-gray-200 p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">By Category</h3>
                  {categoryMetrics.length === 0 ? (
                    <p className="text-sm text-gray-500">No data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b border-gray-200">
                            <th className="pb-2 font-medium">Category</th>
                            <th className="pb-2 font-medium text-right">Quantity</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryMetrics.map(cat => (
                            <tr key={cat.categoryId} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 font-medium text-gray-900">{cat.categoryName}</td>
                              <td className="py-3 text-right text-gray-700">{cat.quantity}</td>
                              <td className="py-3 text-right text-emerald-600 font-medium">{formatCurrency(cat.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Top Products</h3>
                  {productMetrics.length === 0 ? (
                    <p className="text-sm text-gray-500">No data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b border-gray-200">
                            <th className="pb-2 font-medium">Product</th>
                            <th className="pb-2 font-medium">Category</th>
                            <th className="pb-2 font-medium text-right">Qty</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productMetrics.slice(0, 10).map(product => (
                            <tr key={product.productId} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 font-medium text-gray-900">{product.productName}</td>
                              <td className="py-3 text-gray-600">{product.category}</td>
                              <td className="py-3 text-right text-gray-700">{product.quantity}</td>
                              <td className="py-3 text-right text-emerald-600 font-medium">{formatCurrency(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('tournaments')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-gray-900">Tournaments</span>
                <span className="text-emerald-600 font-medium">{formatCurrency(financialSummary.tournamentsRevenue)}</span>
                {financialSummary.tournamentsCount > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {financialSummary.tournamentsCount} tournaments
                  </span>
                )}
              </div>
              {expandedSections.tournaments ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.tournaments && (
              <div className="border-t border-gray-200 p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Tournament Revenue</h3>
                  {tournamentMetrics.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No tournaments linked to this club for this period</p>
                      <p className="text-xs text-gray-400 mt-1">Link tournaments to your club in the tournament app to see revenue here</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b border-gray-200">
                            <th className="pb-2 font-medium">Tournament</th>
                            <th className="pb-2 font-medium text-right">Date</th>
                            <th className="pb-2 font-medium text-right">Registrations</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tournamentMetrics.map(tournament => (
                            <tr key={tournament.tournamentId} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 font-medium text-gray-900">{tournament.tournamentName}</td>
                              <td className="py-3 text-right text-gray-700">{new Date(tournament.startDate).toLocaleDateString()}</td>
                              <td className="py-3 text-right text-amber-600 font-medium">{tournament.registrations}</td>
                              <td className="py-3 text-right text-emerald-600 font-medium">{formatCurrency(tournament.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold">
                            <td className="py-3 text-gray-900">Total</td>
                            <td className="py-3"></td>
                            <td className="py-3 text-right text-amber-600">{financialSummary.tournamentsRegistrations}</td>
                            <td className="py-3 text-right text-emerald-600">{formatCurrency(financialSummary.tournamentsRevenue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Player Spending Analysis
            </h2>
            <p className="text-sm text-gray-600 mt-1">See what each player spends at your club across all services</p>
          </div>

          {playerTotalSpending.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No player data available for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-200 bg-gray-50">
                    <th className="py-3 px-5 font-medium">Player</th>
                    <th className="py-3 px-3 font-medium text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Bookings
                      </span>
                    </th>
                    <th className="py-3 px-3 font-medium text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        Torneios
                      </span>
                    </th>
                    <th className="py-3 px-3 font-medium text-right">
                      <span className="flex items-center justify-end gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Academy
                      </span>
                    </th>
                    <th className="py-3 px-3 font-medium text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Coffee className="w-3.5 h-3.5" />
                        Bar
                      </span>
                    </th>
                    <th className="py-3 px-5 font-medium text-right bg-emerald-50 text-emerald-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {playerTotalSpending.map((player, idx) => (
                    <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-5 font-medium text-gray-900">{player.playerName}</td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {player.bookingsSpent > 0 ? formatCurrency(player.bookingsSpent) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {player.tournamentSpent > 0 ? formatCurrency(player.tournamentSpent) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {player.academySpent > 0 ? formatCurrency(player.academySpent) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {player.barSpent > 0 ? formatCurrency(player.barSpent) : '-'}
                      </td>
                      <td className="py-3 px-5 text-right font-bold text-emerald-600 bg-emerald-50">
                        {formatCurrency(player.totalSpent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-3 px-5 text-gray-900">TOTAL</td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      {formatCurrency(playerTotalSpending.reduce((sum, p) => sum + p.bookingsSpent, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      {formatCurrency(playerTotalSpending.reduce((sum, p) => sum + p.tournamentSpent, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      {formatCurrency(playerTotalSpending.reduce((sum, p) => sum + p.academySpent, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900">
                      {formatCurrency(playerTotalSpending.reduce((sum, p) => sum + p.barSpent, 0))}
                    </td>
                    <td className="py-3 px-5 text-right text-emerald-700 bg-emerald-100">
                      {formatCurrency(playerTotalSpending.reduce((sum, p) => sum + p.totalSpent, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sponsors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sponsors & Advertising</h2>
              <p className="text-sm text-gray-600">Manage sponsors, court ads, and outdoor advertising</p>
            </div>
            <button
              onClick={() => {
                resetSponsorForm();
                setEditingSponsor(null);
                setShowSponsorForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Sponsor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Active Sponsors</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {sponsors.filter(s => s.is_active).length}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Target className="w-4 h-4" />
                <span className="text-sm">Court Ads</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {sponsors.filter(s => s.type === 'court_ad' && s.is_active).length}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Monthly Value</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(sponsors.filter(s => s.is_active).reduce((sum, s) => sum + Number(s.monthly_value), 0))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Period Revenue</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(financialSummary.sponsorsRevenue)}
              </div>
            </div>
          </div>

          {sponsors.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sponsors yet</h3>
              <p className="text-gray-600 mb-4">Add your first sponsor or advertising contract</p>
              <button
                onClick={() => setShowSponsorForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Add Sponsor
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sponsors.map(sponsor => {
                const sponsorPaymentsFiltered = sponsorPayments.filter(p => p.sponsor_id === sponsor.id);
                const totalPaid = sponsorPaymentsFiltered.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);

                return (
                  <div key={sponsor.id} className={`bg-white rounded-xl shadow-sm border ${sponsor.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'} overflow-hidden`}>
                    <div className="p-5 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            sponsor.type === 'sponsor' ? 'bg-blue-100 text-blue-700' :
                            sponsor.type === 'court_ad' ? 'bg-amber-100 text-amber-700' :
                            sponsor.type === 'outdoor' ? 'bg-green-100 text-green-700' :
                            sponsor.type === 'digital' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {sponsorTypes.find(st => st.value === sponsor.type)?.label || sponsor.type}
                          </span>
                          {!sponsor.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{sponsor.name}</h3>
                        {sponsor.description && <p className="text-sm text-gray-600 mt-1">{sponsor.description}</p>}
                        {sponsor.location && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {sponsor.location}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                          {sponsor.contract_start && (
                            <span className="text-gray-500">
                              Start: {new Date(sponsor.contract_start).toLocaleDateString()}
                            </span>
                          )}
                          {sponsor.contract_end && (
                            <span className="text-gray-500">
                              End: {new Date(sponsor.contract_end).toLocaleDateString()}
                            </span>
                          )}
                          <span className="text-gray-500">
                            {paymentFrequencies.find(pf => pf.value === sponsor.payment_frequency)?.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(sponsor.monthly_value)}/mo</div>
                        {sponsor.total_value > 0 && (
                          <div className="text-sm text-gray-500">Contract: {formatCurrency(sponsor.total_value)}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">Paid: {formatCurrency(totalPaid)}</div>
                        <div className="flex gap-2 mt-3 justify-end">
                          <button
                            onClick={() => {
                              setSelectedSponsorForPayment(sponsor);
                              setPaymentForm({ ...paymentForm, amount: sponsor.monthly_value });
                              setShowPaymentForm(true);
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          >
                            + Payment
                          </button>
                          <button
                            onClick={() => handleEditSponsor(sponsor)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSponsor(sponsor.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {sponsorPaymentsFiltered.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Payments</h4>
                        <div className="space-y-1">
                          {sponsorPaymentsFiltered.slice(0, 3).map(payment => (
                            <div key={payment.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                {new Date(payment.payment_date).toLocaleDateString()}
                                {payment.reference_period && ` - ${payment.reference_period}`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                  payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {payment.status}
                                </span>
                                <span className="font-medium text-gray-900">{formatCurrency(Number(payment.amount))}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showSponsorForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSponsor ? 'Edit Sponsor' : 'Add Sponsor'}
              </h2>
              <button onClick={() => { setShowSponsorForm(false); setEditingSponsor(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSponsor} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={sponsorForm.name}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={sponsorForm.type}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {sponsorTypes.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={sponsorForm.location}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Court 1, Main entrance"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={sponsorForm.description}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Start</label>
                  <input
                    type="date"
                    value={sponsorForm.contract_start}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, contract_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
                  <input
                    type="date"
                    value={sponsorForm.contract_end}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, contract_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Value (EUR)</label>
                  <input
                    type="number"
                    value={sponsorForm.monthly_value}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, monthly_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Contract Value (EUR)</label>
                  <input
                    type="number"
                    value={sponsorForm.total_value}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, total_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Frequency</label>
                  <select
                    value={sponsorForm.payment_frequency}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, payment_frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {paymentFrequencies.map(pf => (
                      <option key={pf.value} value={pf.value}>{pf.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={sponsorForm.contact_name}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={sponsorForm.contact_email}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={sponsorForm.contact_phone}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={sponsorForm.notes}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowSponsorForm(false); setEditingSponsor(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common?.cancel || 'Cancel'}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : (t.common?.save || 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentForm && selectedSponsorForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Payment</h2>
              <button onClick={() => { setShowPaymentForm(false); setSelectedSponsorForPayment(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-800">{selectedSponsorForPayment.name}</div>
                <div className="text-xs text-blue-600">Monthly value: {formatCurrency(selectedSponsorForPayment.monthly_value)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EUR) *</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Period</label>
                <input
                  type="text"
                  value={paymentForm.reference_period}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_period: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jan 2026, Q1 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={paymentForm.status}
                  onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPaymentForm(false); setSelectedSponsorForPayment(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  {t.common?.cancel || 'Cancel'}
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  {saving ? (t.message?.saving || 'Saving...') : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
