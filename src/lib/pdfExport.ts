import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase, Tournament, Player, Match, TournamentCategory } from './supabase';

interface LeagueStanding {
  id: string;
  entity_name: string;
  total_points: number;
  tournaments_played: number;
  best_position: number | null;
  player_category?: string | null;
}

interface LeagueForExport {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string | null;
  categories?: string[];
  category_scoring_systems?: Record<string, Record<string, number>>;
  scoring_system: Record<string, number>;
}

export async function exportLeagueStandingsPDF(
  league: LeagueForExport,
  standings: LeagueStanding[],
  selectedCategory?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(league.name, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  let subtitle = 'Classificacao Geral';
  if (selectedCategory && selectedCategory !== 'all') {
    if (selectedCategory === 'none') {
      subtitle = 'Classificacao - Sem Categoria';
    } else {
      subtitle = `Classificacao - Categoria ${selectedCategory}`;
    }
  }
  doc.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  const startDate = new Date(league.start_date);
  const startStr = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
  let dateStr = `Inicio: ${startStr}`;
  if (league.end_date) {
    const endDate = new Date(league.end_date);
    const endStr = `${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;
    dateStr = `${startStr} - ${endStr}`;
  }
  doc.setFontSize(10);
  doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  if (standings.length === 0) {
    doc.setFontSize(12);
    doc.text('Sem classificacoes registadas', pageWidth / 2, yPos, { align: 'center' });
  } else {
    const sortedStandings = [...standings].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if ((a.best_position || 999) !== (b.best_position || 999)) {
        return (a.best_position || 999) - (b.best_position || 999);
      }
      return b.tournaments_played - a.tournaments_played;
    });

    const tableData = sortedStandings.map((standing, idx) => {
      let posLabel = `${idx + 1}`;
      if (idx === 0) posLabel = '1';
      else if (idx === 1) posLabel = '2';
      else if (idx === 2) posLabel = '3';

      return [
        posLabel,
        standing.entity_name,
        standing.total_points.toString(),
        standing.tournaments_played.toString(),
        standing.best_position ? `${standing.best_position}o` : '-'
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Jogador', 'Pontos', 'Torneios', 'Melhor Pos.']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' }
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const rowIdx = data.row.index;
          if (rowIdx < 3) {
            const colors = [[255, 215, 0], [192, 192, 192], [205, 127, 50]];
            doc.setFillColor(colors[rowIdx][0], colors[rowIdx][1], colors[rowIdx][2]);
          }
        }
      }
    });
  }

  const now = new Date();
  const timestamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em ${timestamp}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });

  const fileName = `${league.name}_classificacao.pdf`.replace(/\s+/g, '_');
  doc.save(fileName);
}

interface PlayerStats {
  id: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  final_position?: number | null;
  group_name?: string | null;
}

interface GroupedStats {
  [groupName: string]: PlayerStats[];
}

export async function exportTournamentPDF(
  tournament: Tournament,
  categoryId?: string,
  translations?: { [key: string]: string }
): Promise<void> {
  const t = (key: string) => translations?.[key] || key;

  const isIndividualTournament = tournament.format === 'individual_groups_knockout' ||
    (tournament.format === 'round_robin' && tournament.round_robin_type === 'individual');

  const { data: allCategories } = await supabase
    .from('tournament_categories')
    .select('*')
    .eq('tournament_id', tournament.id);

  const hasMultipleCategories = (allCategories?.length || 0) > 1;
  const organizeByCategory = hasMultipleCategories && !categoryId;

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_name', { ascending: true })
    .order('seed', { ascending: true });

  const { data: teams } = isIndividualTournament ? { data: null } : await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_name', { ascending: true })
    .order('seed', { ascending: true });

  const teamPlayersMap = new Map<string, string>();
  if (!isIndividualTournament && teams) {
    const playerIds = new Set<string>();
    teams.forEach(team => {
      if (team.player1_id) playerIds.add(team.player1_id);
      if (team.player2_id) playerIds.add(team.player2_id);
    });

    if (playerIds.size > 0) {
      const { data: allPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('tournament_id', tournament.id)
        .in('id', Array.from(playerIds));

      const playerNameMap = new Map<string, string>();
      if (allPlayers) {
        allPlayers.forEach(p => playerNameMap.set(p.id, p.name));
      }

      teams.forEach(team => {
        const names: string[] = [];
        if (team.player1_id && playerNameMap.has(team.player1_id)) {
          names.push(playerNameMap.get(team.player1_id)!);
        }
        if (team.player2_id && playerNameMap.has(team.player2_id)) {
          names.push(playerNameMap.get(team.player2_id)!);
        }
        if (names.length > 0) {
          teamPlayersMap.set(team.id, names.join(' / '));
        }
      });
    }
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('*, team1:team1_id(*), team2:team2_id(*)')
    .eq('tournament_id', tournament.id)
    .eq('status', 'completed')
    .order('scheduled_time', { ascending: true });

  let category: TournamentCategory | null = null;
  if (categoryId && categoryId !== 'no-category') {
    const { data } = await supabase
      .from('tournament_categories')
      .select('*')
      .eq('id', categoryId)
      .single();
    category = data;
  }

  const filteredPlayers = categoryId && categoryId !== 'no-category'
    ? players?.filter(p => p.category_id === categoryId) || []
    : players || [];

  const filteredTeams = categoryId && categoryId !== 'no-category'
    ? teams?.filter(t => t.category_id === categoryId) || []
    : teams || [];

  const filteredMatches = categoryId && categoryId !== 'no-category'
    ? matches?.filter(m => m.category_id === categoryId) || []
    : matches || [];

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = category ? `${tournament.name} - ${category.name}` : tournament.name;
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const startDate = new Date(tournament.start_date);
  const day = String(startDate.getDate()).padStart(2, '0');
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const year = startDate.getFullYear();
  const dateStr = `${day}-${month}-${year}`;
  doc.text(`Data: ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  const groupMatches = filteredMatches.filter(m => m.round?.startsWith('group_'));
  const knockoutMatches = filteredMatches.filter(m => !m.round?.startsWith('group_'));

  let entitiesBySection: Map<string, any[]>;
  let sortedSections: string[];
  let sectionLabel: string;

  if (organizeByCategory) {
    sectionLabel = 'Categoria';
    if (isIndividualTournament) {
      entitiesBySection = new Map<string, Player[]>();
      filteredPlayers.forEach(player => {
        const catId = player.category_id || 'no-category';
        const cat = allCategories?.find(c => c.id === catId);
        const catName = cat?.name || 'Sem Categoria';
        if (!entitiesBySection.has(catName)) {
          entitiesBySection.set(catName, []);
        }
        entitiesBySection.get(catName)!.push(player);
      });
    } else {
      entitiesBySection = new Map<string, any[]>();
      filteredTeams.forEach(team => {
        const catId = team.category_id || 'no-category';
        const cat = allCategories?.find(c => c.id === catId);
        const catName = cat?.name || 'Sem Categoria';
        if (!entitiesBySection.has(catName)) {
          entitiesBySection.set(catName, []);
        }
        entitiesBySection.get(catName)!.push(team);
      });
    }
    sortedSections = Array.from(entitiesBySection.keys()).sort();
  } else {
    sectionLabel = 'Grupo';
    const defaultSection = 'Geral';
    if (isIndividualTournament) {
      entitiesBySection = new Map<string, Player[]>();
      filteredPlayers.forEach(player => {
        const groupKey = player.group_name || defaultSection;
        if (!entitiesBySection.has(groupKey)) {
          entitiesBySection.set(groupKey, []);
        }
        entitiesBySection.get(groupKey)!.push(player);
      });
    } else {
      entitiesBySection = new Map<string, any[]>();
      filteredTeams.forEach(team => {
        const groupKey = team.group_name || defaultSection;
        if (!entitiesBySection.has(groupKey)) {
          entitiesBySection.set(groupKey, []);
        }
        entitiesBySection.get(groupKey)!.push(team);
      });
    }
    sortedSections = Array.from(entitiesBySection.keys()).sort();
    if (sortedSections.length === 1 && sortedSections[0] === defaultSection) {
      sectionLabel = '';
    }
  }

  for (const sectionName of sortedSections) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const sectionTitle = sectionLabel ? `${sectionLabel} ${sectionName}` : 'Resultados';
    doc.text(sectionTitle, 14, yPos);
    yPos += 8;

    const sectionEntities = entitiesBySection.get(sectionName) || [];
    let sectionMatches: any[];

    if (organizeByCategory) {
      const categoryObj = allCategories?.find(c => c.name === sectionName);
      sectionMatches = groupMatches.filter(m => m.category_id === categoryObj?.id);
    } else {
      if (isIndividualTournament) {
        sectionMatches = groupMatches.filter(m =>
          sectionEntities.some(p =>
            p.id === m.player1_individual_id ||
            p.id === m.player2_individual_id ||
            p.id === m.player3_individual_id ||
            p.id === m.player4_individual_id
          )
        );
      } else {
        sectionMatches = groupMatches.filter(m =>
          sectionEntities.some(t => t.id === m.team1_id || t.id === m.team2_id)
        );
      }
    }

    if (sectionMatches.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resultados dos Jogos:', 14, yPos);
      yPos += 5;

      const matchData: string[][] = [];
      sectionMatches.forEach(match => {
        let team1Name: string;
        let team2Name: string;

        if (isIndividualTournament) {
          const p1 = filteredPlayers.find(p => p.id === match.player1_individual_id);
          const p2 = filteredPlayers.find(p => p.id === match.player2_individual_id);
          const p3 = filteredPlayers.find(p => p.id === match.player3_individual_id);
          const p4 = filteredPlayers.find(p => p.id === match.player4_individual_id);
          team1Name = p1 && p2 ? `${p1.name} / ${p2.name}` : (p1?.name || '');
          team2Name = p3 && p4 ? `${p3.name} / ${p4.name}` : (p3?.name || '');
        } else {
          const team1 = (match as any).team1;
          const team2 = (match as any).team2;
          team1Name = team1?.name || 'TBD';
          team2Name = team2?.name || 'TBD';

          if (team1) {
            const team1Players = teamPlayersMap.get(team1.id) || '';
            if (team1Players) team1Name = `${team1Name} (${team1Players})`;
          }
          if (team2) {
            const team2Players = teamPlayersMap.get(team2.id) || '';
            if (team2Players) team2Name = `${team2Name} (${team2Players})`;
          }
        }

        const scores: string[] = [];
        if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) {
          scores.push(`${match.team1_score_set1}-${match.team2_score_set1}`);
        }
        if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
          scores.push(`${match.team1_score_set2}-${match.team2_score_set2}`);
        }
        if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
          scores.push(`${match.team1_score_set3}-${match.team2_score_set3}`);
        }

        matchData.push([team1Name, scores.join(' / '), team2Name]);
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Equipa 1', 'Resultado', 'Equipa 2']],
        body: matchData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    const entityStatsMap = new Map<string, PlayerStats>();
    sectionEntities.forEach(entity => {
      entityStatsMap.set(entity.id, {
        id: entity.id,
        name: entity.name,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        final_position: entity.final_position,
        group_name: entity.group_name,
      });
    });

    sectionMatches.forEach(match => {
      const team1Games = (match.team1_score_set1 || 0) + (match.team1_score_set2 || 0) + (match.team1_score_set3 || 0);
      const team2Games = (match.team2_score_set1 || 0) + (match.team2_score_set2 || 0) + (match.team2_score_set3 || 0);
      const isDraw = team1Games === team2Games;
      const team1Won = team1Games > team2Games;

      if (isIndividualTournament) {
        const player1Id = match.player1_individual_id;
        const player2Id = match.player2_individual_id;
        const player3Id = match.player3_individual_id;
        const player4Id = match.player4_individual_id;

        [player1Id, player2Id].forEach(playerId => {
          if (playerId && entityStatsMap.has(playerId)) {
            const stats = entityStatsMap.get(playerId)!;
            stats.matchesPlayed++;
            stats.gamesWon += team1Games;
            stats.gamesLost += team2Games;
            if (isDraw) stats.draws++;
            else if (team1Won) stats.wins++;
            else stats.losses++;
          }
        });

        [player3Id, player4Id].forEach(playerId => {
          if (playerId && entityStatsMap.has(playerId)) {
            const stats = entityStatsMap.get(playerId)!;
            stats.matchesPlayed++;
            stats.gamesWon += team2Games;
            stats.gamesLost += team1Games;
            if (isDraw) stats.draws++;
            else if (!team1Won) stats.wins++;
            else stats.losses++;
          }
        });
      } else {
        if (match.team1_id && entityStatsMap.has(match.team1_id)) {
          const stats = entityStatsMap.get(match.team1_id)!;
          stats.matchesPlayed++;
          stats.gamesWon += team1Games;
          stats.gamesLost += team2Games;
          if (isDraw) stats.draws++;
          else if (team1Won) stats.wins++;
          else stats.losses++;
        }

        if (match.team2_id && entityStatsMap.has(match.team2_id)) {
          const stats = entityStatsMap.get(match.team2_id)!;
          stats.matchesPlayed++;
          stats.gamesWon += team2Games;
          stats.gamesLost += team1Games;
          if (isDraw) stats.draws++;
          else if (!team1Won) stats.wins++;
          else stats.losses++;
        }
      }
    });

    const entityStats = Array.from(entityStatsMap.values());
    entityStats.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aDiff = a.gamesWon - a.gamesLost;
      const bDiff = b.gamesWon - b.gamesLost;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.gamesWon - a.gamesWon;
    });

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const classificationLabel = organizeByCategory
      ? 'Classificacao da Categoria:'
      : (sectionLabel ? 'Classificacao do Grupo:' : 'Classificacao:');
    doc.text(classificationLabel, 14, yPos);
    yPos += 5;

    let standingsData: string[][];
    let standingsHeaders: string[];
    let columnStyles: any;

    const hasTeamPlayers = !isIndividualTournament && teamPlayersMap.size > 0;

    if (organizeByCategory) {
      if (hasTeamPlayers) {
        standingsData = entityStats.map((stats, idx) => {
          const players = teamPlayersMap.get(stats.id) || '';
          return [
            (idx + 1).toString(),
            stats.name,
            players ? `(${players})` : '',
            stats.group_name || '-',
            stats.matchesPlayed.toString(),
            stats.wins.toString(),
            stats.draws.toString(),
            stats.losses.toString(),
            stats.gamesWon.toString(),
            stats.gamesLost.toString(),
            (stats.gamesWon - stats.gamesLost).toString()
          ];
        });
        standingsHeaders = ['#', 'Equipa', 'Jogadores', 'Grp', 'J', 'V', 'E', 'D', 'JG', 'JP', 'Dif'];
        columnStyles = {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 28 },
          2: { cellWidth: 38 },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 10, halign: 'center' },
          8: { cellWidth: 10, halign: 'center' },
          9: { cellWidth: 10, halign: 'center' },
          10: { cellWidth: 10, halign: 'center' }
        };
      } else {
        standingsData = entityStats.map((stats, idx) => [
          (idx + 1).toString(),
          stats.name,
          stats.group_name || '-',
          stats.matchesPlayed.toString(),
          stats.wins.toString(),
          stats.draws.toString(),
          stats.losses.toString(),
          stats.gamesWon.toString(),
          stats.gamesLost.toString(),
          (stats.gamesWon - stats.gamesLost).toString()
        ]);
        standingsHeaders = ['#', isIndividualTournament ? 'Jogador' : 'Equipa', 'Grp', 'J', 'V', 'E', 'D', 'JG', 'JP', 'Dif'];
        columnStyles = {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 45 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 13, halign: 'center' },
          8: { cellWidth: 13, halign: 'center' },
          9: { cellWidth: 13, halign: 'center' }
        };
      }
    } else {
      if (hasTeamPlayers) {
        standingsData = entityStats.map((stats, idx) => {
          const players = teamPlayersMap.get(stats.id) || '';
          return [
            (idx + 1).toString(),
            stats.name,
            players ? `(${players})` : '',
            stats.matchesPlayed.toString(),
            stats.wins.toString(),
            stats.draws.toString(),
            stats.losses.toString(),
            stats.gamesWon.toString(),
            stats.gamesLost.toString(),
            (stats.gamesWon - stats.gamesLost).toString()
          ];
        });
        standingsHeaders = ['#', 'Equipa', 'Jogadores', 'J', 'V', 'E', 'D', 'JG', 'JP', 'Dif'];
        columnStyles = {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 30 },
          2: { cellWidth: 42 },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 12, halign: 'center' },
          9: { cellWidth: 12, halign: 'center' }
        };
      } else {
        standingsData = entityStats.map((stats, idx) => [
          (idx + 1).toString(),
          stats.name,
          stats.matchesPlayed.toString(),
          stats.wins.toString(),
          stats.draws.toString(),
          stats.losses.toString(),
          stats.gamesWon.toString(),
          stats.gamesLost.toString(),
          (stats.gamesWon - stats.gamesLost).toString()
        ]);
        standingsHeaders = ['#', isIndividualTournament ? 'Jogador' : 'Equipa', 'J', 'V', 'E', 'D', 'JG', 'JP', 'Dif'];
        columnStyles = {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 12, halign: 'center' },
          6: { cellWidth: 15, halign: 'center' },
          7: { cellWidth: 15, halign: 'center' },
          8: { cellWidth: 15, halign: 'center' }
        };
      }
    }

    autoTable(doc, {
      startY: yPos,
      head: [standingsHeaders],
      body: standingsData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: columnStyles,
      margin: { left: 14, right: 14 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    if (organizeByCategory) {
      const categoryObj = allCategories?.find(c => c.name === sectionName);
      const categoryKnockoutMatches = knockoutMatches.filter(m => m.category_id === categoryObj?.id);

      if (categoryKnockoutMatches.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Fase Eliminatoria', 14, yPos);
        yPos += 8;

        const roundOrder = ['16th_place', '15th_place', '13th_place', '11th_place', '9th_place', '7th_place', '5th_place', '3rd_place', 'quarterfinals', 'semifinals', 'final'];
        const roundNames: { [key: string]: string } = {
          'quarterfinals': 'Quartos de Final',
          'semifinals': 'Meias Finais',
          'final': 'Final',
          '3rd_place': 'Jogo 3o/4o Lugar',
          '5th_place': 'Jogo 5o/6o Lugar',
          '7th_place': 'Jogo 7o/8o Lugar',
          '9th_place': 'Jogo 9o/10o Lugar',
          '11th_place': 'Jogo 11o/12o Lugar',
          '13th_place': 'Jogo 13o/14o Lugar',
          '15th_place': 'Jogo 15o/16o Lugar',
          '16th_place': 'Jogo 16o Lugar'
        };

        const matchesByRound = new Map<string, Match[]>();
        categoryKnockoutMatches.forEach(match => {
          const round = match.round || 'other';
          if (!matchesByRound.has(round)) {
            matchesByRound.set(round, []);
          }
          matchesByRound.get(round)!.push(match);
        });

        const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => {
          const aIdx = roundOrder.indexOf(a);
          const bIdx = roundOrder.indexOf(b);
          if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });

        for (const round of sortedRounds) {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          const roundMatches = matchesByRound.get(round) || [];
          const roundName = roundNames[round] || round;

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(roundName, 14, yPos);
          yPos += 5;

          const knockoutData: string[][] = [];
          roundMatches.forEach(match => {
            let team1Name: string;
            let team2Name: string;
            let team1Players = '';
            let team2Players = '';

            if (isIndividualTournament) {
              const p1 = sectionEntities.find(p => p.id === match.player1_individual_id);
              const p2 = sectionEntities.find(p => p.id === match.player2_individual_id);
              const p3 = sectionEntities.find(p => p.id === match.player3_individual_id);
              const p4 = sectionEntities.find(p => p.id === match.player4_individual_id);
              team1Name = p1 && p2 ? `${p1.name} / ${p2.name}` : (p1?.name || '');
              team2Name = p3 && p4 ? `${p3.name} / ${p4.name}` : (p3?.name || '');
            } else {
              const team1 = sectionEntities.find(t => t.id === match.team1_id);
              const team2 = sectionEntities.find(t => t.id === match.team2_id);
              team1Name = team1?.name || 'TBD';
              team2Name = team2?.name || 'TBD';
              if (team1) team1Players = teamPlayersMap.get(team1.id) || '';
              if (team2) team2Players = teamPlayersMap.get(team2.id) || '';
            }

            const scores: string[] = [];
            if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) {
              scores.push(`${match.team1_score_set1}-${match.team2_score_set1}`);
            }
            if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
              scores.push(`${match.team1_score_set2}-${match.team2_score_set2}`);
            }
            if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
              scores.push(`${match.team1_score_set3}-${match.team2_score_set3}`);
            }

            const team1Full = team1Players ? `${team1Name}\n(${team1Players})` : team1Name;
            const team2Full = team2Players ? `${team2Name}\n(${team2Players})` : team2Name;

            knockoutData.push([team1Full, scores.join(' / '), team2Full]);
          });

          autoTable(doc, {
            startY: yPos,
            head: [['Equipa 1', 'Resultado', 'Equipa 2']],
            body: knockoutData,
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
              0: { cellWidth: 60 },
              1: { cellWidth: 40, halign: 'center' },
              2: { cellWidth: 60 }
            },
            margin: { left: 14, right: 14 }
          });

          yPos = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      const categoryEntitiesWithPosition = sectionEntities.filter(e => e.final_position !== null && e.final_position !== undefined);
      if (categoryEntitiesWithPosition.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Classificacao Final', 14, yPos);
        yPos += 8;

        categoryEntitiesWithPosition.sort((a, b) => (a.final_position || 999) - (b.final_position || 999));

        const finalData = categoryEntitiesWithPosition.map(entity => {
          let posLabel = `${entity.final_position}o`;
          if (entity.final_position === 1) posLabel = '1o (Campeao)';
          else if (entity.final_position === 2) posLabel = '2o (Vice-Campeao)';
          else if (entity.final_position === 3) posLabel = '3o';

          const groupName = entity.group_name || '-';
          const players = !isIndividualTournament ? teamPlayersMap.get(entity.id) || '' : '';

          if (players) {
            return [posLabel, entity.name, `(${players})`, groupName];
          } else {
            return [posLabel, entity.name, groupName];
          }
        });

        const headers = !isIndividualTournament && teamPlayersMap.size > 0
          ? ['Pos', 'Equipa', 'Jogadores', 'Grupo']
          : ['Pos', isIndividualTournament ? 'Jogador' : 'Equipa', 'Grupo'];

        const colStyles = !isIndividualTournament && teamPlayersMap.size > 0
          ? {
              0: { cellWidth: 35 },
              1: { cellWidth: 40 },
              2: { cellWidth: 55 },
              3: { cellWidth: 20, halign: 'center' as const }
            }
          : {
              0: { cellWidth: 35 },
              1: { cellWidth: 90 },
              2: { cellWidth: 25, halign: 'center' as const }
            };

        autoTable(doc, {
          startY: yPos,
          head: [headers],
          body: finalData,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: colStyles,
          margin: { left: 14, right: 14 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }
    }
  }

  if (!organizeByCategory && knockoutMatches.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Fase Eliminatoria', 14, yPos);
    yPos += 8;

    const roundOrder = ['16th_place', '15th_place', '13th_place', '11th_place', '9th_place', '7th_place', '5th_place', '3rd_place', 'quarterfinals', 'semifinals', 'final'];
    const roundNames: { [key: string]: string } = {
      'quarterfinals': 'Quartos de Final',
      'semifinals': 'Meias Finais',
      'final': 'Final',
      '3rd_place': 'Jogo 3o/4o Lugar',
      '5th_place': 'Jogo 5o/6o Lugar',
      '7th_place': 'Jogo 7o/8o Lugar',
      '9th_place': 'Jogo 9o/10o Lugar',
      '11th_place': 'Jogo 11o/12o Lugar',
      '13th_place': 'Jogo 13o/14o Lugar',
      '15th_place': 'Jogo 15o/16o Lugar',
      '16th_place': 'Jogo 16o Lugar'
    };

    const matchesByRound = new Map<string, Match[]>();
    knockoutMatches.forEach(match => {
      const round = match.round || 'other';
      if (!matchesByRound.has(round)) {
        matchesByRound.set(round, []);
      }
      matchesByRound.get(round)!.push(match);
    });

    const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => {
      const aIdx = roundOrder.indexOf(a);
      const bIdx = roundOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    for (const round of sortedRounds) {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      const roundMatches = matchesByRound.get(round) || [];
      const roundName = roundNames[round] || round;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(roundName, 14, yPos);
      yPos += 5;

      const knockoutData: string[][] = [];
      roundMatches.forEach(match => {
        let team1Name: string;
        let team2Name: string;

        if (isIndividualTournament) {
          const p1 = filteredPlayers.find(p => p.id === match.player1_individual_id);
          const p2 = filteredPlayers.find(p => p.id === match.player2_individual_id);
          const p3 = filteredPlayers.find(p => p.id === match.player3_individual_id);
          const p4 = filteredPlayers.find(p => p.id === match.player4_individual_id);
          team1Name = p1 && p2 ? `${p1.name} / ${p2.name}` : (p1?.name || '');
          team2Name = p3 && p4 ? `${p3.name} / ${p4.name}` : (p3?.name || '');
        } else {
          const team1 = (match as any).team1;
          const team2 = (match as any).team2;
          team1Name = team1?.name || 'TBD';
          team2Name = team2?.name || 'TBD';
          if (team1) {
            const team1Players = teamPlayersMap.get(team1.id) || '';
            if (team1Players) team1Name = `${team1Name} (${team1Players})`;
          }
          if (team2) {
            const team2Players = teamPlayersMap.get(team2.id) || '';
            if (team2Players) team2Name = `${team2Name} (${team2Players})`;
          }
        }

        const scores: string[] = [];
        if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) {
          scores.push(`${match.team1_score_set1}-${match.team2_score_set1}`);
        }
        if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
          scores.push(`${match.team1_score_set2}-${match.team2_score_set2}`);
        }
        if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
          scores.push(`${match.team1_score_set3}-${match.team2_score_set3}`);
        }

        knockoutData.push([team1Name, scores.join(' / '), team2Name]);
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Equipa 1', 'Resultado', 'Equipa 2']],
        body: knockoutData,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 60 }
        },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  if (!organizeByCategory) {
    if (isIndividualTournament) {
      const playersWithPosition = filteredPlayers.filter(p => p.final_position !== null && p.final_position !== undefined);
      if (playersWithPosition.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Classificacao Final Individual', 14, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('(Apenas jogadores com posicao definida)', 14, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;

        playersWithPosition.sort((a, b) => (a.final_position || 999) - (b.final_position || 999));

        const finalData = playersWithPosition.map(player => {
          let posLabel = `${player.final_position}o`;
          if (player.final_position === 1) posLabel = '1o (Campeao)';
          else if (player.final_position === 2) posLabel = '2o (Vice-Campeao)';
          else if (player.final_position === 3) posLabel = '3o';

          const groupName = player.group_name || '-';

          return [
            posLabel,
            player.name,
            groupName
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Pos', 'Jogador', 'Grupo']],
          body: finalData,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 90 },
            2: { cellWidth: 25, halign: 'center' }
          },
          margin: { left: 14, right: 14 }
        });
      }
    } else {
      const teamsWithPosition = filteredTeams.filter(t => t.final_position !== null && t.final_position !== undefined);
      if (teamsWithPosition.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Classificacao Final', 14, yPos);
        yPos += 8;

        teamsWithPosition.sort((a, b) => (a.final_position || 999) - (b.final_position || 999));

        const finalData = teamsWithPosition.map(team => {
          let posLabel = `${team.final_position}o`;
          if (team.final_position === 1) posLabel = '1o (Campeao)';
          else if (team.final_position === 2) posLabel = '2o (Vice-Campeao)';
          else if (team.final_position === 3) posLabel = '3o';

          const groupName = team.group_name || '-';
          const players = teamPlayersMap.get(team.id) || '';

          if (players) {
            return [posLabel, team.name, `(${players})`, groupName];
          } else {
            return [posLabel, team.name, groupName];
          }
        });

        const hasPlayers = teamsWithPosition.some(t => teamPlayersMap.has(t.id));
        const headers = hasPlayers ? ['Pos', 'Equipa', 'Jogadores', 'Grupo'] : ['Pos', 'Equipa', 'Grupo'];
        const colStyles = hasPlayers
          ? {
              0: { cellWidth: 30 },
              1: { cellWidth: 40 },
              2: { cellWidth: 55 },
              3: { cellWidth: 25, halign: 'center' as const }
            }
          : {
              0: { cellWidth: 35 },
              1: { cellWidth: 90 },
              2: { cellWidth: 25, halign: 'center' as const }
            };

        autoTable(doc, {
          startY: yPos,
          head: [headers],
          body: finalData,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: colStyles,
          margin: { left: 14, right: 14 }
        });
      }
    }
  }

  const fileName = category
    ? `${tournament.name}_${category.name}_resumo.pdf`
    : `${tournament.name}_resumo.pdf`;

  doc.save(fileName.replace(/\s+/g, '_'));
}
