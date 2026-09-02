import { useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  FileDown,
  Minus,
  Moon,
  Percent,
  Plus,
  RotateCcw,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useTournamentRoiState } from '../../hooks/useTournamentRoiState';
import {
  calculateMonthlyTotals,
  combinedCostBreakdown,
} from '../../lib/tournament-roi/calculations';
import {
  FIM_DE_SEMANA_FIELDS,
  META_MENSAL,
  SEMANA_FIELDS,
} from '../../lib/tournament-roi/defaults';
import {
  clamp,
  formatCurrency,
  formatInteger,
  formatPercent,
  parseLocaleNumber,
  roundTo,
  signedCurrency,
} from '../../lib/tournament-roi/format';
import { buildWhatsAppReport } from '../../lib/tournament-roi/report';
import type {
  FieldConfig,
  MonthlyTotals,
  SimulatorState,
  TournamentInputs,
  TournamentResults,
} from '../../lib/tournament-roi/types';

const COST_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#f472b6', '#94a3b8'];
const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#eee',
};

type TabId = 'semana' | 'fimDeSemana';

export default function HQTournamentROI() {
  const { state, updateModality, reset } = useTournamentRoiState();
  const totals = useMemo(() => calculateMonthlyTotals(state), [state]);
  const [mobileTab, setMobileTab] = useState<TabId>('semana');
  const [copied, setCopied] = useState(false);

  async function copyWhatsApp() {
    const report = buildWhatsAppReport(state, totals);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia o resumo abaixo:', report);
    }
  }

  return (
    <div className="space-y-6">
      <HeaderSection totals={totals} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ActionButton onClick={reset} icon={<RotateCcw size={16} />} label="Reset para defeito" />
        <ActionButton
          onClick={copyWhatsApp}
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          label={copied ? 'Resumo copiado' : 'Copiar resumo WhatsApp'}
        />
        <ActionButton
          onClick={() => window.print()}
          icon={<FileDown size={16} />}
          label="Exportar PDF / Relatório"
          primary
        />
      </div>

      <KpiSection totals={totals} />

      <div className="lg:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#0a0a0a] p-1 border border-[#2a2a2a]">
          {(['semana', 'fimDeSemana'] as TabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mobileTab === tab
                  ? 'bg-[#D32F2F]/15 text-[#D32F2F]'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              {tab === 'semana' ? 'Semana' : 'Fim de semana'}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {mobileTab === 'semana' ? (
            <TournamentFormCard
              idPrefix="mobile-semana"
              title="Torneios de semana"
              subtitle="Sociais · turno da tarde / noite"
              accent="week"
              fields={SEMANA_FIELDS}
              values={state.semana}
              results={totals.semana}
              onChange={(key, value) => updateModality('semana', key, value)}
            />
          ) : (
            <TournamentFormCard
              idPrefix="mobile-fds"
              title="Torneios de fim de semana"
              subtitle="Mega torneios · eventos de 2 dias"
              accent="weekend"
              fields={FIM_DE_SEMANA_FIELDS}
              values={state.fimDeSemana}
              results={totals.fimDeSemana}
              onChange={(key, value) => updateModality('fimDeSemana', key, value)}
            />
          )}
        </div>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <TournamentFormCard
          idPrefix="desktop-semana"
          title="Torneios de semana"
          subtitle="Sociais · turno da tarde / noite"
          accent="week"
          fields={SEMANA_FIELDS}
          values={state.semana}
          results={totals.semana}
          onChange={(key, value) => updateModality('semana', key, value)}
        />
        <TournamentFormCard
          idPrefix="desktop-fds"
          title="Torneios de fim de semana"
          subtitle="Mega torneios · eventos de 2 dias"
          accent="weekend"
          fields={FIM_DE_SEMANA_FIELDS}
          values={state.fimDeSemana}
          results={totals.fimDeSemana}
          onChange={(key, value) => updateModality('fimDeSemana', key, value)}
        />
      </div>

      <ChartsSection totals={totals} />
      <BreakdownSection totals={totals} />
      <PrintSection state={state} totals={totals} />
    </div>
  );
}

function HeaderSection({ totals }: { totals: MonthlyTotals }) {
  const progress = Math.min(100, Math.max(0, (totals.lucroLiquidoMensal / META_MENSAL) * 100));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Calculator size={24} className="text-[#D32F2F]" />
          Padel Event ROI / Calculator
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Simula a rentabilidade mensal de torneios itinerantes: sociais de semana e mega eventos de fim de semana.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Target size={16} className="text-[#D32F2F]" />
            Meta mensal
          </div>
          {totals.metaAtingida ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
              <CheckCircle2 size={12} /> Superada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
              <XCircle size={12} /> Por atingir
            </span>
          )}
        </div>
        <p className="text-xl font-bold text-gray-100">{formatCurrency(META_MENSAL)}</p>
        <p className={`text-xs mt-1 ${totals.metaAtingida ? 'text-green-400' : 'text-red-400'}`}>
          {totals.metaAtingida
            ? `${signedCurrency(totals.desvioMeta)} acima da meta`
            : `Faltam ${formatCurrency(Math.abs(totals.desvioMeta))}`}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#111111]">
          <div
            className={`h-full rounded-full ${totals.metaAtingida ? 'bg-green-400' : 'bg-red-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function KpiSection({ totals }: { totals: MonthlyTotals }) {
  const lucroPositive = totals.lucroLiquidoMensal >= 0;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="md:col-span-2 xl:col-span-2 rounded-xl border border-green-400/20 bg-gradient-to-br from-green-400/10 to-[#1a1a1a] p-5">
        <div className="flex items-center gap-2 text-green-400 mb-2">
          <TrendingUp size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Lucro líquido mensal</span>
        </div>
        <p className={`text-4xl font-bold tabular-nums ${lucroPositive ? 'text-green-400' : 'text-red-400'}`}>
          {formatCurrency(totals.lucroLiquidoMensal)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniStat icon={<Users size={14} />} label="Jogadores" value={formatInteger(totals.totalJogadoresGeridos)} />
          <MiniStat icon={<Wallet size={14} />} label="Lucro / jogador" value={formatCurrency(totals.lucroMedioPorJogador)} />
        </div>
      </div>

      <KpiCard
        icon={<Banknote size={20} className="text-sky-400" />}
        label="Receita bruta total"
        value={formatCurrency(totals.receitaMensalTotal)}
        color="text-sky-400"
      />
      <KpiCard
        icon={<TrendingDown size={20} className="text-red-400" />}
        label="Custos operacionais"
        value={formatCurrency(totals.custoMensalTotal)}
        color="text-red-400"
      />

      <div className="md:col-span-2 xl:col-span-4 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#111111] text-green-400">
              <Percent size={16} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Margem de lucro</p>
              <p className="text-lg font-bold tabular-nums">{formatPercent(totals.margemLucro)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Receita de inscrições</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(totals.semana.receitaInscricoes + totals.fimDeSemana.receitaInscricoes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Receita de patrocínios</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(totals.semana.receitaPatrocinios + totals.fimDeSemana.receitaPatrocinios)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartsSection({ totals }: { totals: MonthlyTotals }) {
  const comparison = [
    { name: 'Semana', Receita: totals.semana.receitaTotal, Custo: totals.semana.custoTotal, Lucro: totals.semana.lucroLiquido },
    { name: 'Fim de semana', Receita: totals.fimDeSemana.receitaTotal, Custo: totals.fimDeSemana.custoTotal, Lucro: totals.fimDeSemana.lucroLiquido },
  ];
  const costs = combinedCostBreakdown(totals).filter((item) => item.value > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Receita vs custo vs lucro</h2>
        <p className="text-xs text-gray-500 mb-4">Comparação mensal entre semana e fim de semana.</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(Number(v ?? 0))} />
              <Legend wrapperStyle={{ color: '#ccc', fontSize: 12 }} />
              <Bar dataKey="Receita" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Custo" fill="#fb7185" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="xl:col-span-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Estrutura de custos</h2>
        <p className="text-xs text-gray-500 mb-4">Distribuição mensal por categoria.</p>
        {costs.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-gray-500">Sem custos para mostrar.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={costs} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={3}>
                  {costs.map((entry, index) => (
                    <Cell key={entry.key} fill={COST_COLORS[index % COST_COLORS.length]} stroke="#111111" />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(Number(v ?? 0))} />
                <Legend verticalAlign="bottom" wrapperStyle={{ color: '#ccc', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownSection({ totals }: { totals: MonthlyTotals }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BreakdownCard title="Detalhe — torneios de semana" results={totals.semana} />
      <BreakdownCard title="Detalhe — torneios de fim de semana" results={totals.fimDeSemana} />
    </div>
  );
}

function TournamentFormCard({
  idPrefix,
  title,
  subtitle,
  accent,
  fields,
  values,
  results,
  onChange,
}: {
  idPrefix: string;
  title: string;
  subtitle: string;
  accent: 'week' | 'weekend';
  fields: FieldConfig[];
  values: TournamentInputs;
  results: TournamentResults;
  onChange: (key: keyof TournamentInputs, value: number) => void;
}) {
  const Icon = accent === 'week' ? Sun : Trophy;
  const groups = [
    { title: 'Operação', keys: ['numTorneios', 'camposPorTorneio', 'jogadoresPorTorneio', 'horasPorCampo', 'diasPorTorneio'] as const },
    { title: 'Preços', keys: ['precoAluguerCampoHora', 'precoInscricaoJogador'] as const },
    { title: 'Custos e patrocínios', keys: ['custoBebidaJogador', 'custoPremiosTorneio', 'custoDJTorneio', 'patrociniosTorneio', 'outrosGastosTorneio'] as const },
  ];

  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[#2a2a2a] p-4">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-lg ${accent === 'week' ? 'bg-amber-400/10 text-amber-400' : 'bg-sky-400/10 text-sky-400'}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#2a2a2a] bg-[#111111] px-2 py-0.5 text-xs text-gray-400">
          {accent === 'week' ? <Sun size={12} /> : <Moon size={12} />}
          {formatInteger(values.numTorneios)} eventos
        </span>
      </div>

      <div className="space-y-5 p-4">
        {groups.map((group, index) => (
          <div key={group.title} className="space-y-3">
            {index > 0 && <div className="border-t border-[#2a2a2a]" />}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{group.title}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields
                .filter((f) => (group.keys as readonly string[]).includes(f.key))
                .map((field) => (
                  <NumberField
                    key={field.key}
                    idPrefix={idPrefix}
                    config={field}
                    value={values[field.key]}
                    onChange={(v) => onChange(field.key, v)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-[#2a2a2a] bg-[#111111] p-4 sm:grid-cols-4">
        <FormStat label="Receita" value={formatCurrency(results.receitaTotal)} />
        <FormStat label="Custo" value={formatCurrency(results.custoTotal)} />
        <FormStat label="Lucro" value={formatCurrency(results.lucroLiquido)} highlight />
        <FormStat label="Margem" value={formatPercent(results.margemLucro)} />
      </div>
    </div>
  );
}

function NumberField({
  idPrefix,
  config,
  value,
  onChange,
}: {
  idPrefix: string;
  config: FieldConfig;
  value: number;
  onChange: (value: number) => void;
}) {
  const decimals = config.kind === 'count' ? 0 : config.kind === 'hours' ? 1 : 2;
  const fieldId = `${idPrefix}-${config.key}`;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals));

  function commit(next: number) {
    const rounded = roundTo(clamp(next, config.min, config.max), decimals);
    setDraft(null);
    onChange(rounded);
  }

  const suffix = config.kind === 'currency' ? '€' : config.kind === 'hours' ? 'h' : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-xs font-medium text-gray-300">{config.label}</label>
        {config.hint && <span className="text-[10px] text-gray-500">{config.hint}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commit(value - config.step)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#111111] text-gray-400 hover:text-gray-100"
          aria-label={`Diminuir ${config.label}`}
        >
          <Minus size={14} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={fieldId}
            inputMode="decimal"
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const parsed = parseLocaleNumber(shown);
              if (parsed === null) { setDraft(null); return; }
              commit(parsed);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="h-8 w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-2 pr-7 text-right text-sm tabular-nums text-gray-100 outline-none focus:border-[#D32F2F]/50"
          />
          {suffix && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">{suffix}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => commit(value + config.step)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#111111] text-gray-400 hover:text-gray-100"
          aria-label={`Aumentar ${config.label}`}
        >
          <Plus size={14} />
        </button>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(e) => commit(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-[#D32F2F]"
      />
    </div>
  );
}

function BreakdownCard({ title, results }: { title: string; results: TournamentResults }) {
  const rows: [string, number][] = [
    ['Receita de inscrições', results.receitaInscricoes],
    ['Receita de patrocínios', results.receitaPatrocinios],
    ['Receita total', results.receitaTotal],
    ['Custo aluguer de campos', results.custoAluguerCampos],
    ['Custo bebidas / kits', results.custoBebidas],
    ['Custo prémios', results.custoPremios],
    ['Custo DJ / staff', results.custoDJ],
    ['Outros gastos', results.outrosGastos],
    ['Custo total', results.custoTotal],
    ['Lucro líquido', results.lucroLiquido],
  ];

  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      <div className="space-y-1">
        {rows.map(([label, val]) => {
          const emphasize = ['Lucro líquido', 'Receita total', 'Custo total'].includes(label);
          return (
            <div key={label} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${emphasize ? 'bg-[#111111]' : ''}`}>
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-sm tabular-nums font-medium ${label === 'Lucro líquido' ? (val >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-200'}`}>
                {formatCurrency(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrintSection({ state, totals }: { state: SimulatorState; totals: MonthlyTotals }) {
  return (
    <section className="hidden print:block text-black">
      <h1>Padel Event ROI / Calculator</h1>
      <p>Lucro: {formatCurrency(totals.lucroLiquidoMensal)}</p>
      <p>Semana ({state.semana.numTorneios} torneios): {formatCurrency(totals.semana.lucroLiquido)}</p>
      <p>Fim de semana ({state.fimDeSemana.numTorneios} torneios): {formatCurrency(totals.fimDeSemana.lucroLiquido)}</p>
    </section>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#111111] border border-[#2a2a2a] px-3 py-2">
      <div className="flex items-center gap-1 text-gray-500 mb-0.5">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FormStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${highlight ? 'text-green-400' : 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

function ActionButton({ onClick, icon, label, primary = false }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        primary
          ? 'bg-[#D32F2F] text-white hover:bg-[#b71c1c]'
          : 'border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 hover:text-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
