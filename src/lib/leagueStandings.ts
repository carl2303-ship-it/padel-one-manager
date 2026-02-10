import { supabase } from './supabase';

export async function clearIndividualFinalPositions(tournamentId: string, categoryId?: string | null) {
  console.log('[CLEAR_POSITIONS] Clearing final positions for tournament:', tournamentId, 'category:', categoryId);

  let query = supabase
    .from('players')
    .update({ final_position: null })
    .eq('tournament_id', tournamentId);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { error } = await query;

  if (error) {
    console.error('[CLEAR_POSITIONS] Error clearing positions:', error);
    return false;
  }

  console.log('[CLEAR_POSITIONS] Positions cleared successfully');
  return true;
}

export async function calculateIndividualFinalPositions(tournamentId: string, categoryId?: string | null) {
  console.log('[CALCULATE_POSITIONS] Starting for tournament:', tournamentId, 'category:', categoryId);

  const matchFilter: any = {
    tournament_id: tournamentId,
    status: 'completed',
  };
  if (categoryId) {
    matchFilter.category_id = categoryId;
  }

  const { data: finalMatch } = await supabase
    .from('matches')
    .select('*')
    .match(matchFilter)
    .eq('round', 'final')
    .maybeSingle();

  if (!finalMatch) {
    console.log('[CALCULATE_POSITIONS] No completed final match found');
    return false;
  }

  const getMatchWinner = (match: any): string[] => {
    const team1Score = (match?.team1_score_set1 || 0) + (match?.team1_score_set2 || 0) + (match?.team1_score_set3 || 0);
    const team2Score = (match?.team2_score_set1 || 0) + (match?.team2_score_set2 || 0) + (match?.team2_score_set3 || 0);

    if (team1Score === 0 && team2Score === 0) return [];

    if (team1Score > team2Score) {
      return [match.player1_individual_id, match.player2_individual_id].filter(Boolean);
    } else {
      return [match.player3_individual_id, match.player4_individual_id].filter(Boolean);
    }
  };

  const getMatchLoser = (match: any): string[] => {
    const team1Score = (match?.team1_score_set1 || 0) + (match?.team1_score_set2 || 0) + (match?.team1_score_set3 || 0);
    const team2Score = (match?.team2_score_set1 || 0) + (match?.team2_score_set2 || 0) + (match?.team2_score_set3 || 0);

    if (team1Score === 0 && team2Score === 0) return [];

    if (team1Score < team2Score) {
      return [match.player1_individual_id, match.player2_individual_id].filter(Boolean);
    } else {
      return [match.player3_individual_id, match.player4_individual_id].filter(Boolean);
    }
  };

  const finalWinners = getMatchWinner(finalMatch);
  const finalLosers = getMatchLoser(finalMatch);

  console.log('[CALCULATE_POSITIONS] Final winners:', finalWinners);
  console.log('[CALCULATE_POSITIONS] Final losers:', finalLosers);

  for (const playerId of finalWinners) {
    await supabase
      .from('players')
      .update({ final_position: 1 })
      .eq('id', playerId);
  }

  for (const playerId of finalLosers) {
    await supabase
      .from('players')
      .update({ final_position: 2 })
      .eq('id', playerId);
  }

  const { data: thirdPlaceMatch } = await supabase
    .from('matches')
    .select('*')
    .match(matchFilter)
    .eq('round', '3rd_place')
    .maybeSingle();

  if (thirdPlaceMatch) {
    const thirdPlaceWinners = getMatchWinner(thirdPlaceMatch);
    const fourthPlaceLosers = getMatchLoser(thirdPlaceMatch);

    console.log('[CALCULATE_POSITIONS] 3rd place winners:', thirdPlaceWinners);
    console.log('[CALCULATE_POSITIONS] 4th place losers:', fourthPlaceLosers);

    for (const playerId of thirdPlaceWinners) {
      await supabase
        .from('players')
        .update({ final_position: 3 })
        .eq('id', playerId);
    }

    for (const playerId of fourthPlaceLosers) {
      await supabase
        .from('players')
        .update({ final_position: 4 })
        .eq('id', playerId);
    }
  }

  const { data: fifthPlaceMatch } = await supabase
    .from('matches')
    .select('*')
    .match(matchFilter)
    .eq('round', '5th_place')
    .maybeSingle();

  if (fifthPlaceMatch) {
    const fifthPlaceWinners = getMatchWinner(fifthPlaceMatch);
    const sixthPlaceLosers = getMatchLoser(fifthPlaceMatch);

    console.log('[CALCULATE_POSITIONS] 5th place winners:', fifthPlaceWinners);
    console.log('[CALCULATE_POSITIONS] 6th place losers:', sixthPlaceLosers);

    for (const playerId of fifthPlaceWinners) {
      await supabase
        .from('players')
        .update({ final_position: 5 })
        .eq('id', playerId);
    }

    for (const playerId of sixthPlaceLosers) {
      await supabase
        .from('players')
        .update({ final_position: 6 })
        .eq('id', playerId);
    }
  }

  const { data: seventhPlaceMatch } = await supabase
    .from('matches')
    .select('*')
    .match(matchFilter)
    .eq('round', '7th_place')
    .maybeSingle();

  if (seventhPlaceMatch) {
    const seventhPlaceWinners = getMatchWinner(seventhPlaceMatch);
    const eighthPlaceLosers = getMatchLoser(seventhPlaceMatch);

    console.log('[CALCULATE_POSITIONS] 7th place winners:', seventhPlaceWinners);
    console.log('[CALCULATE_POSITIONS] 8th place losers:', eighthPlaceLosers);

    for (const playerId of seventhPlaceWinners) {
      await supabase
        .from('players')
        .update({ final_position: 7 })
        .eq('id', playerId);
    }

    for (const playerId of eighthPlaceLosers) {
      await supabase
        .from('players')
        .update({ final_position: 8 })
        .eq('id', playerId);
    }
  }

  console.log('[CALCULATE_POSITIONS] Completed successfully');
  return true;
}

async function updatePlayerStanding(
  leagueId: string,
  playerId: string | null,
  playerName: string | null,
  points: number,
  position: number
) {
  if (!playerName) return;

  // ALWAYS look up by name first to avoid duplicates
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id')
    .ilike('name', playerName.trim())
    .maybeSingle();

  let finalPlayerId: string;

  if (existingPlayer) {
    finalPlayerId = existingPlayer.id;
  } else if (playerId) {
    // Use the provided ID if no player found by name
    finalPlayerId = playerId;
  } else {
    // Create new player if none exists
    const { data: newPlayer } = await supabase
      .from('players')
      .insert({ name: playerName.trim() })
      .select('id')
      .single();

    if (!newPlayer) return;
    finalPlayerId = newPlayer.id;
  }

  // Look up existing standing by player name to consolidate duplicates
  const { data: existingStandings } = await supabase
    .from('league_standings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('entity_type', 'player')
    .ilike('entity_name', playerName.trim());

  if (existingStandings && existingStandings.length > 0) {
    // Use the first standing and consolidate
    const primaryStanding = existingStandings[0];

    // Calculate cumulative stats from all standings with this name
    let totalPoints = points;
    let totalTournaments = 1;
    let bestPos = position;

    existingStandings.forEach(standing => {
      totalPoints += standing.total_points;
      totalTournaments += standing.tournaments_played;
      if (standing.best_position < bestPos) {
        bestPos = standing.best_position;
      }
    });

    // Update the primary standing
    await supabase
      .from('league_standings')
      .update({
        entity_id: finalPlayerId,
        total_points: totalPoints,
        tournaments_played: totalTournaments,
        best_position: bestPos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryStanding.id);

    // Delete duplicate standings
    if (existingStandings.length > 1) {
      const idsToDelete = existingStandings.slice(1).map(s => s.id);
      await supabase
        .from('league_standings')
        .delete()
        .in('id', idsToDelete);
    }
  } else {
    // No existing standing, create new one
    await supabase
      .from('league_standings')
      .insert({
        league_id: leagueId,
        entity_type: 'player',
        entity_id: finalPlayerId,
        entity_name: playerName.trim(),
        total_points: points,
        tournaments_played: 1,
        best_position: position,
      });
  }
}

export async function updateLeagueStandings(tournamentId: string) {
  console.log('updateLeagueStandings called for tournament:', tournamentId);

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();

  console.log('Tournament data:', tournament);

  if (!tournament || tournament.status !== 'completed') {
    console.log('Skipping - no tournament or not completed');
    return;
  }

  const { data: tournamentLeagues } = await supabase
    .from('tournament_leagues')
    .select('league_id')
    .eq('tournament_id', tournamentId);

  if (!tournamentLeagues || tournamentLeagues.length === 0) {
    console.log('Skipping - no leagues associated with this tournament');
    return;
  }

  const uniqueLeagueIds = [...new Set(tournamentLeagues.map(tl => tl.league_id))];
  console.log('Associated leagues:', uniqueLeagueIds);

  for (const leagueId of uniqueLeagueIds) {
    console.log('Calling recalculate_league_standings_for_league for:', leagueId);
    const { error } = await supabase.rpc('recalculate_league_standings_for_league', {
      league_uuid: leagueId
    });

    if (error) {
      console.error('Error recalculating league standings:', error);
    } else {
      console.log('Recalculated standings for league:', leagueId);
    }
  }

  console.log('League standings updated for all associated leagues');
}

export async function recalculateLeagueStandingsForTournament(tournamentId: string) {
  console.log('Recalculating standings for tournament:', tournamentId);

  const { data: tournamentLeagues } = await supabase
    .from('tournament_leagues')
    .select('league_id')
    .eq('tournament_id', tournamentId);

  if (!tournamentLeagues || tournamentLeagues.length === 0) {
    console.log('No leagues associated');
    return;
  }

  const uniqueLeagueIds = [...new Set(tournamentLeagues.map(tl => tl.league_id))];
  console.log('Recalculating for leagues:', uniqueLeagueIds);

  for (const leagueId of uniqueLeagueIds) {
    console.log('Calling recalculate_league_standings_for_league for:', leagueId);
    const { error } = await supabase.rpc('recalculate_league_standings_for_league', {
      league_uuid: leagueId
    });

    if (error) {
      console.error('Error recalculating league standings:', error);
    } else {
      console.log('Recalculated standings for league:', leagueId);
    }
  }

  console.log('Recalculation complete');
}

async function updateLeagueStandingsIncremental(tournamentId: string) {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();

  if (!tournament || tournament.status !== 'completed') {
    return;
  }

  const { data: tournamentCategory } = await supabase
    .from('tournament_categories')
    .select('name')
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  const tournamentCategoryName = tournamentCategory?.name || null;

  const { data: tournamentLeagues } = await supabase
    .from('tournament_leagues')
    .select('league_id, league_category')
    .eq('tournament_id', tournamentId);

  if (!tournamentLeagues || tournamentLeagues.length === 0) {
    return;
  }

  const leagueIds = tournamentLeagues.map(tl => tl.league_id);

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, scoring_system, categories, category_scoring_systems')
    .in('id', leagueIds);

  if (!leagues || leagues.length === 0) {
    return;
  }

  const { data: teams } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      final_position,
      player1_id,
      player2_id,
      player1:players!teams_player1_id_fkey(id, name),
      player2:players!teams_player2_id_fkey(id, name)
    `)
    .eq('tournament_id', tournamentId)
    .not('final_position', 'is', null);

  const { data: individualPlayers } = await supabase
    .from('players')
    .select('id, name, final_position')
    .eq('tournament_id', tournamentId)
    .not('final_position', 'is', null);

  for (const league of leagues) {
    const tournamentLeagueEntry = tournamentLeagues.find(tl => tl.league_id === league.id);
    const leagueCategory = tournamentLeagueEntry?.league_category || tournamentCategoryName;

    let scoringSystem: Record<string, number> = league.scoring_system;

    if (leagueCategory && league.category_scoring_systems && league.category_scoring_systems[leagueCategory]) {
      scoringSystem = league.category_scoring_systems[leagueCategory];
    }

    if (teams && teams.length > 0) {
      for (const team of teams) {
        if (team.final_position) {
          const points = scoringSystem[team.final_position.toString()] || 0;

          if (team.player1 && team.player1.name) {
            await addToPlayerStanding(league.id, team.player1.name, points, team.final_position);
          }

          if (team.player2 && team.player2.name) {
            await addToPlayerStanding(league.id, team.player2.name, points, team.final_position);
          }
        }
      }
    }

    if (individualPlayers && individualPlayers.length > 0) {
      for (const player of individualPlayers) {
        if (player.final_position && player.name) {
          const points = scoringSystem[player.final_position.toString()] || 0;
          await addToPlayerStanding(league.id, player.name, points, player.final_position);
        }
      }
    }
  }
}

async function addToPlayerStanding(
  leagueId: string,
  playerName: string,
  points: number,
  position: number
) {
  const { data: existing } = await supabase
    .from('league_standings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('entity_type', 'player')
    .ilike('entity_name', playerName.trim())
    .maybeSingle();

  if (existing) {
    await supabase
      .from('league_standings')
      .update({
        total_points: existing.total_points + points,
        tournaments_played: existing.tournaments_played + 1,
        best_position: Math.min(existing.best_position, position),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('league_standings')
      .insert({
        league_id: leagueId,
        entity_type: 'player',
        entity_name: playerName.trim(),
        total_points: points,
        tournaments_played: 1,
        best_position: position,
      });
  }
}
