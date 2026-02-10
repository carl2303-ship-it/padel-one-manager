import { useEffect, useState } from 'react';
import { supabase, Tournament, Team, Player, Match, TournamentCategory } from '../lib/supabase';
import { useI18n } from '../lib/i18nContext';
import { ArrowLeft, Users, Calendar, Trophy, Plus, CreditCard as Edit, CalendarClock, Award, Link, Check, Trash2, FolderTree, Pencil, Clock, ChevronDown, Shuffle, Hand, FileDown } from 'lucide-react';
import AddTeamModal from './AddTeamModal';
import AddIndividualPlayerModal from './AddIndividualPlayerModal';
import MatchModal from './MatchModal';
import EditTournamentModal from './EditTournamentModal';
import EditTeamModal from './EditTeamModal';
import EditIndividualPlayerModal from './EditIndividualPlayerModal';
import Standings from './Standings';
import BracketView from './BracketView';
import ManageCategoriesModal from './ManageCategoriesModal';
import MatchScheduleView from './MatchScheduleView';
import { ManualGroupAssignmentModal } from './ManualGroupAssignmentModal';
import { generateTournamentSchedule } from '../lib/scheduler';
import { generateAmericanSchedule } from '../lib/americanScheduler';
import { generateIndividualGroupsKnockoutSchedule } from '../lib/individualGroupsKnockoutScheduler';
import { getTeamsByGroup, getPlayersByGroup } from '../lib/groups';
import { scheduleMultipleCategories } from '../lib/multiCategoryScheduler';
import { updateLeagueStandings } from '../lib/leagueStandings';
import { exportTournamentPDF } from '../lib/pdfExport';

type TournamentDetailProps = {
  tournament: Tournament;
  onBack: () => void;
};

type TeamWithPlayers = Team & {
  player1: Player;
  player2: Player;
};

type MatchWithTeams = Match & {
  team1: TeamWithPlayers | null;
  team2: TeamWithPlayers | null;
};

export default function TournamentDetail({ tournament, onBack }: TournamentDetailProps) {
  const { t, language } = useI18n();
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [individualPlayers, setIndividualPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'matches' | 'standings' | 'knockout'>('overview');
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showEditTournament, setShowEditTournament] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | undefined>();
  const [selectedTeam, setSelectedTeam] = useState<TeamWithPlayers | undefined>();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [showEditPlayer, setShowEditPlayer] = useState(false);
  const [currentTournament, setCurrentTournament] = useState<Tournament>(tournament);
  const [linkCopied, setLinkCopied] = useState(false);
  const [liveLinkCopied, setLiveLinkCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showManualGroupAssignment, setShowManualGroupAssignment] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const getCategoryColor = (categoryId: string): string => {
    const categoryColors: { [key: string]: string } = {};
    const colors = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
      '#14B8A6',
      '#F97316',
      '#6366F1',
      '#84CC16'
    ];

    categories.forEach((cat, idx) => {
      categoryColors[cat.id] = colors[idx % colors.length];
    });

    return categoryColors[categoryId] || '#6B7280';
  };

  const getCourtNameFromIndex = (courtIndex: string): string => {
    const courtNames = (currentTournament as any)?.court_names || [];
    const idx = parseInt(courtIndex, 10) - 1;
    if (courtNames.length > 0 && idx >= 0 && idx < courtNames.length) {
      return courtNames[idx];
    }
    return courtIndex;
  };

  const handleMatchRealtime = async (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    console.log('[REALTIME] Match change:', eventType);
    if (eventType === 'UPDATE' && newRecord) {
      setMatches(prev => prev.map(m => m.id === newRecord.id ? { ...m, ...newRecord } : m));
      setRefreshKey(prev => prev + 1);
    } else {
      fetchTournamentData();
    }
  };

  const handleTeamRealtime = async (payload: any) => {
    const { eventType, new: newRecord } = payload;
    console.log('[REALTIME] Team change:', eventType);
    if (eventType === 'UPDATE' && newRecord) {
      setTeams(prev => prev.map(t => t.id === newRecord.id ? { ...t, ...newRecord } : t));
    } else {
      fetchTournamentData();
    }
  };

  const handlePlayerRealtime = async (payload: any) => {
    const { eventType, new: newRecord } = payload;
    console.log('[REALTIME] Player change:', eventType);
    if (eventType === 'UPDATE' && newRecord) {
      setIndividualPlayers(prev => prev.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p));
    } else {
      fetchTournamentData();
    }
  };

  useEffect(() => {
    setSelectedCategory(null);
    fetchTournamentData();

    const matchesChannel = supabase
      .channel(`tournament-matches-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` }, handleMatchRealtime)
      .subscribe();

    const teamsChannel = supabase
      .channel(`tournament-teams-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournament.id}` }, handleTeamRealtime)
      .subscribe();

    const playersChannel = supabase
      .channel(`tournament-players-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournament.id}` }, handlePlayerRealtime)
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [tournament.id]);

  useEffect(() => {
    const handleClickOutside = () => setShowGroupDropdown(false);
    if (showGroupDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showGroupDropdown]);

  const isIndividualRoundRobin = currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual';
  const isIndividualGroupsKnockout = currentTournament.format === 'individual_groups_knockout';

  const isIndividualFormat = () => {
    if (selectedCategory && selectedCategory !== 'no-category') {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) {
        if (category.format === 'individual_groups_knockout') {
          return true;
        }
        if (category.format === 'round_robin') {
          return currentTournament.round_robin_type === 'individual';
        }
        return false;
      }
    }
    return isIndividualRoundRobin || isIndividualGroupsKnockout;
  };

  const calculateQualificationConfig = (numberOfGroups: number, knockoutStage: string, isIndividual: boolean): {
    qualifiedPerGroup: number;
    extraBestNeeded: number;
    totalQualified: number;
    extraFromPosition: number;
  } => {
    const teamKnockoutSizes: Record<string, number> = {
      'final': 2,
      'semifinals': 4,
      'quarterfinals': 8,
      'round16': 16,
    };

    const individualKnockoutSizes: Record<string, number> = {
      'final': 4,
      'semifinals': 8,
      'quarterfinals': 16,
      'round16': 32,
    };

    const knockoutSizes = isIndividual ? individualKnockoutSizes : teamKnockoutSizes;
    const totalQualified = knockoutSizes[knockoutStage] || (isIndividual ? 8 : 4);
    const qualifiedPerGroup = Math.floor(totalQualified / numberOfGroups);
    const extraBestNeeded = totalQualified - (qualifiedPerGroup * numberOfGroups);
    const extraFromPosition = qualifiedPerGroup + 1;

    console.log(`[CALCULATE_QUALIFIED] Type: ${isIndividual ? 'Individual' : 'Teams'}, Groups: ${numberOfGroups}, Stage: ${knockoutStage}`);
    console.log(`[CALCULATE_QUALIFIED] Total needed: ${totalQualified}, Per group: ${qualifiedPerGroup}, Extra best ${extraFromPosition}th needed: ${extraBestNeeded}`);

    return { qualifiedPerGroup, extraBestNeeded, totalQualified, extraFromPosition };
  };

  const calculateQualifiedPerGroup = (numberOfGroups: number, knockoutStage: string, isIndividual: boolean = false): number => {
    return calculateQualificationConfig(numberOfGroups, knockoutStage, isIndividual).qualifiedPerGroup;
  };

  const filteredTeams = selectedCategory === 'no-category'
    ? teams.filter(t => !t.category_id)
    : selectedCategory
    ? teams.filter(t => t.category_id === selectedCategory)
    : teams;

  const filteredMatches = selectedCategory === 'no-category'
    ? matches.filter(m => !m.category_id)
    : selectedCategory
    ? matches.filter(m => m.category_id === selectedCategory)
    : matches;

  const filteredIndividualPlayers = selectedCategory === 'no-category'
    ? individualPlayers.filter(p => !p.category_id)
    : selectedCategory
    ? individualPlayers.filter(p => p.category_id === selectedCategory)
    : individualPlayers;

  const fetchTournamentData = async () => {
    console.log('[FETCH] Starting fetchTournamentData for tournament:', tournament.id);
    setLoading(true);

    if (isIndividualRoundRobin || isIndividualGroupsKnockout) {
      const [playersResult, matchesResult, categoriesResult] = await Promise.all([
        supabase
          .from('players')
          .select('id, name, email, phone_number, group_name, seed, category_id, user_id, created_at')
          .eq('tournament_id', tournament.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('matches')
          .select('id, match_number, round, scheduled_time, court, team1_id, team2_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, category_id, player1_individual_id, player2_individual_id, player3_individual_id, player4_individual_id')
          .eq('tournament_id', tournament.id)
          .order('match_number', { ascending: true }),
        supabase
          .from('tournament_categories')
          .select('id, name, format, number_of_groups, max_teams, knockout_stage, qualified_per_group, rounds')
          .eq('tournament_id', tournament.id)
          .order('name')
      ]);

      if (playersResult.data) {
        console.log('[FETCH] Loaded', playersResult.data.length, 'individual players:', playersResult.data);
        setIndividualPlayers(playersResult.data);
      } else {
        console.error('[FETCH] No individual players data');
      }
      if (matchesResult.data) {
        console.log('[FETCH] Loaded', matchesResult.data.length, 'matches');
        console.log('[FETCH] First match:', matchesResult.data[0]);
        const sortedMatches = (matchesResult.data as unknown as MatchWithTeams[]).sort(
          (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
        );
        setMatches(sortedMatches);
      }
      if (categoriesResult.data) {
        console.log('[FETCH] Loaded', categoriesResult.data.length, 'categories');
        setCategories(categoriesResult.data);
      }
    } else {
      const [teamsResult, playersResult, matchesResult, categoriesResult] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, group_name, seed, status, category_id, player1_id, player2_id, player1:players!teams_player1_id_fkey(id, name, email, phone_number), player2:players!teams_player2_id_fkey(id, name, email, phone_number)')
          .eq('tournament_id', tournament.id)
          .order('seed', { ascending: true }),
        supabase
          .from('players')
          .select('id, name, email, phone_number, group_name, seed, category_id, user_id, created_at')
          .eq('tournament_id', tournament.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('matches')
          .select(`
            id, match_number, round, scheduled_time, court, team1_id, team2_id, team1_score_set1, team2_score_set1, team1_score_set2, team2_score_set2, team1_score_set3, team2_score_set3, status, category_id,
            team1:teams!matches_team1_id_fkey(id, name, group_name, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)),
            team2:teams!matches_team2_id_fkey(id, name, group_name, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name))
          `)
          .eq('tournament_id', tournament.id)
          .order('match_number', { ascending: true }),
        supabase
          .from('tournament_categories')
          .select('id, name, format, number_of_groups, max_teams, knockout_stage, qualified_per_group, rounds')
          .eq('tournament_id', tournament.id)
          .order('name')
      ]);

      if (teamsResult.data) {
        console.log('[FETCH] Loaded', teamsResult.data.length, 'teams');
        setTeams(teamsResult.data as unknown as TeamWithPlayers[]);
      }
      if (playersResult.data) {
        console.log('[FETCH] Loaded', playersResult.data.length, 'individual players from categories');
        setIndividualPlayers(playersResult.data);
      }
      if (matchesResult.data) {
        console.log('[FETCH] Loaded', matchesResult.data.length, 'matches');
        const knockoutFetched = matchesResult.data.filter((m: any) => !m.round.startsWith('group_'));
        if (knockoutFetched.length > 0) {
          console.log('[FETCH] Knockout matches:', knockoutFetched.map((m: any) => ({
            round: m.round,
            match_number: m.match_number,
            team1_id: m.team1_id,
            team2_id: m.team2_id,
            team1_name: m.team1?.name,
            team2_name: m.team2?.name
          })));
        }
        const sortedMatches = (matchesResult.data as unknown as MatchWithTeams[]).sort(
          (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
        );
        setMatches(sortedMatches);
      }
      if (categoriesResult.data) {
        console.log('[FETCH] Loaded', categoriesResult.data.length, 'categories');
        setCategories(categoriesResult.data);
      }
    }

    setLoading(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleAssignGroups = async () => {
    if (currentTournament.format !== 'groups_knockout' && currentTournament.format !== 'individual_groups_knockout') {
      alert('Group assignment is only available for Groups + Knockout formats');
      return;
    }

    const isIndividualFormat = currentTournament.format === 'individual_groups_knockout';
    const participantLabel = isIndividualFormat ? 'players' : 'teams';

    const confirmed = confirm(
      `This will randomly assign ${participantLabel} to groups. Any existing group assignments will be overwritten. Continue?`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data: latestTournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournament.id)
        .single();

      if (!latestTournament) {
        throw new Error('Failed to fetch tournament data');
      }

      console.log('[ASSIGN GROUPS] Latest tournament data from DB:', {
        id: latestTournament.id,
        name: latestTournament.name,
        number_of_groups: (latestTournament as any).number_of_groups,
        format: latestTournament.format
      });

      if (isIndividualFormat) {
        const { assignPlayersToGroups, savePlayerGroupAssignments } = await import('../lib/groups');

        if (categories.length > 0) {
          const allPlayersWithGroups: any[] = [];
          const tournamentNumberOfGroups = (latestTournament as any).number_of_groups || 2;

          for (const category of categories) {
            const categoryPlayers = individualPlayers.filter(p => p.category_id === category.id);
            const numberOfGroups = (category as any).number_of_groups || tournamentNumberOfGroups;
            const minPlayers = numberOfGroups * 4;

            console.log('[ASSIGN GROUPS] Category:', category.name, 'Number of groups:', numberOfGroups, 'Players:', categoryPlayers.length);

            if (categoryPlayers.length < minPlayers) {
              alert(`Category "${category.name}" needs at least ${minPlayers} players for ${numberOfGroups} groups (minimum 4 per group for American format)`);
              setLoading(false);
              return;
            }

            const playersWithGroups = assignPlayersToGroups(categoryPlayers, numberOfGroups);
            allPlayersWithGroups.push(...playersWithGroups);
          }

          await savePlayerGroupAssignments(allPlayersWithGroups);
        } else {
          const numberOfGroups = (latestTournament as any).number_of_groups || 2;
          const minPlayers = numberOfGroups * 4;

          console.log('[ASSIGN GROUPS] Using number_of_groups:', numberOfGroups);

          if (individualPlayers.length < minPlayers) {
            alert(`You need at least ${minPlayers} players for ${numberOfGroups} groups (minimum 4 per group for American format)`);
            setLoading(false);
            return;
          }

          const playersWithGroups = assignPlayersToGroups(individualPlayers, numberOfGroups);
          await savePlayerGroupAssignments(playersWithGroups);
        }

        await fetchTournamentData();
        alert('Players have been randomly assigned to groups!');
      } else {
        const { assignTeamsToGroups, saveGroupAssignments } = await import('../lib/groups');

        if (categories.length > 0) {
          const allTeamsWithGroups: any[] = [];
          const tournamentNumberOfGroups = (latestTournament as any).number_of_groups || 4;

          for (const category of categories) {
            const categoryTeams = teams.filter(t => t.category_id === category.id);
            const numberOfGroups = (category as any).number_of_groups || tournamentNumberOfGroups;
            const minTeams = numberOfGroups * 2;

            console.log('[ASSIGN GROUPS] Category:', category.name, 'Number of groups:', numberOfGroups);

            if (categoryTeams.length < minTeams) {
              alert(`Category "${category.name}" needs at least ${minTeams} teams for ${numberOfGroups} groups`);
              setLoading(false);
              return;
            }

            const teamsWithGroups = assignTeamsToGroups(categoryTeams, numberOfGroups);
            allTeamsWithGroups.push(...teamsWithGroups);
          }

          await saveGroupAssignments(tournament.id, allTeamsWithGroups);
        } else {
          const numberOfGroups = (latestTournament as any).number_of_groups || 4;
          const minTeams = numberOfGroups * 2;

          console.log('[ASSIGN GROUPS] Using number_of_groups:', numberOfGroups);

          if (teams.length < minTeams) {
            alert(`You need at least ${minTeams} teams for ${numberOfGroups} groups`);
            setLoading(false);
            return;
          }

          const teamsWithGroups = assignTeamsToGroups(teams, numberOfGroups);
          await saveGroupAssignments(tournament.id, teamsWithGroups);
        }

        await fetchTournamentData();
        alert('Teams have been randomly assigned to groups!');
      }
    } catch (error) {
      console.error('Error assigning groups:', error);
      alert('Failed to assign groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIndividualFinal = async (categoryId: string) => {
    console.log('[GENERATE_FINAL] Starting for category:', categoryId);

    const categoryMatches = matches.filter(m => m.category_id === categoryId);
    const semifinalMatches = categoryMatches.filter(m => m.round === 'semifinal');
    const finalMatch = categoryMatches.find(m => m.round === 'final');

    if (!finalMatch) {
      alert('Final match not found');
      return;
    }

    const incompleteSemifinals = semifinalMatches.filter(m => m.status !== 'completed');
    if (incompleteSemifinals.length > 0) {
      const confirmed = confirm(
        `There are ${incompleteSemifinals.length} incomplete semifinals. Continue anyway?`
      );
      if (!confirmed) return;
    }

    const winnersPerSemifinal: string[] = [];

    semifinalMatches.forEach(match => {
      if (match.status === 'completed') {
        const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
        const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
        const team1Won = team1Games > team2Games;

        if (team1Won) {
          winnersPerSemifinal.push(match.player1_individual_id!, match.player2_individual_id!);
        } else {
          winnersPerSemifinal.push(match.player3_individual_id!, match.player4_individual_id!);
        }
      }
    });

    if (winnersPerSemifinal.length !== 4) {
      alert('Need 4 winners from semifinals (2 from each semifinal)');
      return;
    }

    const shuffle = (array: string[]) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledWinners = shuffle(winnersPerSemifinal);

    const confirmed = confirm(
      'This will randomly assign semifinal winners to final teams. Continue?'
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          player1_individual_id: shuffledWinners[0],
          player2_individual_id: shuffledWinners[1],
          player3_individual_id: shuffledWinners[2],
          player4_individual_id: shuffledWinners[3],
        })
        .eq('id', finalMatch.id);

      if (error) throw error;

      await fetchTournamentData();
      alert('Final generated with random teams from semifinal winners!');
    } catch (error) {
      console.error('Error generating final:', error);
      alert('Failed to generate final. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIndividualKnockout = async (categoryId: string) => {
    console.log('[GENERATE_KNOCKOUT] Starting for category:', categoryId);

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      alert('Category not found');
      return;
    }

    const categoryMatches = matches.filter(m => m.category_id === categoryId);
    const groupMatches = categoryMatches.filter(m => m.round.startsWith('group_'));
    const categoryPlayers = individualPlayers.filter(p => p.category_id === categoryId);

    const uniqueGroups = new Set(categoryPlayers.map(p => p.group_name).filter(Boolean));
    const numberOfGroups = uniqueGroups.size;
    const knockoutStage = (category as any).knockout_stage || 'semifinals';

    console.log(`[GENERATE_KNOCKOUT] Found ${numberOfGroups} groups, knockout stage: ${knockoutStage}`);

    const qualConfig = calculateQualificationConfig(numberOfGroups, knockoutStage, true);
    const { qualifiedPerGroup, extraBestNeeded, totalQualified, extraFromPosition } = qualConfig;

    console.log(`[GENERATE_KNOCKOUT] Config: ${qualifiedPerGroup} per group + ${extraBestNeeded} best ${extraFromPosition}th = ${totalQualified} total`);

    if ((category as any).qualified_per_group !== qualifiedPerGroup) {
      console.log(`[GENERATE_KNOCKOUT] Updating category qualified_per_group to ${qualifiedPerGroup}`);
      await supabase
        .from('tournament_categories')
        .update({ qualified_per_group: qualifiedPerGroup })
        .eq('id', categoryId);
    }

    const incompleteMatches = groupMatches.filter(m => m.status !== 'completed');
    if (incompleteMatches.length > 0) {
      const confirmed = confirm(
        `There are ${incompleteMatches.length} incomplete group matches. Continue anyway?`
      );
      if (!confirmed) return;
    }

    const playersByGroup = new Map<string, typeof categoryPlayers>();
    categoryPlayers.forEach(player => {
      if (player.group_name) {
        if (!playersByGroup.has(player.group_name)) {
          playersByGroup.set(player.group_name, []);
        }
        playersByGroup.get(player.group_name)!.push(player);
      }
    });

    const qualifiedPlayers: string[] = [];
    const runnersUpCandidates: Array<{ id: string; stats: { wins: number; gamesWon: number; gamesLost: number } }> = [];

    playersByGroup.forEach((groupPlayers, groupName) => {
      const groupMatchList = groupMatches.filter(m =>
        groupPlayers.some(p =>
          p.id === m.player1_individual_id ||
          p.id === m.player2_individual_id ||
          p.id === m.player3_individual_id ||
          p.id === m.player4_individual_id
        )
      );

      const playerStats = new Map<string, { matches: number; wins: number; gamesWon: number; gamesLost: number }>();
      groupPlayers.forEach(player => {
        playerStats.set(player.id, { matches: 0, wins: 0, gamesWon: 0, gamesLost: 0 });
      });

      groupMatchList.forEach(match => {
        if (match.status === 'completed') {
          const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
          const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
          const team1Won = team1Games > team2Games;

          const team1Players = [match.player1_individual_id, match.player2_individual_id].filter(Boolean);
          const team2Players = [match.player3_individual_id, match.player4_individual_id].filter(Boolean);

          team1Players.forEach(playerId => {
            const stats = playerStats.get(playerId!);
            if (stats) {
              stats.matches++;
              stats.gamesWon += team1Games;
              stats.gamesLost += team2Games;
              if (team1Won) stats.wins++;
            }
          });

          team2Players.forEach(playerId => {
            const stats = playerStats.get(playerId!);
            if (stats) {
              stats.matches++;
              stats.gamesWon += team2Games;
              stats.gamesLost += team1Games;
              if (!team1Won) stats.wins++;
            }
          });
        }
      });

      const sortedPlayers = groupPlayers
        .map(player => ({
          ...player,
          stats: playerStats.get(player.id)!
        }))
        .sort((a, b) => {
          if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
          const diffA = a.stats.gamesWon - a.stats.gamesLost;
          const diffB = b.stats.gamesWon - b.stats.gamesLost;
          return diffB - diffA;
        });

      const topPlayers = sortedPlayers.slice(0, qualifiedPerGroup);
      console.log(`[GENERATE_KNOCKOUT] Group ${groupName} top ${qualifiedPerGroup}:`, topPlayers.map(p => p.name));
      qualifiedPlayers.push(...topPlayers.map(p => p.id));

      if (extraBestNeeded > 0 && sortedPlayers.length >= extraFromPosition) {
        const runnerUp = sortedPlayers[extraFromPosition - 1];
        runnersUpCandidates.push({
          id: runnerUp.id,
          stats: runnerUp.stats
        });
      }
    });

    if (extraBestNeeded > 0) {
      runnersUpCandidates.sort((a, b) => {
        if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
        const diffA = a.stats.gamesWon - a.stats.gamesLost;
        const diffB = b.stats.gamesWon - b.stats.gamesLost;
        return diffB - diffA;
      });

      const bestRunnersUp = runnersUpCandidates.slice(0, extraBestNeeded);
      console.log(`[GENERATE_KNOCKOUT] Best ${extraFromPosition}th-place:`, bestRunnersUp.map(p => p.id));
      qualifiedPlayers.push(...bestRunnersUp.map(p => p.id));
    }

    if (qualifiedPlayers.length !== totalQualified) {
      alert(`Expected ${totalQualified} qualified players but got ${qualifiedPlayers.length}. Check group standings.`);
      return;
    }

    const sortedGroupNames = Array.from(playersByGroup.keys()).sort();
    const qualifiedByGroup = new Map<string, string[]>();
    sortedGroupNames.forEach(groupName => {
      const groupPlayers = playersByGroup.get(groupName)!;
      const groupMatchList = groupMatches.filter(m =>
        groupPlayers.some(p =>
          p.id === m.player1_individual_id ||
          p.id === m.player2_individual_id ||
          p.id === m.player3_individual_id ||
          p.id === m.player4_individual_id
        )
      );

      const playerStats = new Map<string, { matches: number; wins: number; gamesWon: number; gamesLost: number }>();
      groupPlayers.forEach(player => {
        playerStats.set(player.id, { matches: 0, wins: 0, gamesWon: 0, gamesLost: 0 });
      });

      groupMatchList.forEach(match => {
        if (match.status === 'completed') {
          const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
          const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
          const team1Won = team1Games > team2Games;

          const team1Players = [match.player1_individual_id, match.player2_individual_id].filter(Boolean);
          const team2Players = [match.player3_individual_id, match.player4_individual_id].filter(Boolean);

          team1Players.forEach(playerId => {
            const stats = playerStats.get(playerId!);
            if (stats) {
              stats.matches++;
              stats.gamesWon += team1Games;
              stats.gamesLost += team2Games;
              if (team1Won) stats.wins++;
            }
          });

          team2Players.forEach(playerId => {
            const stats = playerStats.get(playerId!);
            if (stats) {
              stats.matches++;
              stats.gamesWon += team2Games;
              stats.gamesLost += team1Games;
              if (!team1Won) stats.wins++;
            }
          });
        }
      });

      const sortedPlayers = groupPlayers
        .map(player => ({
          ...player,
          stats: playerStats.get(player.id)!
        }))
        .sort((a, b) => {
          if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
          const diffA = a.stats.gamesWon - a.stats.gamesLost;
          const diffB = b.stats.gamesWon - b.stats.gamesLost;
          return diffB - diffA;
        });

      qualifiedByGroup.set(groupName, sortedPlayers.slice(0, qualifiedPerGroup).map(p => p.id));
    });

    setLoading(true);

    try {
      if (knockoutStage === 'final' && numberOfGroups === 2 && qualifiedPerGroup === 2) {
        const finalMatch = categoryMatches.find(m => m.round === 'final');
        if (!finalMatch) {
          alert('Final match not found');
          setLoading(false);
          return;
        }

        const groupA = sortedGroupNames[0];
        const groupB = sortedGroupNames[1];
        const playersA = qualifiedByGroup.get(groupA)!;
        const playersB = qualifiedByGroup.get(groupB)!;

        const { error: finalError } = await supabase
          .from('matches')
          .update({
            player1_individual_id: playersA[0],
            player2_individual_id: playersB[1],
            player3_individual_id: playersB[0],
            player4_individual_id: playersA[1],
          })
          .eq('id', finalMatch.id);

        if (finalError) throw finalError;

        await fetchTournamentData();
        alert('Final generated: A1+B2 vs B1+A2');
      } else if ((currentTournament as any).mixed_knockout && numberOfGroups === 2) {
        const semifinalMatches = categoryMatches.filter(m => m.round === 'semifinal');
        if (semifinalMatches.length !== 2) {
          alert('Expected exactly 2 semifinal matches for mixed knockout');
          setLoading(false);
          return;
        }

        semifinalMatches.sort((a, b) => a.match_number - b.match_number);

        const sortedGroupNames = Array.from(playersByGroup.keys()).sort();
        const groupA = sortedGroupNames[0];
        const groupB = sortedGroupNames[1];
        const playersA = qualifiedByGroup.get(groupA)!;
        const playersB = qualifiedByGroup.get(groupB)!;

        const confirmed = confirm(
          `Knockout Misto: Formar equipas ${groupA}+${groupB}.\n\n` +
          `Semi 1: ${groupA}1+${groupB}2 vs ${groupA}2+${groupB}1\n` +
          `(Equipas cruzadas para equilibrio)\n\nContinuar?`
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }

        const { error: sf1Error } = await supabase
          .from('matches')
          .update({
            player1_individual_id: playersA[0],
            player2_individual_id: playersB[1],
            player3_individual_id: playersA[1],
            player4_individual_id: playersB[0],
          })
          .eq('id', semifinalMatches[0].id);

        if (sf1Error) throw sf1Error;

        if (playersA.length >= 4 && playersB.length >= 4) {
          const { error: sf2Error } = await supabase
            .from('matches')
            .update({
              player1_individual_id: playersA[2],
              player2_individual_id: playersB[3],
              player3_individual_id: playersA[3],
              player4_individual_id: playersB[2],
            })
            .eq('id', semifinalMatches[1].id);

          if (sf2Error) throw sf2Error;
        }

        await fetchTournamentData();
        alert(`Meias-finais mistas geradas!\n${groupA}1+${groupB}2 vs ${groupA}2+${groupB}1`);
      } else {
        const shuffle = (array: string[]) => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        const shuffledQualified = shuffle(qualifiedPlayers);

        const semifinalMatches = categoryMatches.filter(m => m.round === 'semifinal');
        if (semifinalMatches.length !== 2) {
          alert('Expected exactly 2 semifinal matches');
          setLoading(false);
          return;
        }

        semifinalMatches.sort((a, b) => a.match_number - b.match_number);

        const confirmed = confirm(
          'This will randomly assign qualified players to semifinals. Continue?'
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }

        const { error: sf1Error } = await supabase
          .from('matches')
          .update({
            player1_individual_id: shuffledQualified[0],
            player2_individual_id: shuffledQualified[1],
            player3_individual_id: shuffledQualified[2],
            player4_individual_id: shuffledQualified[3],
          })
          .eq('id', semifinalMatches[0].id);

        if (sf1Error) throw sf1Error;

        const { error: sf2Error } = await supabase
          .from('matches')
          .update({
            player1_individual_id: shuffledQualified[4],
            player2_individual_id: shuffledQualified[5],
            player3_individual_id: shuffledQualified[6],
            player4_individual_id: shuffledQualified[7],
          })
          .eq('id', semifinalMatches[1].id);

        if (sf2Error) throw sf2Error;

        await fetchTournamentData();
        alert('Semifinals generated with random teams!');
      }
    } catch (error) {
      console.error('Error generating knockout:', error);
      alert('Failed to generate knockout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceToKnockout = async (categoryId?: string) => {
    console.log('[ADVANCE] Starting advance to knockout');
    console.log('[ADVANCE] Category ID:', categoryId);
    console.log('[ADVANCE] Tournament format:', currentTournament.format);

    if (currentTournament.format !== 'groups_knockout' && currentTournament.format !== 'individual_groups_knockout') {
      alert('This feature is only available for Groups + Knockout formats');
      return;
    }

    const isIndividualFormat = currentTournament.format === 'individual_groups_knockout';

    const groupMatches = categoryId
      ? matches.filter(m => m.round.startsWith('group_') && m.category_id === categoryId)
      : matches.filter(m => m.round.startsWith('group_'));
    console.log('[ADVANCE] Found', groupMatches.length, 'group matches');

    const incompleteGroupMatches = groupMatches.filter(m => m.status !== 'completed');
    console.log('[ADVANCE] Incomplete matches:', incompleteGroupMatches.length);

    if (incompleteGroupMatches.length > 0) {
      const confirmed = confirm(
        `There are ${incompleteGroupMatches.length} incomplete group stage matches. Are you sure you want to advance to knockout stage?`
      );
      if (!confirmed) return;
    }

    const confirmed = confirm(
      'This will finalize group stage standings and reschedule ALL matches (groups + knockout) optimally. Continue?'
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { getQualifiedTeamsByKnockoutStage, getQualifiedPlayersFromGroups } = await import('../lib/groups');
      const { scheduleMultipleCategories } = await import('../lib/multiCategoryScheduler');

      const category = categoryId ? categories.find(c => c.id === categoryId) : null;
      const knockoutStage = category ? ((category as any).knockout_stage || 'semifinals') : ((currentTournament as any).knockout_stage || 'quarterfinals');

      const categoryParticipants = isIndividualFormat
        ? individualPlayers.filter(p => !categoryId || p.category_id === categoryId)
        : teams.filter(t => !categoryId || t.category_id === categoryId);

      const uniqueGroups = new Set(categoryParticipants.map((p: any) => p.group_name).filter(Boolean));
      const numberOfGroups = uniqueGroups.size;

      console.log(`[ADVANCE] Found ${numberOfGroups} groups in category`);

      const qualConfig = calculateQualificationConfig(numberOfGroups, knockoutStage, isIndividualFormat);
      const { qualifiedPerGroup, extraBestNeeded, totalQualified } = qualConfig;

      console.log(`[ADVANCE] Qualification config: ${qualifiedPerGroup} per group + ${extraBestNeeded} best runners-up = ${totalQualified} total`);

      if (category && (category as any).qualified_per_group !== qualifiedPerGroup) {
        console.log(`[ADVANCE] Updating category qualified_per_group to ${qualifiedPerGroup}`);
        await supabase
          .from('tournament_categories')
          .update({ qualified_per_group: qualifiedPerGroup })
          .eq('id', categoryId);
      }

      let qualifiedIds: string[];
      let qualifiedParticipants: any[];

      if (isIndividualFormat) {
        console.log('[ADVANCE] Getting qualified players for knockout stage');
        qualifiedIds = await getQualifiedPlayersFromGroups(tournament.id, qualifiedPerGroup, categoryId, extraBestNeeded);
        console.log('[ADVANCE] Qualified player IDs:', qualifiedIds);

        if (qualifiedIds.length < 2) {
          alert('Not enough qualified players to create knockout bracket');
          setLoading(false);
          return;
        }

        qualifiedParticipants = individualPlayers
          .filter(p => qualifiedIds.includes(p.id) && (!categoryId || p.category_id === categoryId))
          .sort((a, b) => qualifiedIds.indexOf(a.id) - qualifiedIds.indexOf(b.id))
          .map((p, idx) => ({ id: p.id, team_name: p.name, seed: idx + 1, group_name: p.group_name }));
      } else {
        console.log('[ADVANCE] Getting qualified teams for knockout stage:', knockoutStage);
        qualifiedIds = await getQualifiedTeamsByKnockoutStage(tournament.id, knockoutStage, categoryId);
        console.log('[ADVANCE] Qualified team IDs:', qualifiedIds);

        if (qualifiedIds.length < 2) {
          alert('Not enough qualified teams to create knockout bracket');
          setLoading(false);
          return;
        }

        qualifiedParticipants = teams
          .filter(t => qualifiedIds.includes(t.id) && (!categoryId || t.category_id === categoryId))
          .sort((a, b) => qualifiedIds.indexOf(a.id) - qualifiedIds.indexOf(b.id))
          .map((t, idx) => ({ ...t, seed: idx + 1 }));
      }

      const qualifiedTeams = qualifiedParticipants;

      console.log('[ADVANCE] Qualified teams:', qualifiedTeams.length);
      console.log('[ADVANCE] Qualified teams details:', qualifiedTeams.map((t: any) => ({
        id: t.id,
        name: t.team_name || t.name,
        seed: t.seed,
        group_name: t.group_name
      })));

      // Delete ALL matches for this category to reschedule everything together
      console.log('[ADVANCE] Deleting all existing matches for category to reschedule');
      let deleteQuery = supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournament.id);

      if (categoryId) {
        deleteQuery = deleteQuery.eq('category_id', categoryId);
      } else {
        deleteQuery = deleteQuery.is('category_id', null);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) throw deleteError;

      if (!category) {
        alert('Category not found');
        setLoading(false);
        return;
      }

      let rescheduledParticipants: any[];
      let scheduleFormat: string;

      if (isIndividualFormat) {
        rescheduledParticipants = (categoryId
          ? individualPlayers.filter(p => p.category_id === categoryId)
          : individualPlayers.filter(p => !p.category_id)
        ).map(p => ({ id: p.id, team_name: p.name, group_name: p.group_name }));
        scheduleFormat = 'individual_groups_knockout';
      } else {
        rescheduledParticipants = categoryId
          ? teams.filter(t => t.category_id === categoryId)
          : teams.filter(t => !t.category_id);
        scheduleFormat = 'groups';
      }

      const categoryRequests = [{
        categoryId: categoryId!,
        teams: rescheduledParticipants,
        format: scheduleFormat,
        knockoutTeams: qualifiedTeams,
        isIndividualFormat: isIndividualFormat,
        knockoutStage: knockoutStage as 'final' | 'semifinals' | 'quarterfinals' | 'round_of_16'
      }];

      console.log('[ADVANCE] Scheduling with:', {
        participants: rescheduledParticipants.length,
        qualifiedTeams: qualifiedTeams.length,
        format: scheduleFormat,
        isIndividualFormat,
        knockoutStage
      });

      const scheduledByCategory = scheduleMultipleCategories(
        categoryRequests,
        currentTournament.number_of_courts || 1,
        currentTournament.start_date,
        (currentTournament as any).daily_start_time || '09:00',
        (currentTournament as any).daily_end_time || '21:00',
        (currentTournament as any).match_duration_minutes || 15,
        [] as any[], // No existing matches since we deleted all
        (currentTournament as any).daily_schedules || []
      );

      console.log('[ADVANCE] Scheduled matches returned:', scheduledByCategory.get(categoryId!)?.length || 0);

      const matchesToInsert = (scheduledByCategory.get(categoryId!) || []).map(match => ({
        tournament_id: tournament.id,
        category_id: categoryId || null,
        ...match,
        court: getCourtNameFromIndex(match.court),
        status: 'scheduled',
        team1_score_set1: 0,
        team2_score_set1: 0,
        team1_score_set2: 0,
        team2_score_set2: 0,
        team1_score_set3: 0,
        team2_score_set3: 0,
      }));

      const groupMatches = matchesToInsert.filter(m => m.round.startsWith('group_'));
      const knockoutMatches = matchesToInsert.filter(m => !m.round.startsWith('group_'));
      console.log('[ADVANCE] Inserting', matchesToInsert.length, 'matches into database');
      console.log('[ADVANCE] Group matches:', groupMatches.length, 'Knockout matches:', knockoutMatches.length);
      if (knockoutMatches.length > 0) {
        console.log('[ADVANCE] Knockout rounds:', [...new Set(knockoutMatches.map(m => m.round))]);
        console.log('[ADVANCE] Knockout match details:', knockoutMatches.map(m => ({
          round: m.round,
          match_number: m.match_number,
          team1_id: m.team1_id,
          team2_id: m.team2_id,
          p1: (m as any).player1_individual_id,
          p2: (m as any).player2_individual_id,
          p3: (m as any).player3_individual_id,
          p4: (m as any).player4_individual_id
        })));
      }
      console.log('[ADVANCE] Full first match to insert:', JSON.stringify(matchesToInsert[0], null, 2));

      if (matchesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('matches')
          .insert(matchesToInsert);

        if (insertError) {
          console.error('[ADVANCE] Insert error:', insertError);
          throw insertError;
        }
      }

      if (isIndividualFormat) {
        const { populatePlacementMatches } = await import('../lib/groups');
        await populatePlacementMatches(tournament.id, categoryId);
        console.log('[ADVANCE] Placement matches populated with group standings');
      }

      console.log('[ADVANCE] Matches inserted successfully, refreshing data');
      await fetchTournamentData();
      alert(`Knockout bracket created with ${qualifiedTeams.length} qualified teams! All matches have been optimally scheduled.`);
    } catch (error) {
      console.error('Error advancing to knockout:', error);
      alert('Failed to create knockout bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleKnockout = async (categoryId?: string) => {
    const confirmed = confirm(
      'This will reschedule all knockout matches, optimally filling available court slots. Continue?'
    );

    if (!confirmed) return;

    if (loading) return;

    setLoading(true);

    try {
      // Get all existing matches in the tournament
      const allMatches = matches;

      // Find knockout matches for this category (or all if no category)
      const knockoutMatches = categoryId
        ? allMatches.filter(m => !m.round.startsWith('group_') && m.category_id === categoryId)
        : allMatches.filter(m => !m.round.startsWith('group_'));

      if (knockoutMatches.length === 0) {
        alert('No knockout matches to schedule');
        return;
      }

      // Get the latest group match or start of tournament
      const groupMatches = categoryId
        ? allMatches.filter(m => m.round.startsWith('group_') && m.category_id === categoryId)
        : allMatches.filter(m => m.round.startsWith('group_'));

      let startDate = currentTournament.start_date;
      let startTime = (currentTournament as any).daily_start_time || '09:00';

      if (groupMatches.length > 0) {
        const lastGroupMatch = groupMatches
          .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime())[0];
        const lastMatchDate = new Date(lastGroupMatch.scheduled_time);
        const matchDuration = (currentTournament as any).match_duration_minutes || 15;
        lastMatchDate.setMinutes(lastMatchDate.getMinutes() + matchDuration);
        startDate = lastMatchDate.toISOString().split('T')[0];
        const hours = lastMatchDate.getHours().toString().padStart(2, '0');
        const minutes = lastMatchDate.getMinutes().toString().padStart(2, '0');
        startTime = `${hours}:${minutes}`;
      }

      // Get qualified teams in order
      const knockoutTeamIds = new Set<string>();
      knockoutMatches.forEach(m => {
        if (m.team1_id) knockoutTeamIds.add(m.team1_id);
        if (m.team2_id) knockoutTeamIds.add(m.team2_id);
      });

      const qualifiedTeams = teams
        .filter(t => knockoutTeamIds.has(t.id) && (!categoryId || t.category_id === categoryId));

      // Generate new schedule
      const { generateTournamentSchedule } = await import('../lib/scheduler');
      const newKnockoutMatches = generateTournamentSchedule(
        qualifiedTeams,
        currentTournament.number_of_courts || 1,
        startDate,
        'single_elimination',
        (currentTournament as any).daily_start_time || '09:00',
        (currentTournament as any).daily_end_time || '21:00',
        (currentTournament as any).match_duration_minutes || 15,
        true,
        (currentTournament as any).daily_schedules || []
      );

      // Delete old knockout matches
      const knockoutMatchIds = knockoutMatches.map(m => m.id);
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .in('id', knockoutMatchIds);

      if (deleteError) throw deleteError;

      const matchesToInsert = newKnockoutMatches.map(match => ({
        tournament_id: tournament.id,
        category_id: categoryId || null,
        ...match,
        court: getCourtNameFromIndex(match.court),
        status: 'scheduled',
        team1_score_set1: 0,
        team2_score_set1: 0,
        team1_score_set2: 0,
        team2_score_set2: 0,
        team1_score_set3: 0,
        team2_score_set3: 0,
      }));

      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchesToInsert);

      if (insertError) throw insertError;

      await fetchTournamentData();
      alert(`Successfully rescheduled ${matchesToInsert.length} knockout matches!`);
    } catch (error) {
      console.error('Error scheduling knockout:', error);
      alert('Failed to schedule knockout matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleCategory = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const isIndividual = category.format === 'individual_groups_knockout' || (category.format === 'round_robin' && currentTournament.round_robin_type === 'individual');
    const categoryTeams = teams.filter(t => t.category_id === categoryId);
    const categoryPlayers = individualPlayers.filter(p => p.category_id === categoryId);

    const participantCount = isIndividual ? categoryPlayers.length : categoryTeams.length;
    const participantType = isIndividual ? 'players' : 'teams';

    if (participantCount < 2) {
      alert(`You need at least 2 ${participantType} in category ${category.name} to generate a schedule`);
      return;
    }

    const confirmed = confirm(
      `This will optimally schedule matches for ${category.name}, using available court slots alongside other categories. Any existing unplayed matches for this category will be removed. Continue?`
    );

    if (!confirmed) return;

    if (loading) {
      console.warn('[SCHEDULE CATEGORY] Already in progress');
      return;
    }

    setLoading(true);

    try {
      // Count ALL matches in tournament (including old ones with null category_id)
      const { count: existingCount } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id);

      console.log(`[SCHEDULE CATEGORY] Found ${existingCount || 0} TOTAL matches in tournament`);
      console.log('[SCHEDULE CATEGORY] >>> DELETING ALL MATCHES (including null category) <<<');

      // Delete ALL matches for this tournament (this fixes the null category_id issue)
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournament.id);

      if (deleteError) {
        console.error('[SCHEDULE CATEGORY] Delete error:', deleteError);
        throw deleteError;
      }

      console.log(`[SCHEDULE CATEGORY] Deleted ALL matches successfully`);

      // Immediately update local state
      setMatches([]);

      // No existing matches since we deleted all
      const existingMatches: any[] = [];

      // For groups_knockout format, calculate knockout teams placeholder
      let knockoutTeamsPlaceholder: any[] = [];
      console.log(`[SCHEDULE CATEGORY] Category format: ${category.format}, knockout_stage: ${(category as any).knockout_stage}`);
      if (category.format === 'groups_knockout') {
        const knockoutStage = (category as any).knockout_stage || 'quarterfinals';

        // Bracket size determined directly by knockout_stage
        // Best third-place teams fill remaining spots if needed
        const bracketSize = knockoutStage === 'final' ? 2 :
                            knockoutStage === 'semifinals' ? 4 :
                            knockoutStage === 'quarterfinals' ? 8 :
                            knockoutStage === 'round_of_16' ? 16 : 8;

        // Create placeholder teams for knockout stage
        for (let i = 0; i < bracketSize; i++) {
          knockoutTeamsPlaceholder.push({
            id: `tbd-${i}`,
            seed: i + 1
          });
        }
        console.log(`[SCHEDULE CATEGORY] Knockout stage: ${knockoutStage}, bracket size: ${bracketSize}`);
      }

      const teamsForScheduler = isIndividual
        ? categoryPlayers.map(player => ({
            id: player.id,
            name: player.name,
            seed: player.seed,
            group_name: player.group_name
          }))
        : categoryTeams;

      const categoryRequests = [{
        categoryId: categoryId,
        teams: teamsForScheduler,
        format: category.format === 'groups_knockout' ? 'groups' : category.format,
        knockoutTeams: knockoutTeamsPlaceholder.length > 0 ? knockoutTeamsPlaceholder : undefined,
        isAmerican: isIndividual && category.format === 'round_robin',
        rounds: category.rounds || 7
      }];

      const scheduledByCategory = scheduleMultipleCategories(
        categoryRequests,
        currentTournament.number_of_courts || 1,
        currentTournament.start_date,
        (currentTournament as any).daily_start_time || '09:00',
        (currentTournament as any).daily_end_time || '21:00',
        (currentTournament as any).match_duration_minutes || 15,
        existingMatches as any[],
        (currentTournament as any).daily_schedules || []
      );

      const allScheduledMatches = scheduledByCategory.get(categoryId) || [];
      console.log(`[SCHEDULE CATEGORY] scheduledByCategory has ${allScheduledMatches.length} matches for category ${categoryId}`);
      console.log('[SCHEDULE CATEGORY] Match numbers:', allScheduledMatches.map(m => m.match_number).join(', '));
      console.log('[SCHEDULE CATEGORY] Match rounds:', allScheduledMatches.map(m => m.round).join(', '));

      const matchesToInsert = allScheduledMatches.map(match => {
        const team1_id = match.team1_id?.startsWith('tbd-') ? null : match.team1_id;
        const team2_id = match.team2_id?.startsWith('tbd-') ? null : match.team2_id;

        if (isIndividual) {
          const player1_id = (match as any).player1_individual_id?.startsWith?.('tbd-') ? null : (match as any).player1_individual_id;
          const player2_id = (match as any).player2_individual_id?.startsWith?.('tbd-') ? null : (match as any).player2_individual_id;
          const player3_id = ((match as any).player3_individual_id || (match as any).player3_id)?.startsWith?.('tbd-') ? null : ((match as any).player3_individual_id || (match as any).player3_id);
          const player4_id = ((match as any).player4_individual_id || (match as any).player4_id)?.startsWith?.('tbd-') ? null : ((match as any).player4_individual_id || (match as any).player4_id);

          return {
            tournament_id: tournament.id,
            category_id: categoryId,
            round: match.round,
            match_number: match.match_number,
            scheduled_time: match.scheduled_time,
            court: getCourtNameFromIndex(match.court),
            player1_individual_id: player1_id || null,
            player2_individual_id: player2_id || null,
            player3_individual_id: player3_id || null,
            player4_individual_id: player4_id || null,
            team1_id: null,
            team2_id: null,
            status: 'scheduled',
            team1_score_set1: 0,
            team2_score_set1: 0,
            team1_score_set2: 0,
            team2_score_set2: 0,
            team1_score_set3: 0,
            team2_score_set3: 0,
          };
        }

        return {
          tournament_id: tournament.id,
          category_id: categoryId,
          ...match,
          court: getCourtNameFromIndex(match.court),
          team1_id,
          team2_id,
          status: 'scheduled',
          team1_score_set1: 0,
          team2_score_set1: 0,
          team1_score_set2: 0,
          team2_score_set2: 0,
          team1_score_set3: 0,
          team2_score_set3: 0,
        };
      });

      console.log(`[SCHEDULE CATEGORY] About to insert ${matchesToInsert.length} matches`);
      if (isIndividual) {
        console.log('[SCHEDULE CATEGORY] First 3 matches (individual):', matchesToInsert.slice(0, 3).map(m => ({
          match: m.match_number,
          p1: m.player1_individual_id,
          p2: m.player2_individual_id,
          p3: m.player3_individual_id,
          p4: m.player4_individual_id
        })));
        console.log('[SCHEDULE CATEGORY] First match FULL:', JSON.stringify(matchesToInsert[0], null, 2));
      } else {
        console.log('[SCHEDULE CATEGORY] First 3 matches (teams):', matchesToInsert.slice(0, 3).map(m => ({
          match: m.match_number,
          t1: m.team1_id,
          t2: m.team2_id
        })));
      }

      if (matchesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('matches')
          .insert(matchesToInsert);

        if (insertError) {
          console.error('Error inserting matches:', insertError);
          throw insertError;
        }
      }

      await fetchTournamentData();
      alert(`Successfully scheduled ${matchesToInsert.length} matches for ${category.name}!`);
    } catch (error) {
      console.error('Error scheduling category:', error);
      alert('Failed to schedule matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleAllCategories = async () => {
    if (categories.length === 0) {
      alert('No categories found. Please add categories first.');
      return;
    }

    const totalParticipants = teams.length + individualPlayers.length;
    if (totalParticipants < 2) {
      alert('You need at least 2 teams/players across all categories to generate a schedule');
      return;
    }

    const confirmed = confirm(
      `This will optimally schedule all matches across all categories (${categories.length} categories) using ${tournament.number_of_courts} court(s). Matches from different categories will run in parallel when courts are available. Any existing unplayed matches will be removed. Continue?`
    );

    if (!confirmed) return;

    if (loading) {
      console.warn('[SCHEDULE ALL] Already in progress');
      return;
    }

    setLoading(true);

    try {
      // First count how many matches exist
      const { count: existingCount } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id);

      console.log(`[SCHEDULE ALL] Found ${existingCount || 0} matches to delete`);

      // Now delete them using RPC
      const { data: deletedCount, error: deleteError } = await supabase.rpc('delete_matches_by_tournament', {
        p_tournament_id: tournament.id
      });

      if (deleteError) {
        console.error('[SCHEDULE ALL] Delete RPC error:', deleteError);
        throw deleteError;
      }

      console.log(`[SCHEDULE ALL] Actually deleted ${deletedCount} matches`);

      // Immediately clear local state to show deletion
      setMatches([]);

      const categoryRequests = categories.map(cat => {
        const isIndividual = cat.format === 'individual_groups_knockout' || (cat.format === 'round_robin' && currentTournament.round_robin_type === 'individual');
        const categoryTeams = teams.filter(t => t.category_id === cat.id);
        const categoryPlayers = individualPlayers.filter(p => p.category_id === cat.id);

        console.log(`[SCHEDULE ALL] Category ${cat.name}:`, {
          format: cat.format,
          isIndividual,
          categoryTeams: categoryTeams.length,
          categoryPlayers: categoryPlayers.length
        });

        const teamsForScheduler = isIndividual
          ? categoryPlayers.map(player => ({
              id: player.id,
              name: player.name,
              seed: player.seed || 0,
              group_name: player.group_name
            }))
          : categoryTeams;

        // For groups_knockout format, add placeholder knockout teams
        let knockoutTeamsPlaceholder: any[] = [];
        if (cat.format === 'groups_knockout') {
          const knockoutStage = (cat as any).knockout_stage || 'quarterfinals';

          // Bracket size determined directly by knockout_stage
          // Best third-place teams fill remaining spots if needed
          const bracketSize = knockoutStage === 'final' ? 2 :
                              knockoutStage === 'semifinals' ? 4 :
                              knockoutStage === 'quarterfinals' ? 8 :
                              knockoutStage === 'round_of_16' ? 16 : 8;

          for (let i = 0; i < bracketSize; i++) {
            knockoutTeamsPlaceholder.push({
              id: `tbd-${cat.id}-${i}`,
              seed: i + 1
            });
          }
          console.log(`[SCHEDULE ALL] Category ${cat.name}: knockout stage ${knockoutStage}, bracket size ${bracketSize}`);
        }

        return {
          categoryId: cat.id,
          teams: teamsForScheduler,
          format: cat.format === 'groups_knockout' ? 'groups' : cat.format,
          knockoutTeams: knockoutTeamsPlaceholder.length > 0 ? knockoutTeamsPlaceholder : undefined,
          isAmerican: isIndividual && cat.format === 'round_robin',
          rounds: cat.rounds || 7
        };
      }).filter(req => req.teams.length >= 2);

      console.log(`[SCHEDULE ALL] After filtering, ${categoryRequests.length} categories with >=2 participants`);
      categoryRequests.forEach(req => {
        console.log(`  - Category ${req.categoryId}: ${req.teams.length} participants, format: ${req.format}`);
      });

      const scheduledByCategory = scheduleMultipleCategories(
        categoryRequests,
        currentTournament.number_of_courts || 1,
        currentTournament.start_date,
        (currentTournament as any).daily_start_time || '09:00',
        (currentTournament as any).daily_end_time || '21:00',
        (currentTournament as any).match_duration_minutes || 15,
        [],
        (currentTournament as any).daily_schedules || []
      );

      console.log(`[SCHEDULE ALL] scheduleMultipleCategories returned matches for ${scheduledByCategory.size} categories`);
      scheduledByCategory.forEach((matches, catId) => {
        console.log(`  - Category ${catId}: ${matches.length} matches scheduled`);
      });

      const allMatchesToInsert: any[] = [];
      scheduledByCategory.forEach((matches, categoryId) => {
        const category = categories.find(c => c.id === categoryId);
        const isIndividual = category && (category.format === 'individual_groups_knockout' || (category.format === 'round_robin' && currentTournament.round_robin_type === 'individual'));

        matches.forEach(match => {
          const baseMatch = {
            tournament_id: tournament.id,
            category_id: categoryId,
            round: match.round,
            match_number: match.match_number,
            scheduled_time: match.scheduled_time,
            court: getCourtNameFromIndex(match.court),
            status: 'scheduled',
            team1_score_set1: 0,
            team2_score_set1: 0,
            team1_score_set2: 0,
            team2_score_set2: 0,
            team1_score_set3: 0,
            team2_score_set3: 0,
          };

          if (isIndividual) {
            const p1 = (match as any).player1_individual_id?.startsWith?.('tbd-') ? null : ((match as any).player1_individual_id || null);
            const p2 = (match as any).player2_individual_id?.startsWith?.('tbd-') ? null : ((match as any).player2_individual_id || null);
            const p3 = (match as any).player3_individual_id?.startsWith?.('tbd-') ? null : ((match as any).player3_individual_id || null);
            const p4 = (match as any).player4_individual_id?.startsWith?.('tbd-') ? null : ((match as any).player4_individual_id || null);
            allMatchesToInsert.push({
              ...baseMatch,
              player1_individual_id: p1,
              player2_individual_id: p2,
              player3_individual_id: p3,
              player4_individual_id: p4,
              team1_id: null,
              team2_id: null,
            });
          } else {
            const t1 = match.team1_id?.startsWith?.('tbd-') ? null : (match.team1_id || null);
            const t2 = match.team2_id?.startsWith?.('tbd-') ? null : (match.team2_id || null);
            allMatchesToInsert.push({
              ...baseMatch,
              team1_id: t1,
              team2_id: t2,
              player1_individual_id: null,
              player2_individual_id: null,
            });
          }
        });
      });

      console.log(`[SCHEDULE ALL] Total matches to insert: ${allMatchesToInsert.length}`);
      console.log(`[SCHEDULE ALL] First match sample:`, allMatchesToInsert[0]);

      if (allMatchesToInsert.length === 0) {
        throw new Error('No matches were generated. Please check that categories have at least 2 participants each.');
      }

      if (allMatchesToInsert.length > 0) {
        const { data: insertData, error: insertError } = await supabase
          .from('matches')
          .insert(allMatchesToInsert)
          .select();

        if (insertError) {
          console.error('[SCHEDULE ALL] Error inserting matches:', insertError);
          console.error('[SCHEDULE ALL] Error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          throw insertError;
        }

        console.log(`[SCHEDULE ALL] Successfully inserted ${insertData?.length || 0} matches`);
      }

      console.log(`[SCHEDULE ALL] About to refresh tournament data...`);
      await fetchTournamentData();
      console.log(`[SCHEDULE ALL] Tournament data refreshed, matches in state: ${matches.length}`);
      alert(`Successfully scheduled ${allMatchesToInsert.length} matches across ${categories.length} categories!`);
    } catch (error) {
      console.error('Error scheduling all categories:', error);
      alert('Failed to schedule matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSchedule = async () => {
    console.log('[AUTO SCHEDULE] Starting...', {
      isIndividualRoundRobin,
      format: currentTournament.format,
      round_robin_type: currentTournament.round_robin_type,
      individualPlayers: individualPlayers.length,
      teams: teams.length,
      categories: categories.length
    });

    if (categories.length === 1) {
      console.log('[AUTO SCHEDULE] Delegating to handleScheduleCategory');
      await handleScheduleCategory(categories[0].id);
      return;
    }

    if (categories.length > 1) {
      console.log('[AUTO SCHEDULE] Delegating to handleScheduleAllCategories');
      await handleScheduleAllCategories();
      return;
    }

    if (isIndividualRoundRobin) {
      console.log('[AUTO SCHEDULE] Individual round robin detected, players:', individualPlayers.length);
      if (individualPlayers.length < 2) {
        alert('You need at least 2 players to generate a schedule');
        return;
      }
    } else {
      console.log('[AUTO SCHEDULE] Team-based tournament, teams:', teams.length);
      if (teams.length < 2) {
        alert('You need at least 2 teams to generate a schedule');
        return;
      }
    }

    const confirmed = confirm(
      `This will automatically schedule all matches for the tournament across ${tournament.number_of_courts} court(s). Any existing unplayed matches will be removed. Continue?`
    );

    if (!confirmed) return;

    // Prevent double-clicks
    if (loading) {
      console.warn('[AUTO SCHEDULE] Already in progress, ignoring duplicate call');
      return;
    }

    const callId = Date.now();
    console.log(`[AUTO SCHEDULE ${callId}] Starting...`);

    setLoading(true);

    try {
      // First count how many matches exist
      const { count: existingCount } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id);

      console.log(`[AUTO SCHEDULE ${callId}] Found ${existingCount || 0} matches to delete`);

      // Now delete them using RPC
      const { data: deletedCount, error: deleteError } = await supabase.rpc('delete_matches_by_tournament', {
        p_tournament_id: tournament.id
      });

      if (deleteError) {
        console.error(`[AUTO SCHEDULE ${callId}] Delete RPC error:`, deleteError);
        throw deleteError;
      }

      console.log(`[AUTO SCHEDULE ${callId}] Actually deleted ${deletedCount} matches, now generating schedule...`);

      // Immediately clear local state
      setMatches([]);

      // Import validation function
      const { validateTournamentTime, calculateTotalMatches } = await import('../lib/scheduler');

      // Calculate total matches
      const numberOfPlayers = isIndividualRoundRobin ? individualPlayers.length : teams.length;

      // Calculate total matches based on format
      const totalMatches = isIndividualRoundRobin
        ? Math.floor(numberOfPlayers / 4) * (numberOfPlayers - 1) // American: (n/4) * (n-1) rounds
        : calculateTotalMatches(
            numberOfPlayers,
            currentTournament.format,
            (currentTournament as any).number_of_groups
          );

      const configuredDuration = (currentTournament as any).match_duration_minutes || 15;
      const numberOfCourts = currentTournament.number_of_courts || 1;

      // Validate if there's enough time (includes 5 min transitions)
      const validation = validateTournamentTime(
        totalMatches,
        numberOfCourts,
        currentTournament.start_date,
        currentTournament.end_date,
        (currentTournament as any).daily_start_time || '09:00',
        (currentTournament as any).daily_end_time || '21:00',
        configuredDuration,
        (currentTournament as any).daily_schedules || []
      );

      console.log('[AUTO SCHEDULE] Time validation:', validation);

      let matchDurationToUse = configuredDuration;

      if (!validation.isValid) {
        const hoursNeeded = Math.ceil(validation.totalTimeNeeded / 60);
        const hoursAvailable = Math.floor(validation.totalTimeAvailable / 60);

        const warningMessage = `⚠️ Not enough time!\n\n` +
          `Matches: ${totalMatches}\n` +
          `Current duration: ${configuredDuration} min + 5 min transition\n` +
          `Time needed: ${hoursNeeded}h\n` +
          `Time available: ${hoursAvailable}h\n\n` +
          `Suggested match duration: ${validation.suggestedMatchDuration} minutes\n\n` +
          `Use suggested duration?`;

        const useOptimal = confirm(warningMessage);
        if (useOptimal && validation.suggestedMatchDuration) {
          matchDurationToUse = validation.suggestedMatchDuration;
        } else if (!useOptimal) {
          setLoading(false);
          alert('Please adjust tournament dates, daily hours, or match duration before generating schedule.');
          return;
        }
      }

      let scheduledMatches;

      if (isIndividualGroupsKnockout) {
        console.log('[AUTO SCHEDULE] Using Individual Groups + Knockout scheduler');
        const numberOfGroups = currentTournament.number_of_groups || 4;
        const knockoutStage = (currentTournament as any).knockout_stage || 'semifinals';
        const qualifiedPerGroup = calculateQualifiedPerGroup(numberOfGroups, knockoutStage, true);

        console.log(`[AUTO SCHEDULE] Groups: ${numberOfGroups}, Stage: ${knockoutStage}, Qualified per group: ${qualifiedPerGroup} (individual)`);

        scheduledMatches = generateIndividualGroupsKnockoutSchedule(
          individualPlayers,
          numberOfGroups,
          currentTournament.number_of_courts || 1,
          currentTournament.start_date,
          (currentTournament as any).daily_start_time || '09:00',
          (currentTournament as any).daily_end_time || '21:00',
          matchDurationToUse,
          qualifiedPerGroup,
          knockoutStage
        );
      } else if (isIndividualRoundRobin) {
        console.log('[AUTO SCHEDULE] Using American format scheduler');
        scheduledMatches = generateAmericanSchedule(
          individualPlayers,
          currentTournament.number_of_courts || 1,
          currentTournament.start_date,
          currentTournament.start_time || '09:00',
          currentTournament.end_time || '21:00',
          matchDurationToUse,
          7
        );
      } else {
        scheduledMatches = generateTournamentSchedule(
          teams,
          currentTournament.number_of_courts || 1,
          currentTournament.start_date,
          currentTournament.format,
          (currentTournament as any).daily_start_time || '09:00',
          (currentTournament as any).daily_end_time || '21:00',
          matchDurationToUse,
          false,
          (currentTournament as any).daily_schedules || []
        );
      }

      console.log(`[AUTO SCHEDULE ${callId}] Generated ${scheduledMatches.length} matches`);
      console.log('[INSERT] About to insert', scheduledMatches.length, 'matches');
      console.log('[INSERT] First 5 matches:', scheduledMatches.slice(0, 5));
      console.log('[INSERT] First match details:', JSON.stringify(scheduledMatches[0], null, 2));

      // Check for duplicates in generated matches
      const timeCourtMap = new Map<string, any>();
      scheduledMatches.forEach((match, idx) => {
        const key = `${match.scheduled_time}_${match.court}`;
        if (timeCourtMap.has(key)) {
          console.error('[DUPLICATE FOUND]', 'Match', idx, 'conflicts with', timeCourtMap.get(key));
          console.error('  Match A:', timeCourtMap.get(key));
          console.error('  Match B:', match);
        } else {
          timeCourtMap.set(key, match);
        }
      });

      const matchesToInsert = scheduledMatches.map(match => {
        const baseMatch = {
          tournament_id: tournament.id,
          round: match.round,
          match_number: match.match_number,
          scheduled_time: match.scheduled_time,
          court: getCourtNameFromIndex(match.court),
          status: 'scheduled',
          team1_score_set1: 0,
          team2_score_set1: 0,
          team1_score_set2: 0,
          team2_score_set2: 0,
          team1_score_set3: 0,
          team2_score_set3: 0,
        };

        if (isIndividualRoundRobin || isIndividualGroupsKnockout) {
          const individualMatch = match as any;
          return {
            ...baseMatch,
            player1_individual_id: individualMatch.player1_id === 'TBD' ? null : (individualMatch.player1_id || null),
            player2_individual_id: individualMatch.player2_id === 'TBD' ? null : (individualMatch.player2_id || null),
            player3_individual_id: individualMatch.player3_id === 'TBD' ? null : (individualMatch.player3_id || null),
            player4_individual_id: individualMatch.player4_id === 'TBD' ? null : (individualMatch.player4_id || null),
            team1_id: null,
            team2_id: null,
          };
        } else {
          return {
            ...baseMatch,
            team1_id: match.team1_id,
            team2_id: match.team2_id,
            player1_individual_id: null,
            player2_individual_id: null,
          };
        }
      });

      console.log('[INSERT] Prepared', matchesToInsert.length, 'matches for insert');
      console.log('[INSERT] First prepared match:', JSON.stringify(matchesToInsert[0], null, 2));

      // Group by time and court to check what we're about to insert
      const groupedInserts = matchesToInsert.reduce((acc:any, m:any) => {
        const key = `${m.scheduled_time}_${m.court}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {});

      console.log('[INSERT] Grouped by time+court:', Object.entries(groupedInserts).map(([key, matches]:any) =>
        `${key}: ${matches.length} match(es)`
      ).join(', '));

      console.log(`[AUTO SCHEDULE ${callId}] Inserting ${matchesToInsert.length} matches into database...`);

      const { error } = await supabase
        .from('matches')
        .insert(matchesToInsert);

      console.log(`[AUTO SCHEDULE ${callId}] Insert complete, error:`, error);

      if (error) throw error;

      await fetchTournamentData();
      console.log(`[AUTO SCHEDULE ${callId}] SUCCESS! Schedule generated.`);
      alert(`Successfully scheduled ${scheduledMatches.length} matches!`);
    } catch (error) {
      console.error(`[AUTO SCHEDULE ${callId}] ERROR:`, error);
      alert('Failed to schedule matches. Please try again.');
    } finally {
      setLoading(false);
      console.log(`[AUTO SCHEDULE ${callId}] Finished.`);
    }
  };

  const getPlayerName = (playerId: string | null, useIndividualId: boolean = false): string => {
    if (!playerId) {
      console.log('[getPlayerName] No playerId provided');
      return 'TBD';
    }

    const player = individualPlayers.find(p => p.id === playerId);
    if (!player) {
      console.log('[getPlayerName] Player not found. PlayerId:', playerId, 'Available players:', individualPlayers.map(p => ({id: p.id, name: p.name})));
    }
    return player?.name || 'TBD';
  };

  const handleQuickScoreUpdate = async (matchId: string, field: string, value: number) => {
    try {
      // Update local state immediately for responsiveness
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, [field]: value } : m
      ));

      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      const updatedMatch = { ...match, [field]: value };

      // For round robin individual, we only use team1_score_set1 and team2_score_set1 as game scores
      const team1Score = field === 'team1_score_set1' ? value : (updatedMatch.team1_score_set1 || 0);
      const team2Score = field === 'team2_score_set1' ? value : (updatedMatch.team2_score_set1 || 0);

      let winnerId = null;
      let status = 'scheduled';

      // Determine winner and status - if both teams have scores > 0, mark as completed
      if (team1Score > 0 || team2Score > 0) {
        if (team1Score !== team2Score) {
          const isIndividualRR = currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual';
          // For individual round robin (americano), winner_id stays null as we track individual player stats
          if (!isIndividualRR) {
            winnerId = team1Score > team2Score ? match.team1_id : match.team2_id;
          }
          status = 'completed';
        }
      }

      // Update in database
      const { error } = await supabase
        .from('matches')
        .update({
          [field]: value,
          winner_id: winnerId,
          status: status
        })
        .eq('id', matchId);

      if (error) {
        console.error('Error updating match score:', error);
        // Revert local state on error
        setMatches(prev => prev.map(m =>
          m.id === matchId ? match : m
        ));
        return;
      }

      // Update local state with winner and status
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, winner_id: winnerId, status: status } : m
      ));
    } catch (error) {
      console.error('Error in quick score update:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMatchScore = (match: MatchWithTeams) => {
    if (match.status !== 'completed') return null;

    const sets = [];
    if (match.team1_score_set1 !== 0 || match.team2_score_set1 !== 0) {
      sets.push(`${match.team1_score_set1}-${match.team2_score_set1}`);
    }
    if (match.team1_score_set2 !== 0 || match.team2_score_set2 !== 0) {
      sets.push(`${match.team1_score_set2}-${match.team2_score_set2}`);
    }
    if (match.team1_score_set3 !== 0 || match.team2_score_set3 !== 0) {
      sets.push(`${match.team1_score_set3}-${match.team2_score_set3}`);
    }

    return sets.length > 0 ? sets.join(', ') : null;
  };

  const copyRegistrationLink = async () => {
    const registrationUrl = `${window.location.origin}${window.location.pathname}?register=${tournament.id}`;
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const copyLiveLink = async () => {
    const liveUrl = `${window.location.origin}/tournament/${tournament.id}/live`;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setLiveLinkCopied(true);
      setTimeout(() => setLiveLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy live link:', err);
    }
  };

  const handleExportPDF = async () => {
    const categoryToExport = selectedCategory && selectedCategory !== 'no-category' ? selectedCategory : undefined;
    await exportTournamentPDF(currentTournament, categoryToExport);
  };

  const handleDeleteTournament = async () => {
    try {
      const { data: players } = await supabase
        .from('players')
        .select('id, team_id')
        .in('team_id', teams.map(t => t.id));

      if (players) {
        await supabase
          .from('players')
          .delete()
          .in('id', players.map(p => p.id));
      }

      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournament.id);

      await supabase
        .from('teams')
        .delete()
        .eq('tournament_id', tournament.id);

      await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      onBack();
    } catch (err) {
      console.error('Error deleting tournament:', err);
    }
  };

  const handleCompleteTournament = async () => {
    if (!confirm('Tem a certeza que deseja finalizar este torneio? Isto calculará as posições finais e atualizará a classificação da liga (se aplicável).')) {
      return;
    }

    try {
      if (tournament.round_robin_type === 'individual') {
        // Calculate player statistics from completed matches
        const { data: completedMatches } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('status', 'completed');

        if (!completedMatches) {
          alert('Não há jogos concluídos para calcular as posições finais.');
          return;
        }

        const playerStatsMap = new Map();

        individualPlayers.forEach(player => {
          playerStatsMap.set(player.id, {
            id: player.id,
            name: player.name,
            wins: 0,
            losses: 0,
            gamesWon: 0,
            gamesLost: 0,
          });
        });

        completedMatches.forEach(match => {
          const player1Id = (match as any).player1_individual_id;
          const player2Id = (match as any).player2_individual_id;
          const player3Id = (match as any).player3_individual_id;
          const player4Id = (match as any).player4_individual_id;

          const team1Score = match.team1_score_set1 || 0;
          const team2Score = match.team2_score_set1 || 0;

          // Team 1 players
          if (player1Id && playerStatsMap.has(player1Id)) {
            const stats = playerStatsMap.get(player1Id);
            stats.gamesWon += team1Score;
            stats.gamesLost += team2Score;
            if (team1Score > team2Score) stats.wins++;
            else if (team1Score < team2Score) stats.losses++;
          }

          if (player2Id && playerStatsMap.has(player2Id)) {
            const stats = playerStatsMap.get(player2Id);
            stats.gamesWon += team1Score;
            stats.gamesLost += team2Score;
            if (team1Score > team2Score) stats.wins++;
            else if (team1Score < team2Score) stats.losses++;
          }

          // Team 2 players
          if (player3Id && playerStatsMap.has(player3Id)) {
            const stats = playerStatsMap.get(player3Id);
            stats.gamesWon += team2Score;
            stats.gamesLost += team1Score;
            if (team2Score > team1Score) stats.wins++;
            else if (team2Score < team1Score) stats.losses++;
          }

          if (player4Id && playerStatsMap.has(player4Id)) {
            const stats = playerStatsMap.get(player4Id);
            stats.gamesWon += team2Score;
            stats.gamesLost += team1Score;
            if (team2Score > team1Score) stats.wins++;
            else if (team2Score < team1Score) stats.losses++;
          }
        });

        const sortedPlayers = Array.from(playerStatsMap.values()).sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          const diffA = a.gamesWon - a.gamesLost;
          const diffB = b.gamesWon - b.gamesLost;
          if (diffB !== diffA) return diffB - diffA;
          return b.gamesWon - a.gamesWon;
        });

        for (let i = 0; i < sortedPlayers.length; i++) {
          await supabase
            .from('players')
            .update({ final_position: i + 1 })
            .eq('id', sortedPlayers[i].id);
        }
      } else {
        // Calculate team stats from completed matches (same logic as Standings)
        const { data: completedMatches } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('status', 'completed');

        if (!completedMatches) {
          alert('Não há jogos concluídos para calcular as posições finais.');
          return;
        }

        const teamStatsMap = new Map();

        teams.forEach(team => {
          teamStatsMap.set(team.id, {
            id: team.id,
            name: team.name,
            wins: 0,
            draws: 0,
            losses: 0,
            matchesPlayed: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
          });
        });

        completedMatches.forEach(match => {
          const team1Id = match.team1_id;
          const team2Id = match.team2_id;

          if (teamStatsMap.has(team1Id) && teamStatsMap.has(team2Id)) {
            const team1Stats = teamStatsMap.get(team1Id);
            const team2Stats = teamStatsMap.get(team2Id);

            team1Stats.matchesPlayed++;
            team2Stats.matchesPlayed++;

            // Calculate games
            const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
            const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);

            const isTeam1Winner = team1Games > team2Games;
            const isTeam2Winner = team2Games > team1Games;
            const isDraw = team1Games === team2Games;

            // Calculate sets
            let team1SetsCount = 0;
            let team2SetsCount = 0;
            if ((match.team1_score_set1 || 0) > (match.team2_score_set1 || 0)) team1SetsCount++;
            else if ((match.team1_score_set1 || 0) < (match.team2_score_set1 || 0)) team2SetsCount++;
            if ((match.team1_score_set2 || 0) > (match.team2_score_set2 || 0)) team1SetsCount++;
            else if ((match.team1_score_set2 || 0) < (match.team2_score_set2 || 0)) team2SetsCount++;
            if ((match.team1_score_set3 || 0) > (match.team2_score_set3 || 0)) team1SetsCount++;
            else if ((match.team1_score_set3 || 0) < (match.team2_score_set3 || 0)) team2SetsCount++;

            if (isDraw) {
              team1Stats.draws++;
              team2Stats.draws++;
            } else if (isTeam1Winner) {
              team1Stats.wins++;
              team2Stats.losses++;
            } else {
              team1Stats.losses++;
              team2Stats.wins++;
            }

            team1Stats.setsWon += team1SetsCount;
            team1Stats.setsLost += team2SetsCount;
            team1Stats.gamesWon += team1Games;
            team1Stats.gamesLost += team2Games;

            team2Stats.setsWon += team2SetsCount;
            team2Stats.setsLost += team1SetsCount;
            team2Stats.gamesWon += team2Games;
            team2Stats.gamesLost += team1Games;
          }
        });

        // Sort teams by actual stats from matches
        const sortedTeams = Array.from(teamStatsMap.values()).sort((a, b) => {
          // Sort by points (3 for win, 1 for draw)
          const pointsA = a.wins * 3 + a.draws;
          const pointsB = b.wins * 3 + b.draws;
          if (pointsB !== pointsA) return pointsB - pointsA;

          // Then by wins
          if (b.wins !== a.wins) return b.wins - a.wins;

          // Then by set difference
          const setDiffA = a.setsWon - a.setsLost;
          const setDiffB = b.setsWon - b.setsLost;
          if (setDiffB !== setDiffA) return setDiffB - setDiffA;

          // Then by game difference
          const gameDiffA = a.gamesWon - a.gamesLost;
          const gameDiffB = b.gamesWon - b.gamesLost;
          if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;

          // Finally by games won
          return b.gamesWon - a.gamesWon;
        });

        console.log('[COMPLETE-TOURNAMENT] Final team standings:', sortedTeams);

        for (let i = 0; i < sortedTeams.length; i++) {
          console.log(`[COMPLETE-TOURNAMENT] Setting team ${sortedTeams[i].name} to position ${i + 1}`);
          await supabase
            .from('teams')
            .update({ final_position: i + 1 })
            .eq('id', sortedTeams[i].id);
        }
      }

      await supabase
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', tournament.id);

      if ((tournament as any).league_id) {
        await updateLeagueStandings(tournament.id);
        alert('Torneio finalizado com sucesso! A classificação da liga foi atualizada.');
      } else {
        alert('Torneio finalizado com sucesso!');
      }

      onBack();
    } catch (err) {
      console.error('Error completing tournament:', err);
      alert('Erro ao finalizar torneio');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors print:hidden"
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        {t.nav.backToTournaments}
      </button>

      {(currentTournament as any).image_url && (
        <div className="w-full h-64 sm:h-80 rounded-xl overflow-hidden print:hidden">
          <img
            src={(currentTournament as any).image_url}
            alt={currentTournament.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 md:p-8 print:hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{currentTournament.name}</h1>
              <span
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium self-start ${getStatusColor(
                  currentTournament.status
                )}`}
              >
                {currentTournament.status}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={copyRegistrationLink}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs sm:text-sm font-medium"
              title="Copy registration link"
            >
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t.tournament.linkCopied}</span>
                  <span className="sm:hidden">{t.tournament.linkCopied}</span>
                </>
              ) : (
                <>
                  <Link className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t.tournament.registrationLink}</span>
                  <span className="sm:hidden">Link</span>
                </>
              )}
            </button>
            <button
              onClick={copyLiveLink}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs sm:text-sm font-medium"
              title="Copy live results link"
            >
              {liveLinkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Copiado</span>
                  <span className="sm:hidden">Copiado</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Página Ao Vivo</span>
                  <span className="sm:hidden">Live</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs sm:text-sm font-medium"
              title="Exportar resumo PDF"
            >
              <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Exportar PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={() => setShowManageCategories(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs sm:text-sm font-medium"
              title="Manage categories"
            >
              <FolderTree className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.tournament.categories}</span>
            </button>
            <button
              onClick={() => setShowEditTournament(true)}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={t.nav.editTournament}
            >
              <Edit className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
            {currentTournament.status !== 'completed' && (
              <button
                onClick={handleCompleteTournament}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                title={(currentTournament as any).league_id ? "Finalizar torneio e atualizar liga" : "Finalizar torneio"}
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Finalizar</span>
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 sm:p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete tournament"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Category:</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'text-white'
                        : 'text-white hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: getCategoryColor(category.id),
                      opacity: selectedCategory === category.id ? 1 : 0.9
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(currentTournament.format === 'groups_knockout' || currentTournament.format === 'individual_groups_knockout') && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                      disabled={loading || (currentTournament.format === 'individual_groups_knockout' ? individualPlayers.length < 4 : teams.length < 2)}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                    >
                      <FolderTree className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">{t.button.assignGroups}</span>
                      <span className="xs:hidden">Grupos</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {showGroupDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
                        <button
                          onClick={() => {
                            setShowGroupDropdown(false);
                            handleAssignGroups();
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Shuffle className="w-4 h-4" />
                          Aleatorio
                        </button>
                        <button
                          onClick={() => {
                            setShowGroupDropdown(false);
                            setShowManualGroupAssignment(true);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Hand className="w-4 h-4" />
                          Manual
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={handleAutoSchedule}
                  disabled={loading}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                >
                  <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t.match.autoSchedule}</span>
                  <span className="xs:hidden">Auto</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedMatchId(undefined);
                    setShowMatchModal(true);
                  }}
                  disabled={loading}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t.match.manualSchedule}</span>
                  <span className="xs:hidden">Manual</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">{t.tournament.startDate}</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {formatDate(currentTournament.start_date)} - {formatDate(currentTournament.end_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-purple-50 rounded-lg">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">{t.tournament.startTime}</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {currentTournament.start_time || '09:00'} - {currentTournament.end_time || '21:00'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">{t.nav.teams}</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {selectedCategory && selectedCategory !== 'no-category'
                  ? filteredTeams.length + filteredIndividualPlayers.length
                  : teams.length + individualPlayers.length} / {selectedCategory && selectedCategory !== 'no-category'
                  ? (categories.find(c => c.id === selectedCategory)?.max_teams || currentTournament.max_teams)
                  : currentTournament.max_teams}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 bg-orange-50 rounded-lg">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">{t.tournament.format}</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {t.format[currentTournament.format as keyof typeof t.format]}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto print:hidden">
        <div className="flex gap-4 sm:gap-8 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 sm:pb-4 px-1 border-b-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.nav.overview}
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`pb-3 sm:pb-4 px-1 border-b-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'teams'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {isIndividualRoundRobin || isIndividualGroupsKnockout
              ? `${t.nav.players} (${filteredIndividualPlayers.length})`
              : `${t.nav.teams} (${filteredTeams.length})`}
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`pb-3 sm:pb-4 px-1 border-b-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'matches'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.nav.matches} ({matches.length})
          </button>
          <button
            onClick={() => setActiveTab('standings')}
            className={`pb-3 sm:pb-4 px-1 border-b-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'standings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.nav.standings}
          </button>
          {categories.some(c => c.format === 'groups_knockout' || c.format === 'individual_groups_knockout') && (
            <button
              onClick={() => setActiveTab('knockout')}
              className={`pb-3 sm:pb-4 px-1 border-b-2 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'knockout'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                {t.nav.knockout}
              </span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2 print:hidden">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.tournament.recentMatches}</h3>
            </div>
            {matches.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t.match.noMatches}</p>
            ) : (
              <div className="space-y-3">
                {matches.slice(0, 5).map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'
                          ? `${getPlayerName((match as any).player1_individual_id)} vs ${getPlayerName((match as any).player2_individual_id)}`
                          : `${match.team1?.name || 'TBD'} vs ${match.team2?.name || 'TBD'}`}
                      </p>
                      <p className="text-xs text-gray-500">{match.round}</p>
                    </div>
                    {match.status === 'completed' && (
                      <span className="font-semibold text-gray-900">{getMatchScore(match)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.tournament.topTeams}</h3>
            </div>
            {teams.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t.team.noTeams}</p>
            ) : (
              <div className="space-y-3">
                {teams.slice(0, 5).map((team, index) => (
                  <div key={team.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{team.name}</p>
                      <p className="text-xs text-gray-500">
                        {team.player1.name} & {team.player2.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-4 sm:space-y-6">
          {categories.length > 0 && !(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Category:</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'text-white'
                        : 'text-white hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: getCategoryColor(category.id),
                      opacity: selectedCategory === category.id ? 1 : 0.9
                    }}
                  >
                    {category.name}
                  </button>
                ))}
                {teams.some(t => !t.category_id) && (
                  <button
                    onClick={() => setSelectedCategory('no-category')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      selectedCategory === 'no-category'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    No Category
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {isIndividualFormat() ? t.nav.players : t.nav.teams}
              </h3>
              <button
                onClick={() => {
                  if (isIndividualFormat()) {
                    setShowAddPlayer(true);
                  } else {
                    setShowAddTeam(true);
                  }
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  {isIndividualFormat() ? t.nav.addPlayer : t.team.add}
                </span>
                <span className="sm:hidden">{t.button.add}</span>
              </button>
            </div>
            {(isIndividualRoundRobin || isIndividualGroupsKnockout ? filteredIndividualPlayers.length === 0 : filteredTeams.length === 0) ? (
              <div className="text-center py-8 sm:py-12">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-500 mb-3 sm:mb-4">
                  {isIndividualFormat()
                    ? t.player.noPlayers
                    : t.team.noTeams}
                </p>
                <button
                  onClick={() => {
                    if (isIndividualFormat()) {
                      setShowAddPlayer(true);
                    } else {
                      setShowAddTeam(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  {isIndividualFormat()
                    ? t.player.registerFirst
                    : t.team.registerFirst}
                </button>
              </div>
            ) : isIndividualRoundRobin || isIndividualGroupsKnockout ? (
              <>
                {isIndividualGroupsKnockout && filteredIndividualPlayers.some(p => p.group_name) && (() => {
                  const playersByGroup = getPlayersByGroup(filteredIndividualPlayers);
                  const sortedGroups = Array.from(playersByGroup.keys()).sort();

                  return (
                    <div className="space-y-6 mb-6">
                      <h4 className="text-md font-semibold text-gray-700">Group Assignments</h4>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sortedGroups.map(groupName => (
                          <div key={groupName} className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-center mb-4">
                              <span className="px-4 py-2 bg-blue-600 text-white font-bold text-lg rounded-lg">
                                Group {groupName}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {playersByGroup.get(groupName)!.map(player => (
                                <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                      {player.name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-semibold text-gray-900">{player.name}</p>
                                  </div>
                                  {(player.email || player.phone_number) && (
                                    <p className="text-xs text-gray-500 mt-1 ml-10">
                                      {player.email || player.phone_number}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <h4 className="text-md font-semibold text-gray-700 mb-4">
                  {isIndividualGroupsKnockout && filteredIndividualPlayers.some(p => p.group_name) ? 'All Players' : 'Players'}
                </h4>
                <div className="grid gap-3 sm:gap-4">
                  {filteredIndividualPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{player.name}</p>
                            {player.group_name && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                Grupo {player.group_name}
                              </span>
                            )}
                          </div>
                          {(player.email || player.phone_number) && (
                            <p className="text-sm text-gray-500">
                              {player.email || player.phone_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedPlayer(player);
                            setShowEditPlayer(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Editar jogador"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : categories.length > 1 ? (
              <div className="space-y-4 sm:space-y-6">
                {selectedCategory === 'no-category' ? (
                  <div className="border-2 border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h4 className="text-base sm:text-lg font-semibold text-gray-900">No Category</h4>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-50 text-blue-700 text-xs sm:text-sm rounded-lg font-medium">
                        {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
                      </span>
                    </div>

                    {filteredTeams.length === 0 ? (
                      <p className="text-gray-500 text-center py-4 text-sm">{t.team.noTeams}</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {filteredTeams.map((team) => (
                          <div key={team.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{team.name}</h5>
                              <div className="flex items-center gap-2">
                                {team.seed && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                                    {t.team.seedNumber}{team.seed}
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setShowEditTeam(true);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit team"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-gray-600" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                  {team.player1.name.charAt(0)}
                                </div>
                                <span className="text-xs">{team.player1.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                  {team.player2.name.charAt(0)}
                                </div>
                                <span className="text-xs">{team.player2.name}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {categories
                      .filter(category => !selectedCategory || category.id === selectedCategory)
                      .map((category) => {
                      const isIndividualCategory = category.format === 'individual_groups_knockout' || (category.format === 'round_robin' && currentTournament.round_robin_type === 'individual');
                      const categoryTeams = teams.filter(t => t.category_id === category.id);
                      const categoryPlayers = individualPlayers.filter(p => p.category_id === category.id);
                      const itemCount = isIndividualCategory ? categoryPlayers.length : categoryTeams.length;
                      const itemLabel = isIndividualCategory ? (itemCount === 1 ? 'player' : 'players') : (itemCount === 1 ? 'team' : 'teams');

                      return (
                        <div key={category.id} className="border-2 border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">{category.name}</h4>
                            <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-50 text-blue-700 text-xs sm:text-sm rounded-lg font-medium">
                              {itemCount} {itemLabel}
                            </span>
                          </div>

                          {itemCount === 0 ? (
                            <p className="text-gray-500 text-center py-4 text-sm">
                              {isIndividualCategory ? t.player.noPlayers : t.team.noTeams}
                            </p>
                          ) : isIndividualCategory ? (
                            <>
                              {category.format === 'individual_groups_knockout' && categoryPlayers.some(p => p.group_name) && (() => {
                                const playersByGroup = getPlayersByGroup(categoryPlayers);
                                const sortedGroups = Array.from(playersByGroup.keys()).sort();

                                return (
                                  <div className="mb-4">
                                    <h5 className="text-sm font-semibold text-gray-600 mb-3">Group Assignments</h5>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {sortedGroups.map(groupName => (
                                        <div key={groupName} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                                          <div className="flex items-center justify-center mb-3">
                                            <span className="px-3 py-1 bg-blue-600 text-white font-bold text-sm rounded-lg">
                                              Group {groupName}
                                            </span>
                                          </div>
                                          <div className="space-y-2">
                                            {playersByGroup.get(groupName)!.map(player => (
                                              <div key={player.id} className="bg-white border border-gray-200 rounded p-2">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                    {player.name.charAt(0).toUpperCase()}
                                                  </div>
                                                  <p className="font-semibold text-gray-900 text-sm">{player.name}</p>
                                                </div>
                                                {(player.email || player.phone_number) && (
                                                  <p className="text-xs text-gray-500 mt-1 ml-8">
                                                    {player.email || player.phone_number}
                                                  </p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="grid gap-3 sm:gap-4">
                                {categoryPlayers.map((player) => (
                                  <div key={player.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                        {player.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-semibold text-gray-900">{player.name}</p>
                                          {player.group_name && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                              Grupo {player.group_name}
                                            </span>
                                          )}
                                        </div>
                                        {(player.email || player.phone_number) && (
                                          <p className="text-sm text-gray-500">
                                            {player.email || player.phone_number}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Remove ${player.name}?`)) {
                                          const { error } = await supabase
                                            .from('players')
                                            .delete()
                                            .eq('id', player.id);

                                          if (error) {
                                            alert('Error removing player: ' + error.message);
                                          } else {
                                            fetchTournamentData();
                                          }
                                        }
                                      }}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Remove player"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                        <>
                          {category.format === 'groups_knockout' && categoryTeams.some(t => t.group_name) && (() => {
                            const teamsByGroup = getTeamsByGroup(categoryTeams);
                            const sortedGroups = Array.from(teamsByGroup.keys()).sort();

                            return (
                              <div className="mb-4">
                                <h5 className="text-sm font-semibold text-gray-600 mb-3">Group Assignments</h5>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {sortedGroups.map(groupName => (
                                    <div key={groupName} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                                      <div className="flex items-center justify-center mb-3">
                                        <span className="px-3 py-1 bg-blue-600 text-white font-bold text-sm rounded-lg">
                                          Group {groupName}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {teamsByGroup.get(groupName)!.map(team => (
                                          <div key={team.id} className="bg-white border border-gray-200 rounded p-2">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">{team.name}</p>
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                                  {(team as any).player1?.name?.charAt(0) || 'P'}
                                                </div>
                                                <span>{(team as any).player1?.name || 'Player 1'}</span>
                                              </div>
                                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                                  {(team as any).player2?.name?.charAt(0) || 'P'}
                                                </div>
                                                <span>{(team as any).player2?.name || 'Player 2'}</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="grid gap-3 md:grid-cols-2">
                            {categoryTeams.map((team) => (
                              <div key={team.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-semibold text-gray-900">{team.name}</h5>
                                  <div className="flex items-center gap-2">
                                    {team.seed && (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                                        {t.team.seedNumber}{team.seed}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedTeam(team);
                                        setShowEditTeam(true);
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                                      title="Edit team"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                      {team.player1.name.charAt(0)}
                                    </div>
                                    <span className="text-xs">{team.player1.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                      {team.player2.name.charAt(0)}
                                    </div>
                                    <span className="text-xs">{team.player2.name}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                  </>
                )}
              </div>
            ) : (
              <>
                {currentTournament.format === 'groups_knockout' && teams.some(t => t.group_name) && (() => {
                  const teamsByGroup = getTeamsByGroup(teams);
                  const sortedGroups = Array.from(teamsByGroup.keys()).sort();

                  return (
                    <div className="space-y-6 mb-6">
                      <h4 className="text-md font-semibold text-gray-700">Group Assignments</h4>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sortedGroups.map(groupName => (
                          <div key={groupName} className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-center mb-4">
                              <span className="px-4 py-2 bg-blue-600 text-white font-bold text-lg rounded-lg">
                                Group {groupName}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {teamsByGroup.get(groupName)!.map(team => (
                                <div key={team.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <h5 className="font-semibold text-gray-900 mb-2">{team.name}</h5>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                        {(team as any).player1?.name?.charAt(0) || 'P'}
                                      </div>
                                      <span>{(team as any).player1?.name || 'Player 1'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                                        {(team as any).player2?.name?.charAt(0) || 'P'}
                                      </div>
                                      <span>{(team as any).player2?.name || 'Player 2'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <h4 className="text-md font-semibold text-gray-700 mb-4">
                  {currentTournament.format === 'groups_knockout' && filteredTeams.some(t => t.group_name) ? 'All Teams' : 'Teams'}
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTeams.map((team) => {
                    const teamCategory = categories.find(c => c.id === team.category_id);
                    return (
                      <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{team.name}</h4>
                            {teamCategory && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium">
                                {teamCategory.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {team.seed && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                                {t.team.seedNumber}{team.seed}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedTeam(team);
                                setShowEditTeam(true);
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                              title="Edit team"
                            >
                              <Pencil className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                              {team.player1.name.charAt(0)}
                            </div>
                            <span>{team.player1.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                              {team.player2.name.charAt(0)}
                            </div>
                            <span>{team.player2.name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-6">
          {categories.length > 0 && !(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Category:</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'text-white'
                        : 'text-white hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: getCategoryColor(category.id),
                      opacity: selectedCategory === category.id ? 1 : 0.9
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categories.length > 0 ? (
            <>
              {categories.length > 1 && !selectedCategory && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6 print:hidden">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t.category.allCategories} - {t.category.globalView}</h3>
                      <p className="text-sm text-gray-500">
                        {matches.length} total matches across {categories.length} categories
                      </p>
                    </div>
                  </div>
                  <MatchScheduleView
                    matches={matches}
                    isIndividualRoundRobin={(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'}
                    individualPlayers={individualPlayers}
                    categories={categories}
                    showCategoryLabels={true}
                    printTitle={`${tournament.name} - ${t.category.allCategories}`}
                    onMatchClick={(matchId) => {
                      setSelectedMatchId(matchId);
                      setShowMatchModal(true);
                    }}
                  />
                </div>
              )}
              {categories
                .filter(category => !selectedCategory || category.id === selectedCategory)
                .map((category) => {
                const categoryMatches = matches
                  .filter(m => m.category_id === category.id)
                  .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
                const categoryTeams = teams.filter(t => t.category_id === category.id);

              return (
                <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6 print:hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-500">
                        {category.format === 'single_elimination' && 'Single Elimination'}
                        {category.format === 'round_robin' && 'Round Robin'}
                        {category.format === 'groups_knockout' && 'Groups + Knockout'}
                        {category.format === 'individual_groups_knockout' && 'Individual Groups + Knockout'}
                        {' '} • {categoryTeams.length} teams • {categoryMatches.length} matches
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {category.format === 'groups_knockout' &&
                       categoryMatches.some(m => m.round.startsWith('group_')) &&
                       !categoryMatches.some(m => !m.round.startsWith('group_')) && (
                        <button
                          onClick={() => handleAdvanceToKnockout(category.id)}
                          disabled={loading}
                          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 text-xs sm:text-sm"
                        >
                          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {t.match.advanceToKnockout}
                        </button>
                      )}
                    </div>
                  </div>

                  {categoryMatches.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">{t.match.noMatches}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {category.format === 'groups_knockout' && (() => {
                        const groupMatches = categoryMatches.filter(m => m.round.startsWith('group_'));
                        const knockoutMatches = categoryMatches.filter(m => !m.round.startsWith('group_'));

                        // Group matches by team's group_name, then sort by time
                        const matchesByGroup = new Map<string, MatchWithTeams[]>();
                        groupMatches.forEach(match => {
                          const groupName = match.team1?.group_name || 'Unknown';
                          if (!matchesByGroup.has(groupName)) {
                            matchesByGroup.set(groupName, []);
                          }
                          matchesByGroup.get(groupName)!.push(match);
                        });

                        // Sort groups and matches within each group by time
                        const sortedGroups = Array.from(matchesByGroup.keys()).sort();
                        sortedGroups.forEach(groupName => {
                          const matches = matchesByGroup.get(groupName)!;
                          matches.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
                        });

                        return (
                          <>
                            <MatchScheduleView
                              matches={categoryMatches}
                              isIndividualRoundRobin={(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'}
                              individualPlayers={individualPlayers}
                              printTitle={`${tournament.name} - ${category.name}`}
                              onMatchClick={(matchId) => {
                                setSelectedMatchId(matchId);
                                setShowMatchModal(true);
                              }}
                            />

                            {knockoutMatches.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">{t.match.knockoutStageBracket}</h4>
                                <BracketView
                                  matches={knockoutMatches}
                                  isIndividual={false}
                                  onMatchClick={(matchId) => {
                                    setSelectedMatchId(matchId);
                                    setShowMatchModal(true);
                                  }}
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {category.format !== 'groups_knockout' && (
                        <MatchScheduleView
                          matches={categoryMatches}
                          isIndividualRoundRobin={(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'}
                          individualPlayers={individualPlayers}
                          printTitle={`${tournament.name} - ${category.name}`}
                          onMatchClick={(matchId) => {
                            setSelectedMatchId(matchId);
                            setShowMatchModal(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
              })}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Matches</h3>
                <div className="flex flex-wrap gap-2">
                  {(currentTournament.format === 'groups_knockout' || currentTournament.format === 'individual_groups_knockout') && (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                        disabled={loading || (currentTournament.format === 'individual_groups_knockout' ? individualPlayers.length < 4 : teams.length < 2)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                      >
                        <FolderTree className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden xs:inline">{t.button.assignGroups}</span>
                        <span className="xs:hidden">Grupos</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showGroupDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
                          <button
                            onClick={() => {
                              setShowGroupDropdown(false);
                              handleAssignGroups();
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Shuffle className="w-4 h-4" />
                            Aleatorio
                          </button>
                          <button
                            onClick={() => {
                              setShowGroupDropdown(false);
                              setShowManualGroupAssignment(true);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Hand className="w-4 h-4" />
                            Manual
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleAutoSchedule}
                    disabled={loading}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                  >
                    <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{t.match.autoSchedule}</span>
                    <span className="xs:hidden">Auto</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMatchId(undefined);
                      setShowMatchModal(true);
                    }}
                    disabled={loading}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{t.match.manualSchedule}</span>
                    <span className="xs:hidden">Manual</span>
                  </button>
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">{t.match.noMatches}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={handleAutoSchedule}
                      disabled={loading || (currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual' ? individualPlayers.length < 2 : teams.length < 2)}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                    >
                      <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {t.match.autoSchedule}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMatchId(undefined);
                        setShowMatchModal(true);
                      }}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {t.match.manualSchedule}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.length > 0 && (
                    <div className="space-y-6">
                      {categories.map(category => {
                        const categoryMatches = matches
                          .filter(m => m.category_id === category.id)
                          .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
                        if (categoryMatches.length === 0) return null;

                        return (
                          <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                              <h4 className="font-semibold text-gray-900">{category.name}</h4>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {categoryMatches.length} matches
                              </p>
                            </div>
                            <div className="p-4 space-y-2">
                              {categoryMatches.map(match => (
                                <div
                                  key={match.id}
                                  className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-500">
                                      Match {match.match_number}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        match.status === 'completed'
                                          ? 'bg-green-100 text-green-800'
                                          : match.status === 'in_progress'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {match.status}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-2">
                                    <div className="text-right">
                                      <p className="font-semibold text-gray-900 text-sm mb-1">
                                        {(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'
                                          ? `${getPlayerName((match as any).player1_individual_id)} / ${getPlayerName((match as any).player2_individual_id)}`
                                          : match.team1?.name || 'TBD'}
                                      </p>
                                      <div className="flex gap-1 justify-end">
                                        <input
                                          type="number"
                                          min="0"
                                          max="99"
                                          value={match.team1_score_set1 || 0}
                                          onChange={(e) => handleQuickScoreUpdate(match.id, 'team1_score_set1', parseInt(e.target.value) || 0)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-16 h-9 text-center border-2 border-gray-300 rounded-md text-base font-semibold focus:border-blue-500 focus:outline-none"
                                          placeholder="0"
                                        />
                                      </div>
                                    </div>
                                    <div className="text-center px-2">
                                      <span className="text-lg text-gray-400 font-bold">-</span>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-semibold text-gray-900 text-sm mb-1">
                                        {(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'
                                          ? `${getPlayerName((match as any).player3_individual_id)} / ${getPlayerName((match as any).player4_individual_id)}`
                                          : match.team2?.name || 'TBD'}
                                      </p>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          min="0"
                                          max="99"
                                          value={match.team2_score_set1 || 0}
                                          onChange={(e) => handleQuickScoreUpdate(match.id, 'team2_score_set1', parseInt(e.target.value) || 0)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-16 h-9 text-center border-2 border-gray-300 rounded-md text-base font-semibold focus:border-blue-500 focus:outline-none"
                                          placeholder="0"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  {(match.scheduled_time || match.court) && (
                                    <div className="flex gap-3 text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                                      {match.scheduled_time && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          {new Date(match.scheduled_time).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: false
                                          })}
                                        </span>
                                      )}
                                      {match.court && (
                                        <span className="flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          Court {match.court}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {categories.length === 0 && (
                    <MatchScheduleView
                      matches={matches}
                      isIndividualRoundRobin={(currentTournament.format === 'round_robin' && currentTournament.round_robin_type === 'individual') || currentTournament.format === 'individual_groups_knockout'}
                      individualPlayers={individualPlayers}
                      printTitle={tournament.name}
                      onMatchClick={(matchId) => {
                        setSelectedMatchId(matchId);
                        setShowMatchModal(true);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div>
          {categories.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.category.allCategories}
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          {selectedCategory ? (
            (() => {
              const selectedCategoryData = categories.find(c => c.id === selectedCategory);
              const categoryMatches = matches
                .filter(m => m.category_id === selectedCategory)
                .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

              if (!selectedCategoryData) return null;

              return (
                <div className="space-y-6">
                  {selectedCategoryData.format === 'single_elimination' && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tournament Bracket</h3>
                      <BracketView
                        matches={categoryMatches}
                        onMatchClick={(matchId) => {
                          setSelectedMatchId(matchId);
                          setShowMatchModal(true);
                        }}
                      />
                    </div>
                  )}

                  <Standings
                    key={`standings-${selectedCategory}-${matches.length}-${matches.filter(m => m.status === 'completed').length}-${refreshKey}`}
                    tournamentId={currentTournament.id}
                    format={selectedCategoryData.format}
                    categoryId={selectedCategory}
                    roundRobinType={currentTournament.round_robin_type}
                    refreshKey={refreshKey}
                    qualifiedPerGroup={(selectedCategoryData as any).qualified_per_group || 2}
                  />
                </div>
              );
            })()
          ) : (
            <div className="space-y-6">
              {categories.map(category => {
                const categoryMatches = matches
                  .filter(m => m.category_id === category.id)
                  .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

                return (
                  <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {category.format === 'single_elimination' && 'Single Elimination'}
                      {category.format === 'round_robin' && 'Round Robin'}
                      {category.format === 'groups_knockout' && 'Groups + Knockout'}
                      {category.format === 'individual_groups_knockout' && 'Individual Groups + Knockout'}
                    </p>
                    <p className="text-sm text-gray-500">Select this category above to view bracket and standings</p>
                  </div>
                );
              })}
            </div>
          )}

          {categories.length === 0 && (
            <Standings
              key={`standings-no-cat-${matches.length}-${matches.filter(m => m.status === 'completed').length}-${refreshKey}`}
              tournamentId={currentTournament.id}
              format={currentTournament.format}
              categoryId={null}
              roundRobinType={currentTournament.round_robin_type}
              refreshKey={refreshKey}
              qualifiedPerGroup={currentTournament.qualified_per_group || 2}
            />
          )}
        </div>
      )}

      {activeTab === 'knockout' && (
        <div className="space-y-6">
          {categories.length > 1 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.category.selectCategory}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.category.allCategories}
                </button>
                {categories.filter(c => c.format === 'groups_knockout' || c.format === 'individual_groups_knockout').map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categories.filter(c => c.format === 'groups_knockout').filter(c => selectedCategory === null || c.id === selectedCategory).map(category => {
            const categoryMatches = matches
              .filter(m => m.category_id === category.id)
              .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
            const categoryTeams = teams.filter(t => t.category_id === category.id);
            const groupMatches = categoryMatches.filter(m => m.round.startsWith('group_'));
            const knockoutMatches = categoryMatches.filter(m => !m.round.startsWith('group_'));

            return (
              <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{category.name}</h3>
                    <p className="text-sm text-gray-600">
                      {categoryTeams.length} teams • {category.number_of_groups || 2} groups
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!knockoutMatches.some(m => m.status !== 'scheduled') && knockoutMatches.length === 0 && (
                      <button
                        onClick={() => handleAdvanceToKnockout(category.id)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50"
                      >
                        <Trophy className="w-5 h-5" />
                        {t.match.advanceToKnockout}
                      </button>
                    )}
                  </div>
                </div>

                {(() => {
                  // Calculate qualified teams in real-time
                  const teamsByGroup = new Map<string, typeof categoryTeams>();
                  categoryTeams.forEach(team => {
                    if (team.group_name) {
                      if (!teamsByGroup.has(team.group_name)) {
                        teamsByGroup.set(team.group_name, []);
                      }
                      teamsByGroup.get(team.group_name)!.push(team);
                    }
                  });

                  const sortedGroups = Array.from(teamsByGroup.keys()).sort();
                  const completedMatches = groupMatches.filter(m => m.status === 'completed');
                  const totalGroupMatches = groupMatches.length;
                  const allGroupsComplete = completedMatches.length === totalGroupMatches && totalGroupMatches > 0;

                  // Calculate standings for each group
                  const groupStandings = new Map<string, any[]>();
                  sortedGroups.forEach(groupName => {
                    const groupTeamList = teamsByGroup.get(groupName)!;
                    const groupMatchList = groupMatches.filter(m =>
                      groupTeamList.some(t => t.id === m.team1_id || t.id === m.team2_id)
                    );

                    const teamStats = new Map<string, { wins: number; gamesWon: number; gamesLost: number }>();
                    groupTeamList.forEach(team => {
                      teamStats.set(team.id, { wins: 0, gamesWon: 0, gamesLost: 0 });
                    });

                    groupMatchList.forEach(match => {
                      if (match.status === 'completed') {
                        const team1Stats = teamStats.get(match.team1_id);
                        const team2Stats = teamStats.get(match.team2_id);

                        if (team1Stats && team2Stats) {
                          const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
                          const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);

                          team1Stats.gamesWon += team1Games;
                          team1Stats.gamesLost += team2Games;
                          team2Stats.gamesWon += team2Games;
                          team2Stats.gamesLost += team1Games;

                          if (team1Games > team2Games) {
                            team1Stats.wins++;
                          } else if (team2Games > team1Games) {
                            team2Stats.wins++;
                          }
                        }
                      }
                    });

                    const sortedTeams = groupTeamList
                      .map(team => ({
                        ...team,
                        stats: teamStats.get(team.id)!
                      }))
                      .sort((a, b) => {
                        if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
                        const diffA = a.stats.gamesWon - a.stats.gamesLost;
                        const diffB = b.stats.gamesWon - b.stats.gamesLost;
                        return diffB - diffA;
                      });

                    groupStandings.set(groupName, sortedTeams);
                  });

                  const knockoutStage = (category as any).knockout_stage || (currentTournament as any).knockout_stage || 'quarterfinals';
                  const numGroups = sortedGroups.length;
                  const targetTeams = knockoutStage === 'semifinals' ? 4 : knockoutStage === 'quarterfinals' ? 8 : 16;
                  const guaranteedPerGroup = Math.floor(targetTeams / numGroups);
                  const remainingSpots = targetTeams - (guaranteedPerGroup * numGroups);

                  // Determine if we need best 2nds or best 3rds
                  // If we take top 1 from each group, we need best 2nds
                  // If we take top 2 from each group, we need best 3rds
                  const needBestSeconds = guaranteedPerGroup === 1 && remainingSpots > 0;
                  const needBestThirds = guaranteedPerGroup === 2 && remainingSpots > 0;

                  // Define knockout bracket structure based on target teams
                  let bracketStructure: Array<{ team1Label: string; team2Label: string; team1?: any; team2?: any }> = [];

                  if (targetTeams === 4) {
                    // Semifinals (4 teams)
                    if (numGroups === 4) {
                      // 4 groups, top 1 each = 4 teams
                      bracketStructure = [
                        { team1Label: '1º Group A', team2Label: '1º Group B' },
                        { team1Label: '1º Group C', team2Label: '1º Group D' },
                      ];
                    } else if (numGroups === 3) {
                      // 3 groups, top 1 each + best 2nd = 4 teams
                      bracketStructure = [
                        { team1Label: '1º Group A', team2Label: 'Best 2nd' },
                        { team1Label: '1º Group B', team2Label: '1º Group C' },
                      ];
                    } else if (numGroups === 2) {
                      // 2 groups, top 2 each = 4 teams
                      bracketStructure = [
                        { team1Label: '1º Group A', team2Label: '2º Group B' },
                        { team1Label: '1º Group B', team2Label: '2º Group A' },
                      ];
                    }
                  } else if (targetTeams === 8) {
                    // Quarterfinals (8 teams)
                    if (numGroups === 4) {
                      // 4 groups, top 2 each = 8 teams
                      bracketStructure = [
                        { team1Label: '1º Group A', team2Label: '2º Group B' },
                        { team1Label: '1º Group C', team2Label: '2º Group D' },
                        { team1Label: '1º Group B', team2Label: '2º Group A' },
                        { team1Label: '1º Group D', team2Label: '2º Group C' },
                      ];
                    } else if (numGroups === 3) {
                      // 3 groups, top 2 each + 2 best thirds = 8 teams
                      bracketStructure = [
                        { team1Label: '1º Group A', team2Label: 'Best 3rd #1' },
                        { team1Label: '2º Group B', team2Label: '2º Group C' },
                        { team1Label: '1º Group C', team2Label: 'Best 3rd #2' },
                        { team1Label: '1º Group B', team2Label: '2º Group A' },
                      ];
                    }
                  } else if (targetTeams === 16) {
                    // Round of 16 (16 teams) - simplified, actual structure would be more complex
                    // This would need more sophisticated logic based on number of groups
                  }

                  // Fill in actual team names per group as they complete
                  const qualifiedTeams = new Map<string, any>();

                  // Check which groups are complete individually
                  sortedGroups.forEach(groupName => {
                    const groupTeamList = teamsByGroup.get(groupName)!;
                    const groupMatchList = groupMatches.filter(m =>
                      groupTeamList.some(t => t.id === m.team1_id || t.id === m.team2_id)
                    );
                    const groupCompletedMatches = groupMatchList.filter(m => m.status === 'completed');
                    const isGroupComplete = groupMatchList.length > 0 && groupCompletedMatches.length === groupMatchList.length;

                    if (isGroupComplete) {
                      const standings = groupStandings.get(groupName)!;
                      standings.slice(0, guaranteedPerGroup).forEach((team, idx) => {
                        qualifiedTeams.set(`${idx + 1}º Group ${groupName}`, team);
                      });
                    }
                  });

                  // Calculate best seconds if all groups are complete and needed
                  if (allGroupsComplete && needBestSeconds) {
                    const secondPlaceTeams: any[] = [];
                    sortedGroups.forEach(groupName => {
                      const standings = groupStandings.get(groupName)!;
                      if (standings.length >= 2) {
                        secondPlaceTeams.push(standings[1]);
                      }
                    });

                    secondPlaceTeams.sort((a, b) => {
                      if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
                      const diffA = a.stats.gamesWon - a.stats.gamesLost;
                      const diffB = b.stats.gamesWon - b.stats.gamesLost;
                      return diffB - diffA;
                    });

                    // Add best second(s) to qualified teams map
                    for (let i = 0; i < Math.min(remainingSpots, secondPlaceTeams.length); i++) {
                      qualifiedTeams.set(i === 0 ? 'Best 2nd' : `Best 2nd #${i + 1}`, secondPlaceTeams[i]);
                    }
                  }

                  // Calculate best thirds if all groups are complete and needed
                  if (allGroupsComplete && needBestThirds) {
                    const thirdPlaceTeams: any[] = [];
                    sortedGroups.forEach(groupName => {
                      const standings = groupStandings.get(groupName)!;
                      if (standings.length >= 3) {
                        thirdPlaceTeams.push(standings[2]);
                      }
                    });

                    thirdPlaceTeams.sort((a, b) => {
                      if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
                      const diffA = a.stats.gamesWon - a.stats.gamesLost;
                      const diffB = b.stats.gamesWon - b.stats.gamesLost;
                      return diffB - diffA;
                    });

                    // Add best thirds to qualified teams map
                    for (let i = 0; i < Math.min(remainingSpots, thirdPlaceTeams.length); i++) {
                      qualifiedTeams.set(`Best 3rd #${i + 1}`, thirdPlaceTeams[i]);
                    }
                  }

                  // Map bracket structure with qualified teams
                  bracketStructure = bracketStructure.map((match, idx) => {
                    const team1 = qualifiedTeams.get(match.team1Label);
                    const team2 = qualifiedTeams.get(match.team2Label);

                    return { ...match, team1, team2 };
                  });

                  const progress = totalGroupMatches > 0 ? (completedMatches.length / totalGroupMatches) * 100 : 0;

                  return (
                    <div className="space-y-6">
                      {/* Progress Bar */}
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span className="font-medium">Group Stage Progress</span>
                          <span>{completedMatches.length} / {totalGroupMatches} matches completed</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                            style={{ width: `${progress}%` }}
                          >
                            {progress > 10 && (
                              <span className="text-xs text-white font-bold">{Math.round(progress)}%</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Final Classification */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          {t.standings.finalClassification}
                        </h4>

                        {(() => {
                          const finalMatch = knockoutMatches.find(m => m.round === 'final');
                          const thirdPlaceMatch = knockoutMatches.find(m => m.round === '3rd_place');
                          const fifthPlaceMatch = knockoutMatches.find(m => m.round === '5th_place');
                          const seventhPlaceMatch = knockoutMatches.find(m => m.round === '7th_place');
                          const ninthPlaceMatch = knockoutMatches.find(m => m.round === '9th_place');
                          const eleventhPlaceMatch = knockoutMatches.find(m => m.round === '11th_place');
                          const thirteenthSemifinal = knockoutMatches.filter(m => m.round === '13th_semifinal');
                          const semiFinals = knockoutMatches.filter(m => m.round === 'semi_final');
                          const quarterFinals = knockoutMatches.filter(m => m.round === 'quarter_final');
                          const roundOf16 = knockoutMatches.filter(m => m.round === 'round_of_16');

                          const classification: Array<{ position: number; team: any; status: string; eliminatedIn?: string }> = [];
                          const classifiedTeamIds = new Set<string>();

                          const getMatchWinner = (match: any) => {
                            if (!match || match.status !== 'completed') return null;
                            const t1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
                            const t2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
                            if (t1Games > t2Games) return match.team1_id;
                            if (t2Games > t1Games) return match.team2_id;
                            return null;
                          };

                          const addFromPlacementMatch = (match: any, winnerPos: number, loserPos: number) => {
                            const winnerId = getMatchWinner(match);
                            if (match?.status === 'completed' && winnerId) {
                              const winner = categoryTeams.find(t => t.id === winnerId);
                              const loser = categoryTeams.find(t => t.id === (match.team1_id === winnerId ? match.team2_id : match.team1_id));
                              if (winner && !classifiedTeamIds.has(winner.id)) {
                                classification.push({ position: winnerPos, team: winner, status: 'completed' });
                                classifiedTeamIds.add(winner.id);
                              }
                              if (loser && !classifiedTeamIds.has(loser.id)) {
                                classification.push({ position: loserPos, team: loser, status: 'completed' });
                                classifiedTeamIds.add(loser.id);
                              }
                            } else if (match && match.team1_id && match.team2_id) {
                              const team1 = categoryTeams.find(t => t.id === match.team1_id);
                              const team2 = categoryTeams.find(t => t.id === match.team2_id);
                              if (team1 && !classifiedTeamIds.has(team1.id)) {
                                classification.push({ position: winnerPos, team: team1, status: 'pending' });
                                classifiedTeamIds.add(team1.id);
                              }
                              if (team2 && !classifiedTeamIds.has(team2.id)) {
                                classification.push({ position: loserPos, team: team2, status: 'pending' });
                                classifiedTeamIds.add(team2.id);
                              }
                            }
                          };

                          addFromPlacementMatch(finalMatch, 1, 2);
                          addFromPlacementMatch(thirdPlaceMatch, 3, 4);
                          addFromPlacementMatch(fifthPlaceMatch, 5, 6);
                          addFromPlacementMatch(seventhPlaceMatch, 7, 8);
                          addFromPlacementMatch(ninthPlaceMatch, 9, 10);
                          addFromPlacementMatch(eleventhPlaceMatch, 11, 12);

                          thirteenthSemifinal.forEach(match => {
                            const winnerId = getMatchWinner(match);
                            if (match?.status === 'completed' && winnerId) {
                              const winner = categoryTeams.find(t => t.id === winnerId);
                              const loser = categoryTeams.find(t => t.id === (match.team1_id === winnerId ? match.team2_id : match.team1_id));
                              if (winner && !classifiedTeamIds.has(winner.id)) {
                                classification.push({ position: 13, team: winner, status: 'completed' });
                                classifiedTeamIds.add(winner.id);
                              }
                              if (loser && !classifiedTeamIds.has(loser.id)) {
                                classification.push({ position: 14, team: loser, status: 'completed' });
                                classifiedTeamIds.add(loser.id);
                              }
                            } else if (match && match.team1_id && match.team2_id) {
                              const team1 = categoryTeams.find(t => t.id === match.team1_id);
                              const team2 = categoryTeams.find(t => t.id === match.team2_id);
                              if (team1 && !classifiedTeamIds.has(team1.id)) {
                                classification.push({ position: 13, team: team1, status: 'pending' });
                                classifiedTeamIds.add(team1.id);
                              }
                              if (team2 && !classifiedTeamIds.has(team2.id)) {
                                classification.push({ position: 14, team: team2, status: 'pending' });
                                classifiedTeamIds.add(team2.id);
                              }
                            }
                          });

                          const getTeamGroupStats = (teamId: string) => {
                            for (const [groupName, standings] of groupStandings.entries()) {
                              const idx = standings.findIndex((t: any) => t.id === teamId);
                              if (idx !== -1) {
                                const team = standings[idx];
                                return {
                                  groupPosition: idx + 1,
                                  groupName,
                                  wins: team.wins || 0,
                                  points: team.points || 0,
                                  setDiff: team.setDiff || 0,
                                  gameDiff: team.gameDiff || 0
                                };
                              }
                            }
                            return { groupPosition: 99, groupName: '', wins: 0, points: 0, setDiff: 0, gameDiff: 0 };
                          };

                          const sortByGroupPerformance = (teams: any[]) => {
                            return teams.sort((a, b) => {
                              const statsA = getTeamGroupStats(a.id);
                              const statsB = getTeamGroupStats(b.id);
                              if (statsA.groupPosition !== statsB.groupPosition) return statsA.groupPosition - statsB.groupPosition;
                              if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
                              if (statsA.points !== statsB.points) return statsB.points - statsA.points;
                              if (statsA.setDiff !== statsB.setDiff) return statsB.setDiff - statsA.setDiff;
                              return statsB.gameDiff - statsA.gameDiff;
                            });
                          };

                          if (!thirdPlaceMatch) {
                            const semiLosers: any[] = [];
                            semiFinals.forEach(match => {
                              const winnerId = getMatchWinner(match);
                              if (match.status === 'completed' && winnerId) {
                                const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
                                const loser = categoryTeams.find(t => t.id === loserId);
                                if (loser && !classifiedTeamIds.has(loser.id)) {
                                  semiLosers.push(loser);
                                  classifiedTeamIds.add(loser.id);
                                }
                              }
                            });
                            const sortedSemiLosers = sortByGroupPerformance(semiLosers);
                            let pos = 3;
                            sortedSemiLosers.forEach(team => {
                              classification.push({ position: pos++, team, status: 'completed', eliminatedIn: 'SF' });
                            });
                          }

                          if (!fifthPlaceMatch) {
                            const quarterLosers: any[] = [];
                            quarterFinals.forEach(match => {
                              const winnerId = getMatchWinner(match);
                              if (match.status === 'completed' && winnerId) {
                                const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
                                const loser = categoryTeams.find(t => t.id === loserId);
                                if (loser && !classifiedTeamIds.has(loser.id)) {
                                  quarterLosers.push(loser);
                                  classifiedTeamIds.add(loser.id);
                                }
                              }
                            });
                            const sortedQuarterLosers = sortByGroupPerformance(quarterLosers);
                            let pos = classification.length > 0 ? Math.max(...classification.map(c => c.position)) + 1 : 5;
                            sortedQuarterLosers.forEach(team => {
                              classification.push({ position: pos++, team, status: 'completed', eliminatedIn: 'QF' });
                            });
                          }

                          const r16Losers: any[] = [];
                          roundOf16.forEach(match => {
                            const winnerId = getMatchWinner(match);
                            if (match.status === 'completed' && winnerId) {
                              const loserId = match.team1_id === winnerId ? match.team2_id : match.team1_id;
                              const loser = categoryTeams.find(t => t.id === loserId);
                              if (loser && !classifiedTeamIds.has(loser.id)) {
                                r16Losers.push(loser);
                                classifiedTeamIds.add(loser.id);
                              }
                            }
                          });
                          const sortedR16Losers = sortByGroupPerformance(r16Losers);
                          let pos = classification.length > 0 ? Math.max(...classification.map(c => c.position)) + 1 : 9;
                          sortedR16Losers.forEach(team => {
                            classification.push({ position: pos++, team, status: 'completed', eliminatedIn: 'R16' });
                          });

                          const nonQualifiedTeams = categoryTeams.filter(t => !classifiedTeamIds.has(t.id));
                          const sortedNonQualified = sortByGroupPerformance(nonQualifiedTeams);
                          pos = classification.length > 0 ? Math.max(...classification.map(c => c.position)) + 1 : 1;
                          sortedNonQualified.forEach(team => {
                            classification.push({ position: pos++, team, status: 'completed', eliminatedIn: 'Groups' });
                          });

                          classification.sort((a, b) => a.position - b.position);

                          if (classification.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p>{t.standings.classificationPending}</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              {classification.map(({ position, team, status, eliminatedIn }) => (
                                <div
                                  key={team.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                                    position === 1 ? 'bg-yellow-50 border-yellow-400' :
                                    position === 2 ? 'bg-gray-100 border-gray-300' :
                                    position === 3 ? 'bg-orange-50 border-orange-300' :
                                    position === 4 ? 'bg-amber-50 border-amber-200' :
                                    'bg-white border-gray-200'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    position === 1 ? 'bg-yellow-400 text-yellow-900' :
                                    position === 2 ? 'bg-gray-400 text-white' :
                                    position === 3 ? 'bg-orange-400 text-white' :
                                    position === 4 ? 'bg-amber-300 text-amber-900' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {position}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{team.name}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {team.player1?.name} & {team.player2?.name}
                                    </p>
                                  </div>
                                  {status === 'pending' ? (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
                                      {t.match.pending}
                                    </span>
                                  ) : eliminatedIn && position > 4 && (
                                    <span className="text-xs text-gray-400 shrink-0">
                                      {eliminatedIn}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {knockoutMatches.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.bracket.knockoutStageBracket}</h4>
                          <BracketView
                            matches={knockoutMatches}
                            isIndividual={false}
                            onMatchClick={(matchId) => {
                              setSelectedMatchId(matchId);
                              setShowMatchModal(true);
                            }}
                          />
                        </div>
                      )}

                      {/* Group Standings */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.standings.groupStageStandings}</h4>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {sortedGroups.map(groupName => {
                            const standings = groupStandings.get(groupName)!;
                            return (
                              <div key={groupName} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h5 className="font-semibold text-gray-900 mb-3">Group {groupName}</h5>
                                <div className="space-y-2">
                                  {standings.map((team, idx) => {
                                    const rank = idx + 1;
                                    const isQualified = rank <= guaranteedPerGroup;
                                    const isMaybeQualified = (rank === 2 && needBestSeconds) || (rank === 3 && needBestThirds);

                                    return (
                                      <div
                                        key={team.id}
                                        className={`flex items-center justify-between p-2 rounded ${
                                          isQualified
                                            ? 'bg-green-100 border border-green-300'
                                            : isMaybeQualified
                                            ? 'bg-yellow-100 border border-yellow-300'
                                            : 'bg-white border border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-700 w-5">
                                            {rank}
                                          </span>
                                          <div>
                                            <p className="text-sm font-medium text-gray-900">
                                              {team.name}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              {team.stats.wins}W • {team.stats.gamesWon}-{team.stats.gamesLost} games
                                            </p>
                                          </div>
                                        </div>
                                        {isQualified && (
                                          <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded">
                                            ✓ Q
                                          </span>
                                        )}
                                        {isMaybeQualified && (
                                          <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-1 rounded">
                                            ? 3rd
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* Individual Groups + Knockout */}
          {categories.filter(c => c.format === 'individual_groups_knockout').filter(c => selectedCategory === null || c.id === selectedCategory).map(category => {
            const categoryMatches = matches
              .filter(m => m.category_id === category.id)
              .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
            const categoryPlayers = individualPlayers.filter(p => p.category_id === category.id);
            const groupMatches = categoryMatches.filter(m => m.round.startsWith('group_'));
            const knockoutMatches = categoryMatches.filter(m => !m.round.startsWith('group_'));

            return (
              <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{category.name}</h3>
                    <p className="text-sm text-gray-600">
                      {categoryPlayers.length} {t.player.players} • {t.tournament.formatIndividualGroupsKnockout}
                    </p>
                  </div>
                </div>

                {(() => {
                  const playersByGroup = new Map<string, typeof categoryPlayers>();
                  categoryPlayers.forEach(player => {
                    if (player.group_name) {
                      if (!playersByGroup.has(player.group_name)) {
                        playersByGroup.set(player.group_name, []);
                      }
                      playersByGroup.get(player.group_name)!.push(player);
                    }
                  });

                  const sortedGroups = Array.from(playersByGroup.keys()).sort();
                  const completedMatches = groupMatches.filter(m => m.status === 'completed');
                  const totalGroupMatches = groupMatches.length;
                  const allGroupsComplete = completedMatches.length === totalGroupMatches && totalGroupMatches > 0;

                  const groupStandings = new Map<string, any[]>();
                  sortedGroups.forEach(groupName => {
                    const groupPlayerList = playersByGroup.get(groupName)!;
                    const groupMatchList = groupMatches.filter(m =>
                      groupPlayerList.some(p =>
                        p.id === m.player1_individual_id ||
                        p.id === m.player2_individual_id ||
                        p.id === m.player3_individual_id ||
                        p.id === m.player4_individual_id
                      )
                    );

                    const playerStats = new Map<string, { matches: number; wins: number; gamesWon: number; gamesLost: number }>();
                    groupPlayerList.forEach(player => {
                      playerStats.set(player.id, { matches: 0, wins: 0, gamesWon: 0, gamesLost: 0 });
                    });

                    groupMatchList.forEach(match => {
                      if (match.status === 'completed') {
                        const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
                        const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
                        const team1Won = team1Games > team2Games;

                        const team1Players = [match.player1_individual_id, match.player2_individual_id].filter(Boolean);
                        const team2Players = [match.player3_individual_id, match.player4_individual_id].filter(Boolean);

                        team1Players.forEach(playerId => {
                          const stats = playerStats.get(playerId);
                          if (stats) {
                            stats.matches++;
                            stats.gamesWon += team1Games;
                            stats.gamesLost += team2Games;
                            if (team1Won) stats.wins++;
                          }
                        });

                        team2Players.forEach(playerId => {
                          const stats = playerStats.get(playerId);
                          if (stats) {
                            stats.matches++;
                            stats.gamesWon += team2Games;
                            stats.gamesLost += team1Games;
                            if (!team1Won) stats.wins++;
                          }
                        });
                      }
                    });

                    const sortedPlayers = groupPlayerList
                      .map(player => ({
                        ...player,
                        stats: playerStats.get(player.id)!
                      }))
                      .sort((a, b) => {
                        if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
                        const diffA = a.stats.gamesWon - a.stats.gamesLost;
                        const diffB = b.stats.gamesWon - b.stats.gamesLost;
                        return diffB - diffA;
                      });

                    groupStandings.set(groupName, sortedPlayers);
                  });

                  const numGroups = sortedGroups.length;
                  const knockoutStage = (category as any).knockout_stage || 'semifinals';
                  const qualConfig = calculateQualificationConfig(numGroups, knockoutStage, true);
                  const { qualifiedPerGroup, extraBestNeeded, extraFromPosition } = qualConfig;
                  const progress = totalGroupMatches > 0 ? (completedMatches.length / totalGroupMatches) * 100 : 0;

                  const runnersUpCandidates: { playerId: string; groupName: string; stats: { wins: number; gamesWon: number; gamesLost: number } }[] = [];
                  if (extraBestNeeded > 0 && extraFromPosition > 0) {
                    sortedGroups.forEach(groupName => {
                      const standings = groupStandings.get(groupName)!;
                      const candidate = standings[extraFromPosition - 1];
                      if (candidate) {
                        runnersUpCandidates.push({
                          playerId: candidate.id,
                          groupName,
                          stats: candidate.stats
                        });
                      }
                    });

                    runnersUpCandidates.sort((a, b) => {
                      if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
                      const diffA = a.stats.gamesWon - a.stats.gamesLost;
                      const diffB = b.stats.gamesWon - b.stats.gamesLost;
                      return diffB - diffA;
                    });
                  }

                  const bestRunnersUpIds = new Set(runnersUpCandidates.slice(0, extraBestNeeded).map(c => c.playerId));
                  const runnersUpCandidateIds = new Set(runnersUpCandidates.map(c => c.playerId));
                  const playersWithPosition = categoryPlayers.filter(p => p.final_position);
                  const sortedByPosition = [...playersWithPosition].sort((a, b) => (a.final_position || 99) - (b.final_position || 99));

                  return (
                    <div className="space-y-6">
                      {/* Progress Bar */}
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span className="font-medium">Group Stage Progress</span>
                          <span>{completedMatches.length} / {totalGroupMatches} matches completed</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                            style={{ width: `${progress}%` }}
                          >
                            {progress > 10 && (
                              <span className="text-xs text-white font-bold">{Math.round(progress)}%</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Final Classification */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          {t.standings.finalClassification}
                        </h4>

                        {(() => {
                          const playerStatsMap = new Map<string, {
                            playerId: string;
                            playerName: string;
                            group: string;
                            groupPosition: number;
                            wins: number;
                            losses: number;
                            gameDiff: number;
                          }>();

                          sortedGroups.forEach(groupName => {
                            const standings = groupStandings.get(groupName);
                            if (standings) {
                              standings.forEach((standing: any, idx: number) => {
                                const wins = standing.stats?.wins || 0;
                                const matches = standing.stats?.matches || 0;
                                const gamesWon = standing.stats?.gamesWon || 0;
                                const gamesLost = standing.stats?.gamesLost || 0;
                                playerStatsMap.set(standing.id, {
                                  playerId: standing.id,
                                  playerName: standing.name,
                                  group: groupName,
                                  groupPosition: idx + 1,
                                  wins: wins,
                                  losses: matches - wins,
                                  gameDiff: gamesWon - gamesLost
                                });
                              });
                            }
                          });

                          const sortByGroupStats = (ids: string[]) => {
                            return ids
                              .map(id => playerStatsMap.get(id))
                              .filter(Boolean)
                              .sort((a, b) => {
                                if (b!.wins !== a!.wins) return b!.wins - a!.wins;
                                return b!.gameDiff - a!.gameDiff;
                              }) as typeof playerStatsMap extends Map<string, infer T> ? T[] : never;
                          };

                          const finalMatch = knockoutMatches.find(m => m.round === 'final');
                          const classification: Array<{
                            position: number;
                            playerId: string;
                            playerName: string;
                            wins: number;
                            losses: number;
                            group: string;
                          }> = [];

                          if (finalMatch?.status === 'completed') {
                            const t1Games = (finalMatch.team1_score_set1 || 0) + (finalMatch.team1_score_set2 || 0) + (finalMatch.team1_score_set3 || 0);
                            const t2Games = (finalMatch.team2_score_set1 || 0) + (finalMatch.team2_score_set2 || 0) + (finalMatch.team2_score_set3 || 0);

                            const team1Ids = [finalMatch.player1_individual_id, finalMatch.player2_individual_id].filter(Boolean) as string[];
                            const team2Ids = [finalMatch.player3_individual_id, finalMatch.player4_individual_id].filter(Boolean) as string[];

                            const winnerIds = t1Games > t2Games ? team1Ids : team2Ids;
                            const loserIds = t1Games > t2Games ? team2Ids : team1Ids;

                            const sortedWinners = sortByGroupStats(winnerIds);
                            sortedWinners.forEach((p, idx) => {
                              classification.push({
                                position: idx + 1,
                                playerId: p.playerId,
                                playerName: p.playerName,
                                wins: p.wins,
                                losses: p.losses,
                                group: p.group
                              });
                            });

                            const sortedLosers = sortByGroupStats(loserIds);
                            sortedLosers.forEach((p, idx) => {
                              classification.push({
                                position: sortedWinners.length + idx + 1,
                                playerId: p.playerId,
                                playerName: p.playerName,
                                wins: p.wins,
                                losses: p.losses,
                                group: p.group
                              });
                            });

                            const finalistIds = new Set([...winnerIds, ...loserIds]);
                            const remainingPlayers = Array.from(playerStatsMap.values())
                              .filter(p => !finalistIds.has(p.playerId))
                              .sort((a, b) => {
                                if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition;
                                if (b.wins !== a.wins) return b.wins - a.wins;
                                return b.gameDiff - a.gameDiff;
                              });

                            let nextPos = classification.length + 1;
                            remainingPlayers.forEach(p => {
                              classification.push({
                                position: nextPos++,
                                playerId: p.playerId,
                                playerName: p.playerName,
                                wins: p.wins,
                                losses: p.losses,
                                group: p.group
                              });
                            });
                          } else {
                            const allPlayers = Array.from(playerStatsMap.values())
                              .sort((a, b) => {
                                if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition;
                                if (b.wins !== a.wins) return b.wins - a.wins;
                                return b.gameDiff - a.gameDiff;
                              });

                            allPlayers.forEach((p, idx) => {
                              classification.push({
                                position: idx + 1,
                                playerId: p.playerId,
                                playerName: p.playerName,
                                wins: p.wins,
                                losses: p.losses,
                                group: p.group
                              });
                            });
                          }

                          if (classification.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p>{t.standings.classificationPending}</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              {classification.map(({ position, playerId, playerName, wins, losses, group }) => (
                                <div
                                  key={playerId}
                                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                                    position === 1 ? 'bg-yellow-50 border-yellow-400' :
                                    position === 2 ? 'bg-gray-100 border-gray-300' :
                                    position === 3 ? 'bg-orange-50 border-orange-300' :
                                    'bg-white border-gray-200'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    position === 1 ? 'bg-yellow-400 text-yellow-900' :
                                    position === 2 ? 'bg-gray-400 text-white' :
                                    position === 3 ? 'bg-orange-400 text-white' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {position}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{playerName}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-sm font-semibold text-green-600">{wins}V</span>
                                    <span className="text-gray-400 mx-1">-</span>
                                    <span className="text-sm text-gray-500">{losses}D</span>
                                  </div>
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {group}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Knockout Stage Bracket */}
                      {knockoutMatches.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.bracket.knockoutStageBracket}</h4>
                          <BracketView
                            matches={knockoutMatches}
                            isIndividual={true}
                            individualPlayers={categoryPlayers}
                            onMatchClick={(matchId) => {
                              setSelectedMatchId(matchId);
                              setShowMatchModal(true);
                            }}
                          />
                          {allGroupsComplete && (() => {
                            const firstKnockoutMatch = knockoutStage === 'final'
                              ? knockoutMatches.find(m => m.round === 'final')
                              : knockoutMatches.find(m => m.round === 'semifinal');
                            const needsGeneration = !firstKnockoutMatch?.player1_individual_id;
                            if (!needsGeneration) return null;
                            return (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-green-800">
                                    <span className="font-semibold">Group stage complete!</span> {knockoutStage === 'final' ? 'Generate final with A1+B2 vs B1+A2.' : 'Generate semifinals with random teams from qualified players.'}
                                  </p>
                                  <button
                                    onClick={() => handleGenerateIndividualKnockout(category.id)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                                  >
                                    {knockoutStage === 'final' ? 'Generate Final' : 'Generate Semifinals'}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Group Standings */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.standings.groupStageStandings}</h4>
                        {extraBestNeeded > 0 && (
                          <p className="text-sm text-gray-600 mb-3">
                            Top {qualifiedPerGroup} per group qualify directly + {extraBestNeeded} best {extraFromPosition === 2 ? '2nd' : extraFromPosition === 3 ? '3rd' : `${extraFromPosition}th`} place(s)
                          </p>
                        )}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {sortedGroups.map(groupName => {
                            const standings = groupStandings.get(groupName)!;
                            return (
                              <div key={groupName} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h5 className="font-semibold text-gray-900 mb-3">{t.standings.groupStandings} {groupName}</h5>
                                <div className="space-y-2">
                                  {standings.map((player, idx) => {
                                    const rank = idx + 1;
                                    const isDirectQualified = rank <= qualifiedPerGroup;
                                    const isBestRunnerUp = bestRunnersUpIds.has(player.id);
                                    const isRunnerUpCandidate = runnersUpCandidateIds.has(player.id) && !isBestRunnerUp;

                                    return (
                                      <div
                                        key={player.id}
                                        className={`flex items-center justify-between p-2 rounded ${
                                          isDirectQualified
                                            ? 'bg-green-100 border border-green-300'
                                            : isBestRunnerUp
                                            ? 'bg-blue-100 border border-blue-300'
                                            : isRunnerUpCandidate
                                            ? 'bg-yellow-50 border border-yellow-300'
                                            : 'bg-white border border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-700 w-5">
                                            {rank}
                                          </span>
                                          <div>
                                            <p className="text-sm font-medium text-gray-900">
                                              {player.name}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              {player.stats.wins}V • {player.stats.matches}J • {player.stats.gamesWon}-{player.stats.gamesLost}
                                            </p>
                                          </div>
                                        </div>
                                        {isDirectQualified && (
                                          <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded">
                                            Q
                                          </span>
                                        )}
                                        {isBestRunnerUp && (
                                          <span className="text-xs font-medium text-blue-700 bg-blue-200 px-2 py-1 rounded">
                                            Q*
                                          </span>
                                        )}
                                        {isRunnerUpCandidate && (
                                          <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-1 rounded">
                                            ?
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Delete Tournament</h2>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{currentTournament.name}</span>?
              This will permanently delete all teams, players, and matches associated with this tournament.
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteTournament();
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditTournament && (
        <EditTournamentModal
          tournament={currentTournament}
          onClose={() => setShowEditTournament(false)}
          onSuccess={async () => {
            const { data } = await supabase
              .from('tournaments')
              .select('*')
              .eq('id', currentTournament.id)
              .single();
            if (data) {
              setCurrentTournament(data);
            }
            await fetchTournamentData();
            setShowEditTournament(false);
          }}
        />
      )}

      {showAddTeam && (
        <AddTeamModal
          tournamentId={tournament.id}
          onClose={() => setShowAddTeam(false)}
          onSuccess={() => {
            setShowAddTeam(false);
            fetchTournamentData();
          }}
        />
      )}

      {showAddPlayer && (
        <AddIndividualPlayerModal
          tournamentId={tournament.id}
          categoryId={selectedCategory}
          onClose={() => setShowAddPlayer(false)}
          onSuccess={() => {
            setShowAddPlayer(false);
            fetchTournamentData();
          }}
        />
      )}

      {showMatchModal && (
        <MatchModal
          tournamentId={tournament.id}
          matchId={selectedMatchId}
          isIndividualRoundRobin={isIndividualRoundRobin || isIndividualGroupsKnockout}
          individualPlayers={individualPlayers}
          onClose={() => {
            setShowMatchModal(false);
            setSelectedMatchId(undefined);
          }}
          onSuccess={() => {
            setShowMatchModal(false);
            setSelectedMatchId(undefined);
            fetchTournamentData();
          }}
        />
      )}

      {showManageCategories && (
        <ManageCategoriesModal
          tournamentId={tournament.id}
          onClose={() => setShowManageCategories(false)}
          onCategoriesUpdated={() => fetchTournamentData()}
        />
      )}

      {showManualGroupAssignment && (
        <ManualGroupAssignmentModal
          isOpen={showManualGroupAssignment}
          onClose={() => setShowManualGroupAssignment(false)}
          tournamentId={tournament.id}
          isIndividual={currentTournament.format === 'individual_groups_knockout'}
          players={individualPlayers}
          teams={teams}
          categories={categories}
          numberOfGroups={(currentTournament as any).number_of_groups || 2}
          onSave={() => fetchTournamentData()}
        />
      )}

      {showEditTeam && selectedTeam && (
        <EditTeamModal
          team={selectedTeam}
          tournamentId={tournament.id}
          onClose={() => {
            setShowEditTeam(false);
            setSelectedTeam(undefined);
          }}
          onSuccess={() => {
            console.log('[TOURNAMENT-DETAIL] EditTeam onSuccess called, reloading data');
            setShowEditTeam(false);
            setSelectedTeam(undefined);
            fetchTournamentData();
          }}
        />
      )}

      {showEditPlayer && selectedPlayer && (
        <EditIndividualPlayerModal
          player={selectedPlayer}
          tournamentId={tournament.id}
          onClose={() => {
            setShowEditPlayer(false);
            setSelectedPlayer(undefined);
          }}
          onSuccess={() => {
            setShowEditPlayer(false);
            setSelectedPlayer(undefined);
            fetchTournamentData();
          }}
        />
      )}
    </div>
  );
}
