export type TournamentInputs = {
  numTorneios: number;
  camposPorTorneio: number;
  jogadoresPorTorneio: number;
  horasPorCampo: number;
  diasPorTorneio: number;
  precoAluguerCampoHora: number;
  precoInscricaoJogador: number;
  custoBebidaJogador: number;
  custoPremiosTorneio: number;
  custoDJTorneio: number;
  patrociniosTorneio: number;
  outrosGastosTorneio: number;
};

export type TournamentResults = {
  receitaInscricoes: number;
  receitaPatrocinios: number;
  receitaTotal: number;
  custoAluguerCampos: number;
  custoBebidas: number;
  custoPremios: number;
  custoDJ: number;
  outrosGastos: number;
  custoTotal: number;
  lucroLiquido: number;
  totalJogadores: number;
  margemLucro: number;
};

export type MonthlyTotals = {
  semana: TournamentResults;
  fimDeSemana: TournamentResults;
  receitaMensalTotal: number;
  custoMensalTotal: number;
  lucroLiquidoMensal: number;
  totalJogadoresGeridos: number;
  lucroMedioPorJogador: number;
  margemLucro: number;
  metaAtingida: boolean;
  desvioMeta: number;
};

export type FieldKind = 'count' | 'hours' | 'currency';

export type FieldConfig = {
  key: keyof TournamentInputs;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  kind: FieldKind;
};

export type SimulatorState = {
  semana: TournamentInputs;
  fimDeSemana: TournamentInputs;
};
