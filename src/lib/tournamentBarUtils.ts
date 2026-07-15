import { supabase } from './supabase';

export interface TournamentPlayerInfo {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  payment_status: string;
  category_name: string | null;
  is_member: boolean;
  is_staff: boolean;
  plan_name: string | null;
  discount_percent: number;
  final_price: number;
}

export interface TournamentDetails {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  format: string;
  registration_fee: number;
  member_price: number | null;
  non_member_price: number | null;
  allow_club_payment: boolean;
  club_id: string | null;
  players: TournamentPlayerInfo[];
}

export interface TournamentListItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  player_count: number;
}

export function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\s+/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function resolveClubId(clubOwnerId: string, clubId?: string | null): Promise<string | null> {
  if (clubId) return clubId;

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id')
    .eq('owner_id', clubOwnerId)
    .limit(1)
    .maybeSingle();

  if (clubError && clubError.code !== 'PGRST116') throw clubError;
  return club?.id ?? null;
}

export async function fetchClubTournaments(
  clubOwnerId: string,
  clubId?: string | null,
): Promise<TournamentListItem[]> {
  const resolvedClubId = await resolveClubId(clubOwnerId, clubId);
  if (!resolvedClubId) return [];

  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_club_tournaments_for_bar', {
    p_club_id: resolvedClubId,
  });

  if (!rpcError && rpcRows) {
    return (rpcRows as Array<Record<string, unknown>>).map(row => ({
      id: row.id as string,
      name: row.name as string,
      start_date: row.start_date as string,
      end_date: row.end_date as string,
      status: row.status as string,
      player_count: Number(row.player_count) || 0,
    }));
  }

  if (rpcError && rpcError.code !== 'PGRST202') {
    console.warn('[TournamentBar] RPC unavailable, falling back to direct query:', rpcError.message);
  }

  const { data: tournaments, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status')
    .eq('club_id', resolvedClubId)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false })
    .limit(50);

  if (tError) throw tError;
  if (!tournaments?.length) return [];

  const ids = tournaments.map(t => t.id);
  const { data: players, error: pError } = await supabase
    .from('players')
    .select('tournament_id')
    .in('tournament_id', ids);

  if (pError) throw pError;

  const countMap = new Map<string, number>();
  ids.forEach(id => countMap.set(id, 0));
  (players || []).forEach(p => {
    countMap.set(p.tournament_id, (countMap.get(p.tournament_id) || 0) + 1);
  });

  return tournaments.map(t => ({
    ...t,
    player_count: countMap.get(t.id) || 0,
  }));
}

export async function loadTournamentDetails(
  tournamentId: string,
  clubOwnerId: string,
): Promise<TournamentDetails | null> {
  let tournament: Record<string, unknown> | null = null;

  const { data: fullTournament, error: fullError } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, format, registration_fee, member_price, non_member_price, allow_club_payment, club_id')
    .eq('id', tournamentId)
    .maybeSingle();

  if (fullError?.code === '42703') {
    const { data: basicTournament } = await supabase
      .from('tournaments')
      .select('id, name, start_date, end_date, status, format, registration_fee, club_id')
      .eq('id', tournamentId)
      .maybeSingle();
    if (basicTournament) {
      tournament = { ...basicTournament, member_price: null, non_member_price: null, allow_club_payment: false };
    }
  } else {
    tournament = fullTournament;
  }

  if (!tournament) return null;

  const { data: players } = await supabase
    .from('players')
    .select('id, name, phone_number, email, payment_status, category_id')
    .eq('tournament_id', tournamentId)
    .order('name');

  let categories: Array<Record<string, unknown>> | null = null;
  const { data: fullCategories, error: catError } = await supabase
    .from('tournament_categories')
    .select('id, name, member_price, non_member_price, registration_fee')
    .eq('tournament_id', tournamentId);

  if (catError?.code === '42703') {
    const { data: basicCategories } = await supabase
      .from('tournament_categories')
      .select('id, name, registration_fee')
      .eq('tournament_id', tournamentId);
    categories = (basicCategories || []).map(c => ({ ...c, member_price: null, non_member_price: null }));
  } else {
    categories = fullCategories;
  }

  const { data: memberSubs } = await supabase
    .from('member_subscriptions')
    .select('member_name, member_phone, plan:membership_plans(name, court_discount_percent, tournament_discount_percent)')
    .eq('club_owner_id', clubOwnerId)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString().split('T')[0]);

  const memberMap = new Map<string, { tournamentDiscount: number; planName: string }>();
  (memberSubs || []).forEach((sub: Record<string, unknown>) => {
    const plan = sub.plan as { name?: string; tournament_discount_percent?: number } | null;
    const phone = normalizePhone((sub.member_phone as string) || '');
    const name = ((sub.member_name as string) || '').toLowerCase().trim();
    const tournamentDiscount = plan?.tournament_discount_percent || 0;
    const planName = plan?.name || '';
    if (phone) memberMap.set(phone, { tournamentDiscount, planName });
    if (name) memberMap.set(name, { tournamentDiscount, planName });
  });

  const categoryMap = new Map<string, Record<string, unknown>>();
  (categories || []).forEach(c => categoryMap.set(c.id as string, c));

  const tournRegFee = Number(tournament.registration_fee) || 0;
  const tournMemberPrice = Number(tournament.member_price) || 0;
  const tournNonMemberPrice = Number(tournament.non_member_price) || 0;

  const playerInfos: TournamentPlayerInfo[] = (players || []).map(p => {
    const phone = normalizePhone(p.phone_number || '');
    const name = (p.name || '').toLowerCase().trim();
    const memberInfo = memberMap.get(phone) || memberMap.get(name);
    const isMember = !!memberInfo;
    const planName = memberInfo?.planName || null;
    const tournamentDiscountPercent = memberInfo?.tournamentDiscount || 0;
    const isStaff = isMember && planName ? planName.toLowerCase().includes('staff') : false;

    const category = p.category_id ? categoryMap.get(p.category_id) : null;
    const catRegFee = Number(category?.registration_fee) || 0;
    const catMemberPrice = Number(category?.member_price) || 0;
    const catNonMemberPrice = Number(category?.non_member_price) || 0;

    let basePrice = 0;
    if (isStaff) {
      basePrice = 0;
    } else if (isMember) {
      basePrice = catMemberPrice > 0 ? catMemberPrice
        : tournMemberPrice > 0 ? tournMemberPrice
        : catRegFee > 0 ? catRegFee : tournRegFee;
    } else {
      basePrice = catNonMemberPrice > 0 ? catNonMemberPrice
        : tournNonMemberPrice > 0 ? tournNonMemberPrice
        : catRegFee > 0 ? catRegFee : tournRegFee;
    }

    const usedMemberSpecificPrice = isMember && !isStaff && (catMemberPrice > 0 || tournMemberPrice > 0);
    const finalPrice = !isStaff && isMember && tournamentDiscountPercent > 0 && !usedMemberSpecificPrice
      ? basePrice * (1 - tournamentDiscountPercent / 100)
      : basePrice;

    return {
      id: p.id,
      name: p.name,
      phone_number: p.phone_number,
      email: p.email,
      payment_status: isStaff ? 'exempt' : (p.payment_status || 'pending'),
      category_name: (category?.name as string) || null,
      is_member: isMember,
      is_staff: isStaff,
      plan_name: planName,
      discount_percent: tournamentDiscountPercent,
      final_price: Math.round(finalPrice * 100) / 100,
    };
  });

  return {
    id: tournament.id as string,
    name: tournament.name as string,
    start_date: tournament.start_date as string,
    end_date: tournament.end_date as string,
    status: tournament.status as string,
    format: (tournament.format as string) || '',
    registration_fee: tournRegFee,
    member_price: tournament.member_price as number | null,
    non_member_price: tournament.non_member_price as number | null,
    allow_club_payment: !!(tournament.allow_club_payment),
    club_id: (tournament.club_id as string) || null,
    players: playerInfos,
  };
}

export async function openBarTabsForTournament(
  tournament: TournamentDetails,
  clubOwnerId: string,
): Promise<{ created: number; skipped: boolean }> {
  if (tournament.players.length === 0) {
    return { created: 0, skipped: true };
  }

  const { data: existingTabs } = await supabase
    .from('bar_tabs')
    .select('player_name')
    .eq('club_owner_id', clubOwnerId)
    .eq('tournament_id', tournament.id);

  const existingNames = new Set((existingTabs || []).map(t => t.player_name.toLowerCase()));
  const newPlayers = tournament.players.filter(p => !existingNames.has(p.name.toLowerCase()));

  if (newPlayers.length === 0) {
    return { created: 0, skipped: true };
  }

  const tabsToCreate = await Promise.all(newPlayers.map(async (p) => {
    let playerAccountId: string | null = null;
    if (p.phone_number) {
      const normalizedPhone = normalizePhone(p.phone_number);
      const { data: existingAccount } = await supabase
        .from('player_accounts')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();
      playerAccountId = existingAccount?.id || null;
    }

    return {
      club_owner_id: clubOwnerId,
      player_name: p.name,
      player_phone: p.phone_number || null,
      player_account_id: playerAccountId,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
    };
  }));

  const { error } = await supabase.from('bar_tabs').insert(tabsToCreate);
  if (error) throw error;

  return { created: newPlayers.length, skipped: false };
}
