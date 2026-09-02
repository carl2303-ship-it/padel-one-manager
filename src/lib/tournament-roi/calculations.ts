import { META_MENSAL } from './defaults';
import type { MonthlyTotals, SimulatorState, TournamentInputs, TournamentResults } from './types';

export function calculateTournament(inputs: TournamentInputs): TournamentResults {
  const receitaInscricoes = inputs.numTorneios * inputs.jogadoresPorTorneio * inputs.precoInscricaoJogador;
  const receitaPatrocinios = inputs.numTorneios * inputs.patrociniosTorneio;
  const receitaTotal = receitaInscricoes + receitaPatrocinios;

  const custoAluguerCampos =
    inputs.numTorneios *
    inputs.camposPorTorneio *
    inputs.horasPorCampo *
    inputs.diasPorTorneio *
    inputs.precoAluguerCampoHora;

  const custoBebidas = inputs.numTorneios * inputs.jogadoresPorTorneio * inputs.custoBebidaJogador;
  const custoPremios = inputs.numTorneios * inputs.custoPremiosTorneio;
  const custoDJ = inputs.numTorneios * inputs.custoDJTorneio;
  const outrosGastos = inputs.numTorneios * inputs.outrosGastosTorneio;

  const custoTotal = custoAluguerCampos + custoBebidas + custoPremios + custoDJ + outrosGastos;
  const lucroLiquido = receitaTotal - custoTotal;
  const totalJogadores = inputs.numTorneios * inputs.jogadoresPorTorneio;
  const margemLucro = receitaTotal === 0 ? 0 : lucroLiquido / receitaTotal;

  return {
    receitaInscricoes,
    receitaPatrocinios,
    receitaTotal,
    custoAluguerCampos,
    custoBebidas,
    custoPremios,
    custoDJ,
    outrosGastos,
    custoTotal,
    lucroLiquido,
    totalJogadores,
    margemLucro,
  };
}

export function calculateMonthlyTotals(state: SimulatorState): MonthlyTotals {
  const semana = calculateTournament(state.semana);
  const fimDeSemana = calculateTournament(state.fimDeSemana);

  const receitaMensalTotal = semana.receitaTotal + fimDeSemana.receitaTotal;
  const custoMensalTotal = semana.custoTotal + fimDeSemana.custoTotal;
  const lucroLiquidoMensal = semana.lucroLiquido + fimDeSemana.lucroLiquido;
  const totalJogadoresGeridos = semana.totalJogadores + fimDeSemana.totalJogadores;
  const lucroMedioPorJogador = totalJogadoresGeridos === 0 ? 0 : lucroLiquidoMensal / totalJogadoresGeridos;
  const margemLucro = receitaMensalTotal === 0 ? 0 : lucroLiquidoMensal / receitaMensalTotal;

  return {
    semana,
    fimDeSemana,
    receitaMensalTotal,
    custoMensalTotal,
    lucroLiquidoMensal,
    totalJogadoresGeridos,
    lucroMedioPorJogador,
    margemLucro,
    metaAtingida: lucroLiquidoMensal >= META_MENSAL,
    desvioMeta: lucroLiquidoMensal - META_MENSAL,
  };
}

export function combinedCostBreakdown(totals: MonthlyTotals) {
  return [
    { key: 'campos', label: 'Aluguer de campos', value: totals.semana.custoAluguerCampos + totals.fimDeSemana.custoAluguerCampos },
    { key: 'bebidas', label: 'Bebidas / kits', value: totals.semana.custoBebidas + totals.fimDeSemana.custoBebidas },
    { key: 'premios', label: 'Prémios', value: totals.semana.custoPremios + totals.fimDeSemana.custoPremios },
    { key: 'dj', label: 'DJ / staff', value: totals.semana.custoDJ + totals.fimDeSemana.custoDJ },
    { key: 'outros', label: 'Gastos diversos', value: totals.semana.outrosGastos + totals.fimDeSemana.outrosGastos },
  ];
}
