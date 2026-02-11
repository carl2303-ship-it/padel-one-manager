import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { useAuth } from '../lib/authContext';
import {
  Plus,
  X,
  Users,
  Edit2,
  Trash2,
  Check,
  Award,
  Mail,
  Phone,
  User,
  Trophy,
  Eye,
  Calendar,
  Medal,
  Filter
} from 'lucide-react';

interface MembershipPlan {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  benefits: string[];
  court_discount_percent: number;
  bar_discount_percent: number;
  academy_discount_percent: number;
  is_active: boolean;
}

interface Subscription {
  id: string;
  user_id: string;
  member_name: string | null;
  member_email: string | null;
  member_phone: string | null;
  start_date: string;
  end_date: string;
  status: string;
  amount_paid: number;
  notes: string | null;
  plan: MembershipPlan;
  plan_id: string;
  // Player account data (if available)
  player_account?: {
    birth_date: string | null;
    gender: 'male' | 'female' | 'other' | null;
  } | null;
}

interface TournamentPlayer {
  id: string;
  name: string;
  email: string | null;
  phone_number: string;
  tournament_count?: number;
}

interface TournamentHistory {
  tournament_id: string;
  tournament_name: string;
  start_date: string;
  end_date: string;
  category_name: string | null;
  final_position: number | null;
  payment_status: string | null;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

interface MemberManagementProps {
  staffClubOwnerId?: string | null;
}

export default function MemberManagement({ staffClubOwnerId }: MemberManagementProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const effectiveUserId = staffClubOwnerId || user?.id;
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans'>('subscriptions');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerMatch, setPlayerMatch] = useState<TournamentPlayer | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Subscription | null>(null);
  const [tournamentHistory, setTournamentHistory] = useState<TournamentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Open game players from transactions
  interface OpenGamePlayerInfo {
    player_name: string;
    player_phone: string;
    total_spent: number;
    games_count: number;
    last_game_date: string;
  }
  const [openGamePlayers, setOpenGamePlayers] = useState<OpenGamePlayerInfo[]>([]);

  // Tournament players from transactions
  interface TournamentPlayerInfo {
    player_name: string;
    player_phone: string;
    total_spent: number;
    tournament_count: number;
    last_tournament_date: string;
    tournament_names: string[];
  }
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayerInfo[]>([]);

  // Filters
  const [filterMemberType, setFilterMemberType] = useState<'all' | 'members' | 'gold'>('all');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');

  const [planForm, setPlanForm] = useState({
    name: '',
    duration_months: 1,
    price: 50,
    benefits: '',
    court_discount_percent: 10,
    bar_discount_percent: 0,
    academy_discount_percent: 0,
    is_active: true
  });

  const [subscriptionForm, setSubscriptionForm] = useState({
    plan_id: '',
    member_name: '',
    member_email: '',
    member_phone: '',
    amount_paid: 0,
    notes: '',
    status: 'active',
    start_date: ''
  });

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  const loadData = async () => {
    if (!effectiveUserId) return;

    const [plansResult, subscriptionsResult] = await Promise.all([
      supabase
        .from('membership_plans')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('price'),
      supabase
        .from('member_subscriptions')
        .select(`
          *,
          plan:membership_plans(*)
        `)
        .eq('club_owner_id', effectiveUserId)
        .order('created_at', { ascending: false })
    ]);

    if (plansResult.data) {
      setPlans(plansResult.data);
    }
    
    if (subscriptionsResult.data) {
      // Fetch player_accounts data for each subscription (by phone)
      const subscriptionsWithPlayerData = await Promise.all(
        (subscriptionsResult.data as any[]).map(async (sub) => {
          if (!sub.member_phone) return { ...sub, player_account: null };
          
          const normalizedPhone = normalizePhone(sub.member_phone);
          const { data: playerAccount } = await supabase
            .from('player_accounts')
            .select('birth_date, gender')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();
          
          return { ...sub, player_account: playerAccount || null };
        })
      );
      
      setSubscriptions(subscriptionsWithPlayerData as unknown as Subscription[]);
    }

    // Load open game players from player_transactions
    const { data: transactions } = await supabase
      .from('player_transactions')
      .select('player_name, player_phone, amount, transaction_date')
      .eq('club_owner_id', effectiveUserId)
      .eq('transaction_type', 'open_game')
      .order('transaction_date', { ascending: false });

    if (transactions && transactions.length > 0) {
      // Aggregate by player
      const playerMap = new Map<string, OpenGamePlayerInfo>();
      transactions.forEach(tx => {
        const key = tx.player_phone || tx.player_name.toLowerCase();
        const existing = playerMap.get(key);
        if (existing) {
          existing.total_spent += Number(tx.amount);
          existing.games_count += 1;
          if (tx.transaction_date > existing.last_game_date) {
            existing.last_game_date = tx.transaction_date;
          }
        } else {
          playerMap.set(key, {
            player_name: tx.player_name,
            player_phone: tx.player_phone,
            total_spent: Number(tx.amount),
            games_count: 1,
            last_game_date: tx.transaction_date
          });
        }
      });

      // Filter out players that already have member_subscriptions
      const memberPhones = new Set(
        (subscriptionsResult.data || [])
          .map((s: any) => s.member_phone ? normalizePhone(s.member_phone) : null)
          .filter(Boolean)
      );

      const nonMemberPlayers = Array.from(playerMap.values()).filter(
        p => !memberPhones.has(p.player_phone)
      );

      setOpenGamePlayers(nonMemberPlayers);
    } else {
      setOpenGamePlayers([]);
    }

    // Load tournament players from player_transactions
    const { data: tournamentTx } = await supabase
      .from('player_transactions')
      .select('player_name, player_phone, amount, transaction_date, notes')
      .eq('club_owner_id', effectiveUserId)
      .eq('reference_type', 'tournament')
      .order('transaction_date', { ascending: false });

    if (tournamentTx && tournamentTx.length > 0) {
      const tournamentPlayerMap = new Map<string, TournamentPlayerInfo>();
      tournamentTx.forEach(tx => {
        const key = tx.player_phone || tx.player_name.toLowerCase();
        const existing = tournamentPlayerMap.get(key);
        const tournamentName = tx.notes?.replace(/^Torneio:\s*/, '').split(' - ')[0] || '';
        if (existing) {
          existing.total_spent += Number(tx.amount);
          existing.tournament_count += 1;
          if (tx.transaction_date > existing.last_tournament_date) {
            existing.last_tournament_date = tx.transaction_date;
          }
          if (tournamentName && !existing.tournament_names.includes(tournamentName)) {
            existing.tournament_names.push(tournamentName);
          }
        } else {
          tournamentPlayerMap.set(key, {
            player_name: tx.player_name,
            player_phone: tx.player_phone,
            total_spent: Number(tx.amount),
            tournament_count: 1,
            last_tournament_date: tx.transaction_date,
            tournament_names: tournamentName ? [tournamentName] : []
          });
        }
      });

      // Filter out players that are already members
      const memberPhoneSet = new Set(
        (subscriptionsResult.data || [])
          .map((s: any) => s.member_phone ? normalizePhone(s.member_phone) : null)
          .filter(Boolean)
      );

      const nonMemberTournamentPlayers = Array.from(tournamentPlayerMap.values()).filter(
        p => !memberPhoneSet.has(p.player_phone)
      );

      setTournamentPlayers(nonMemberTournamentPlayers);
    } else {
      setTournamentPlayers([]);
    }

    setLoading(false);
  };

  // Filter subscriptions based on filters
  const getFilteredSubscriptions = () => {
    let filtered = subscriptions;

    // Filter by member type
    if (filterMemberType === 'members') {
      filtered = filtered.filter(sub => sub.status === 'active');
    } else if (filterMemberType === 'gold') {
      filtered = filtered.filter(sub => 
        sub.status === 'active' && 
        sub.plan.name.toLowerCase().includes('gold')
      );
    }

    // Filter by age
    if (filterAge !== 'all') {
      const now = new Date();
      filtered = filtered.filter(sub => {
        if (!sub.player_account?.birth_date) return false;
        const birthDate = new Date(sub.player_account.birth_date);
        const age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate()) ? age - 1 : age;
        
        switch (filterAge) {
          case 'under18': return actualAge < 18;
          case '18-25': return actualAge >= 18 && actualAge <= 25;
          case '26-35': return actualAge >= 26 && actualAge <= 35;
          case '36-45': return actualAge >= 36 && actualAge <= 45;
          case 'over45': return actualAge > 45;
          default: return true;
        }
      });
    }

    // Filter by gender
    if (filterGender !== 'all') {
      filtered = filtered.filter(sub => {
        if (!sub.player_account?.gender) return false;
        return sub.player_account.gender === filterGender;
      });
    }

    return filtered;
  };

  const loadTournamentHistory = async (member: Subscription) => {
    setSelectedMember(member);
    setLoadingHistory(true);
    setTournamentHistory([]);

    if (!member.member_phone) {
      setLoadingHistory(false);
      return;
    }

    const normalizedPhone = normalizePhone(member.member_phone);

    const { data: players } = await supabase
      .from('players')
      .select(`
        id,
        tournament_id,
        final_position,
        payment_status,
        category:tournament_categories(name),
        tournament:tournaments(id, name, start_date, end_date)
      `)
      .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${member.member_phone}`)
      .order('created_at', { ascending: false });

    if (players && players.length > 0) {
      const history: TournamentHistory[] = players
        .filter(p => p.tournament)
        .map(p => {
          const tournament = p.tournament as { id: string; name: string; start_date: string; end_date: string };
          const category = p.category as { name: string } | null;
          return {
            tournament_id: tournament.id,
            tournament_name: tournament.name,
            start_date: tournament.start_date,
            end_date: tournament.end_date,
            category_name: category?.name || null,
            final_position: p.final_position,
            payment_status: p.payment_status
          };
        });

      const uniqueHistory = history.filter((h, idx, arr) =>
        arr.findIndex(item => item.tournament_id === h.tournament_id) === idx
      );

      setTournamentHistory(uniqueHistory);
    }

    setLoadingHistory(false);
  };

  const checkPhoneForPlayer = async (phone: string) => {
    if (!phone || phone.length < 9) {
      setPlayerMatch(null);
      return;
    }

    setCheckingPhone(true);
    const normalizedPhone = normalizePhone(phone);

    const { data } = await supabase
      .from('players')
      .select('id, name, email, phone_number')
      .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${phone}`);

      setPlayerMatch({
        ...data,
        tournament_count: count || 0
      });

      if (!subscriptionForm.member_name && data.name) {
        setSubscriptionForm(f => ({ ...f, member_name: data.name }));
      }
      if (!subscriptionForm.member_email && data.email) {
        setSubscriptionForm(f => ({ ...f, member_email: data.email }));
      }
    } else {
      setPlayerMatch(null);
    }
    setCheckingPhone(false);
  };

  const handlePhoneChange = (phone: string) => {
    setSubscriptionForm({ ...subscriptionForm, member_phone: phone });
    if (phone.length >= 9) {
      checkPhoneForPlayer(phone);
    } else {
      setPlayerMatch(null);
    }
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    setSaving(true);
    const benefitsArray = planForm.benefits.split('\n').filter(b => b.trim());

    if (editingPlan) {
      await supabase
        .from('membership_plans')
        .update({
          name: planForm.name,
          duration_months: planForm.duration_months,
          price: planForm.price,
          benefits: benefitsArray,
          court_discount_percent: planForm.court_discount_percent,
          bar_discount_percent: planForm.bar_discount_percent,
          academy_discount_percent: planForm.academy_discount_percent,
          is_active: planForm.is_active
        })
        .eq('id', editingPlan.id);
    } else {
      await supabase
        .from('membership_plans')
        .insert({
          user_id: effectiveUserId,
          name: planForm.name,
          duration_months: planForm.duration_months,
          price: planForm.price,
          benefits: benefitsArray,
          court_discount_percent: planForm.court_discount_percent,
          bar_discount_percent: planForm.bar_discount_percent,
          academy_discount_percent: planForm.academy_discount_percent,
          is_active: planForm.is_active
        });
    }

    setShowPlanForm(false);
    setEditingPlan(null);
    resetPlanForm();
    loadData();
    setSaving(false);
  };

  const handleSubmitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId || !subscriptionForm.plan_id) return;

    if (!subscriptionForm.member_phone || !subscriptionForm.member_email) {
      alert(t.staff?.phoneEmailRequired || 'Phone and email are required');
      return;
    }

    setSaving(true);

    const selectedPlan = plans.find(p => p.id === subscriptionForm.plan_id);
    if (!selectedPlan) {
      setSaving(false);
      return;
    }

    if (editingSubscription) {
      const updateData: any = {
        plan_id: subscriptionForm.plan_id,
        member_name: subscriptionForm.member_name,
        member_email: subscriptionForm.member_email,
        member_phone: normalizePhone(subscriptionForm.member_phone),
        amount_paid: subscriptionForm.amount_paid || selectedPlan.price,
        status: subscriptionForm.status,
        notes: subscriptionForm.notes || null
      };

      if (subscriptionForm.start_date) {
        updateData.start_date = subscriptionForm.start_date;
        const startDate = new Date(subscriptionForm.start_date);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months);
        updateData.end_date = endDate.toISOString().split('T')[0];
      }

      await supabase
        .from('member_subscriptions')
        .update(updateData)
        .eq('id', editingSubscription.id);
    } else {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months);

      await supabase
        .from('member_subscriptions')
        .insert({
          club_owner_id: effectiveUserId,
          user_id: effectiveUserId,
          plan_id: subscriptionForm.plan_id,
          member_name: subscriptionForm.member_name,
          member_email: subscriptionForm.member_email,
          member_phone: normalizePhone(subscriptionForm.member_phone),
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          amount_paid: subscriptionForm.amount_paid || selectedPlan.price,
          status: 'active',
          notes: subscriptionForm.notes || null
        });
    }

    setShowSubscriptionForm(false);
    setEditingSubscription(null);
    setPlayerMatch(null);
    resetSubscriptionForm();
    loadData();
    setSaving(false);
  };

  const handleEditSubscription = (sub: Subscription) => {
    setEditingSubscription(sub);
    setSubscriptionForm({
      plan_id: sub.plan_id || sub.plan?.id || '',
      member_name: sub.member_name || '',
      member_email: sub.member_email || '',
      member_phone: sub.member_phone || '',
      amount_paid: sub.amount_paid,
      status: sub.status,
      start_date: sub.start_date ? sub.start_date.split('T')[0] : '',
      notes: sub.notes || ''
    });
    setShowSubscriptionForm(true);
    if (sub.member_phone) {
      checkPhoneForPlayer(sub.member_phone);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('membership_plans').delete().eq('id', planId);
    loadData();
  };

  const handleDeleteSubscription = async (subId: string) => {
    if (!confirm(t.message.confirmDelete)) return;
    await supabase.from('member_subscriptions').delete().eq('id', subId);
    loadData();
  };

  const handleEditPlan = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      duration_months: plan.duration_months,
      price: plan.price,
      benefits: (plan.benefits || []).join('\n'),
      court_discount_percent: plan.court_discount_percent,
      bar_discount_percent: plan.bar_discount_percent || 0,
      academy_discount_percent: plan.academy_discount_percent || 0,
      is_active: plan.is_active
    });
    setShowPlanForm(true);
  };

  const resetPlanForm = () => {
    setPlanForm({
      name: '',
      duration_months: 1,
      price: 50,
      benefits: '',
      court_discount_percent: 10,
      bar_discount_percent: 0,
      academy_discount_percent: 0,
      is_active: true
    });
  };

  const resetSubscriptionForm = () => {
    setSubscriptionForm({
      plan_id: '',
      member_name: '',
      member_email: '',
      member_phone: '',
      amount_paid: 0,
      status: 'active',
      start_date: '',
      notes: ''
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'expired':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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
        <h1 className="text-2xl font-bold text-gray-900">{t.members.title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'subscriptions' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.members.subscriptions}
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === 'plans' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              {t.members.plans}
            </button>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'plans') {
                resetPlanForm();
                setEditingPlan(null);
                setShowPlanForm(true);
              } else {
                resetSubscriptionForm();
                setEditingSubscription(null);
                setPlayerMatch(null);
                setShowSubscriptionForm(true);
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'plans' ? t.members.addPlan : t.members.addMember}
          </button>
        </div>
      </div>

      {activeTab === 'subscriptions' ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtros:</span>
              </div>
              
              {/* Member Type Filter */}
              <select
                value={filterMemberType}
                onChange={(e) => setFilterMemberType(e.target.value as 'all' | 'members' | 'gold')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="members">Membros</option>
                <option value="gold">Membros Gold</option>
              </select>

              {/* Age Filter */}
              <select
                value={filterAge}
                onChange={(e) => setFilterAge(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as idades</option>
                <option value="under18">Menos de 18</option>
                <option value="18-25">18-25 anos</option>
                <option value="26-35">26-35 anos</option>
                <option value="36-45">36-45 anos</option>
                <option value="over45">Mais de 45</option>
              </select>

              {/* Gender Filter */}
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value as 'all' | 'male' | 'female')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os géneros</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>

              {/* Reset filters */}
              {(filterMemberType !== 'all' || filterAge !== 'all' || filterGender !== 'all') && (
                <button
                  onClick={() => {
                    setFilterMemberType('all');
                    setFilterAge('all');
                    setFilterGender('all');
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {getFilteredSubscriptions().length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.members.noMembers}</h3>
            <p className="text-gray-500 mb-6">{t.members.addFirst}</p>
            {plans.length > 0 && (
              <button
                onClick={() => setShowSubscriptionForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                {t.members.addMember}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members.name}</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members.phone}</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">{t.members.plan}</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members.expiresOn}</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.members.status}</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredSubscriptions().map(sub => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{sub.member_name || 'N/A'}</div>
                        {sub.member_email && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {sub.member_email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.member_phone ? (
                          <a href={`tel:${sub.member_phone}`} className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {sub.member_phone}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="font-medium text-gray-900">{sub.plan?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{sub.amount_paid} EUR</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(sub.end_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(sub.status)}`}>
                          {t.members[sub.status as keyof typeof t.members] || sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => loadTournamentHistory(sub)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditSubscription(sub)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubscription(sub.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

          {/* Open Game Players (non-members) */}
          {openGamePlayers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-emerald-50">
                <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
                  🎾 Jogadores de Jogos Abertos
                  <span className="text-sm font-normal text-emerald-600">
                    ({openGamePlayers.length} jogadores)
                  </span>
                </h2>
                <p className="text-xs text-emerald-600 mt-1">
                  Jogadores que participaram em jogos abertos mas não são membros do clube
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Nome</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Telefone</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Jogos</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Total Gasto</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Último Jogo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {openGamePlayers.map((player, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold">
                              {player.player_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {player.player_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a href={`tel:${player.player_phone}`} className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {player.player_phone}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-sm font-medium">
                            🎾 {player.games_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-emerald-600 font-medium">
                            {player.total_spent.toFixed(2)} EUR
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {new Date(player.last_game_date).toLocaleDateString('pt-PT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tournament Players (non-members) */}
          {tournamentPlayers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-amber-50">
                <h2 className="font-semibold text-amber-800 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" />
                  Jogadores de Torneios
                  <span className="text-sm font-normal text-amber-600">
                    ({tournamentPlayers.length} jogadores)
                  </span>
                </h2>
                <p className="text-xs text-amber-600 mt-1">
                  Jogadores que pagaram inscrição em torneios mas não são membros do clube
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Nome</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Telefone</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Torneios</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Pagamentos</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Total Gasto</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Último</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tournamentPlayers.map((player, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold">
                              {player.player_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {player.player_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a href={`tel:${player.player_phone}`} className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {player.player_phone}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {player.tournament_names.slice(0, 2).map((name, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium truncate max-w-[120px]" title={name}>
                                {name}
                              </span>
                            ))}
                            {player.tournament_names.length > 2 && (
                              <span className="text-[10px] text-amber-500">+{player.tournament_names.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-sm font-medium">
                            {player.tournament_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-amber-600 font-medium">
                            {player.total_spent.toFixed(2)} EUR
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {new Date(player.last_tournament_date).toLocaleDateString('pt-PT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        plans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.members.noMembers}</h3>
            <p className="text-gray-500 mb-6">{t.members.addFirst}</p>
            <button
              onClick={() => setShowPlanForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              {t.members.addPlan}
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  plan.is_active ? 'border-gray-100' : 'border-red-100'
                }`}
              >
                <div className={`p-4 ${plan.is_active ? 'bg-emerald-600' : 'bg-gray-400'}`}>
                  <div className="flex items-center justify-between text-white">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-sm opacity-80">{plan.duration_months} {plan.duration_months === 1 ? 'month' : 'months'}</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{plan.price} EUR</div>
                    <div className="text-sm text-gray-500">/ {plan.duration_months} {plan.duration_months === 1 ? 'month' : 'months'}</div>
                  </div>
                  {(plan.court_discount_percent > 0 || plan.bar_discount_percent > 0 || plan.academy_discount_percent > 0) && (
                    <div className="bg-emerald-50 text-emerald-700 text-sm px-3 py-2 rounded-lg space-y-1">
                      {plan.court_discount_percent > 0 && (
                        <div className="flex justify-between">
                          <span>{t.courts?.title || 'Courts'}</span>
                          <span className="font-medium">{plan.court_discount_percent}%</span>
                        </div>
                      )}
                      {plan.bar_discount_percent > 0 && (
                        <div className="flex justify-between">
                          <span>{t.bar?.title || 'Bar'}</span>
                          <span className="font-medium">{plan.bar_discount_percent}%</span>
                        </div>
                      )}
                      {plan.academy_discount_percent > 0 && (
                        <div className="flex justify-between">
                          <span>{t.academy?.title || 'Academy'}</span>
                          <span className="font-medium">{plan.academy_discount_percent}%</span>
                        </div>
                      )}
                    </div>
                  )}
                  {plan.benefits && plan.benefits.length > 0 && (
                    <ul className="space-y-2 text-sm text-gray-600">
                      {plan.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showPlanForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPlan ? t.common.edit : t.members.addPlan}
              </h2>
              <button onClick={() => { setShowPlanForm(false); setEditingPlan(null); resetPlanForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPlan} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.planName}</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Monthly Plan"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.duration}</label>
                  <select
                    value={planForm.duration_months}
                    onChange={(e) => setPlanForm({ ...planForm, duration_months: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>1 month</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.price} (EUR)</label>
                  <input
                    type="number"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">{t.members?.discounts || 'Discounts'} (%)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t.courts?.title || 'Courts'}</label>
                    <input
                      type="number"
                      value={planForm.court_discount_percent}
                      onChange={(e) => setPlanForm({ ...planForm, court_discount_percent: e.target.valueAsNumber || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t.bar?.title || 'Bar'}</label>
                    <input
                      type="number"
                      value={planForm.bar_discount_percent}
                      onChange={(e) => setPlanForm({ ...planForm, bar_discount_percent: e.target.valueAsNumber || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t.academy?.title || 'Academy'}</label>
                    <input
                      type="number"
                      value={planForm.academy_discount_percent}
                      onChange={(e) => setPlanForm({ ...planForm, academy_discount_percent: e.target.valueAsNumber || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.benefits} (one per line)</label>
                <textarea
                  value={planForm.benefits}
                  onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Free court booking&#10;Priority scheduling&#10;Guest passes"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="plan_active"
                  checked={planForm.is_active}
                  onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="plan_active" className="text-sm text-gray-700">{t.members.active}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPlanForm(false); setEditingPlan(null); resetPlanForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? t.message.saving : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubscriptionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSubscription ? t.common.edit : t.members.addMember}
              </h2>
              <button onClick={() => { setShowSubscriptionForm(false); setEditingSubscription(null); setPlayerMatch(null); resetSubscriptionForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitSubscription} className="p-4 space-y-4">
              {plans.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-4">You need to create a membership plan first.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubscriptionForm(false);
                      setActiveTab('plans');
                      setShowPlanForm(true);
                    }}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Create a plan
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.members.phone} * <span className="text-xs text-gray-500">(ID)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={subscriptionForm.member_phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+351 912 345 678"
                        required
                      />
                      {checkingPhone && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>

                  {playerMatch && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Trophy className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            {t.staff?.playerFound || 'Player found in tournaments!'}
                          </p>
                          <p className="text-sm text-green-700">
                            {playerMatch.name} - {playerMatch.tournament_count} {t.staff?.tournaments || 'tournaments'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.email} *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={subscriptionForm.member_email}
                        onChange={(e) => setSubscriptionForm({ ...subscriptionForm, member_email: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="member@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.name} *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={subscriptionForm.member_name}
                        onChange={(e) => setSubscriptionForm({ ...subscriptionForm, member_name: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.plan} *</label>
                    <select
                      value={subscriptionForm.plan_id}
                      onChange={(e) => {
                        const plan = plans.find(p => p.id === e.target.value);
                        setSubscriptionForm({
                          ...subscriptionForm,
                          plan_id: e.target.value,
                          amount_paid: plan?.price || 0
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a plan</option>
                      {plans.filter(p => p.is_active).map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - {plan.price} EUR / {plan.duration_months} {plan.duration_months === 1 ? 'month' : 'months'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.price} (EUR)</label>
                      <input
                        type="number"
                        value={subscriptionForm.amount_paid}
                        onChange={(e) => setSubscriptionForm({ ...subscriptionForm, amount_paid: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {editingSubscription && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.members.status}</label>
                        <select
                          value={subscriptionForm.status}
                          onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="active">{t.members.active || 'Active'}</option>
                          <option value="expired">{t.members.expired || 'Expired'}</option>
                          <option value="cancelled">{t.members.cancelled || 'Cancelled'}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {editingSubscription && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.members?.startDate || 'Start Date'}</label>
                      <input
                        type="date"
                        value={subscriptionForm.start_date}
                        onChange={(e) => setSubscriptionForm({ ...subscriptionForm, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t.members?.startDateHelp || 'Changing start date will recalculate the end date based on plan duration'}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.members?.notes || 'Notes'}</label>
                    <textarea
                      value={subscriptionForm.notes}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder={t.members?.notesPlaceholder || 'Additional notes about this member...'}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowSubscriptionForm(false); setEditingSubscription(null); setPlayerMatch(null); resetSubscriptionForm(); }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !subscriptionForm.plan_id || !subscriptionForm.member_phone || !subscriptionForm.member_email}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {saving ? t.message.saving : t.common.save}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Member Details</h2>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setTournamentHistory([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{selectedMember.member_name || 'N/A'}</h3>
                    <div className="mt-2 space-y-1">
                      {selectedMember.member_email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {selectedMember.member_email}
                        </div>
                      )}
                      {selectedMember.member_phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {selectedMember.member_phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedMember.status)}`}>
                    {t.members[selectedMember.status as keyof typeof t.members] || selectedMember.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Plan</div>
                  <div className="font-semibold text-gray-900">{selectedMember.plan?.name || 'N/A'}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Amount Paid</div>
                  <div className="font-semibold text-emerald-600">{selectedMember.amount_paid} EUR</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Start Date</div>
                  <div className="font-semibold text-gray-900">{formatDate(selectedMember.start_date)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Expires</div>
                  <div className="font-semibold text-gray-900">{formatDate(selectedMember.end_date)}</div>
                </div>
              </div>

              {selectedMember.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <div className="text-sm font-medium text-amber-800 mb-1">Notes</div>
                  <p className="text-sm text-amber-700">{selectedMember.notes}</p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-amber-600" />
                  Tournament History
                </h3>

                {loadingHistory ? (
                  <div className="text-center py-8 text-gray-500">Loading tournament history...</div>
                ) : tournamentHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No tournament participation found</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Tournaments are matched by phone number
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tournamentHistory.map((tournament) => (
                      <div
                        key={tournament.tournament_id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Trophy className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{tournament.tournament_name}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(tournament.start_date).toLocaleDateString()}
                            </span>
                            {tournament.category_name && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                {tournament.category_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {tournament.final_position && (
                            <div className="flex items-center gap-1">
                              <Medal className={`w-4 h-4 ${
                                tournament.final_position === 1 ? 'text-yellow-500' :
                                tournament.final_position === 2 ? 'text-gray-400' :
                                tournament.final_position === 3 ? 'text-amber-700' :
                                'text-gray-400'
                              }`} />
                              <span className={`font-bold ${
                                tournament.final_position === 1 ? 'text-yellow-600' :
                                tournament.final_position === 2 ? 'text-gray-500' :
                                tournament.final_position === 3 ? 'text-amber-700' :
                                'text-gray-600'
                              }`}>
                                #{tournament.final_position}
                              </span>
                            </div>
                          )}
                          {tournament.payment_status && (
                            <span className={`text-xs ${
                              tournament.payment_status === 'paid' ? 'text-emerald-600' :
                              tournament.payment_status === 'exempt' ? 'text-blue-600' :
                              'text-amber-600'
                            }`}>
                              {tournament.payment_status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-center pt-2">
                      <span className="text-xs text-gray-500">
                        {tournamentHistory.length} tournament{tournamentHistory.length !== 1 ? 's' : ''} found
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
