import { META_MENSAL } from './defaults';
import { formatCurrency, formatInteger, formatPercent } from './format';
import type { MonthlyTotals, SimulatorState } from './types';

export function buildWhatsAppReport(state: SimulatorState, totals: MonthlyTotals): string {
  const metaLinha = totals.metaAtingida
    ? `✅ Meta ${formatCurrency(META_MENSAL)} superada (${formatCurrency(totals.desvioMeta)} acima)`
    : `❌ Meta ${formatCurrency(META_MENSAL)} não atingida (faltam ${formatCurrency(Math.abs(totals.desvioMeta))})`;

  return [
    '🏆 *Padel Event ROI — Relatório Mensal*',
    '',
    `💰 *Lucro líquido:* ${formatCurrency(totals.lucroLiquidoMensal)}`,
    `📈 Receita bruta: ${formatCurrency(totals.receitaMensalTotal)}`,
    `💸 Custos operacionais: ${formatCurrency(totals.custoMensalTotal)}`,
    `📊 Margem: ${formatPercent(totals.margemLucro)}`,
    `👥 Jogadores geridos: ${formatInteger(totals.totalJogadoresGeridos)}`,
    `🎯 Lucro / jogador: ${formatCurrency(totals.lucroMedioPorJogador)}`,
    metaLinha,
    '',
    `☀️ *Semana* — ${formatInteger(state.semana.numTorneios)} torneios sociais`,
    `• Lucro: ${formatCurrency(totals.semana.lucroLiquido)}`,
    `• Receita: ${formatCurrency(totals.semana.receitaTotal)}`,
    `• Custo: ${formatCurrency(totals.semana.custoTotal)}`,
    '',
    `🌙 *Fim de semana* — ${formatInteger(state.fimDeSemana.numTorneios)} mega torneios`,
    `• Lucro: ${formatCurrency(totals.fimDeSemana.lucroLiquido)}`,
    `• Receita: ${formatCurrency(totals.fimDeSemana.receitaTotal)}`,
    `• Custo: ${formatCurrency(totals.fimDeSemana.custoTotal)}`,
  ].join('\n');
}
