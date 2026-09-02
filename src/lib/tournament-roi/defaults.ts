import type { FieldConfig, TournamentInputs } from './types';

export const META_MENSAL = 2000;

export const DEFAULT_SEMANA: TournamentInputs = {
  numTorneios: 19,
  camposPorTorneio: 5,
  jogadoresPorTorneio: 12,
  horasPorCampo: 1.5,
  diasPorTorneio: 1,
  precoAluguerCampoHora: 10,
  precoInscricaoJogador: 12,
  custoBebidaJogador: 1,
  custoPremiosTorneio: 10,
  custoDJTorneio: 0,
  patrociniosTorneio: 0,
  outrosGastosTorneio: 0,
};

export const DEFAULT_FIM_DE_SEMANA: TournamentInputs = {
  numTorneios: 2,
  camposPorTorneio: 5,
  jogadoresPorTorneio: 160,
  horasPorCampo: 6,
  diasPorTorneio: 2,
  precoAluguerCampoHora: 10,
  precoInscricaoJogador: 20,
  custoBebidaJogador: 1.5,
  custoPremiosTorneio: 40,
  custoDJTorneio: 200,
  patrociniosTorneio: 200,
  outrosGastosTorneio: 50,
};

export const STORAGE_KEY = 'padel-one-hq:tournament-roi:v1';

const SHARED_FIELDS: FieldConfig[] = [
  { key: 'numTorneios', label: 'N.º de torneios', hint: 'Quantidade no mês', min: 0, max: 60, step: 1, kind: 'count' },
  { key: 'camposPorTorneio', label: 'Campos por torneio', min: 1, max: 20, step: 1, kind: 'count' },
  { key: 'jogadoresPorTorneio', label: 'Jogadores por torneio', min: 0, max: 400, step: 1, kind: 'count' },
  { key: 'diasPorTorneio', label: 'Dias por torneio', min: 1, max: 7, step: 1, kind: 'count' },
  { key: 'precoAluguerCampoHora', label: 'Aluguer campo / hora', min: 0, max: 80, step: 0.5, kind: 'currency' },
  { key: 'precoInscricaoJogador', label: 'Inscrição por jogador', min: 0, max: 80, step: 0.5, kind: 'currency' },
  { key: 'custoBebidaJogador', label: 'Bebida / kit por jogador', min: 0, max: 20, step: 0.5, kind: 'currency' },
  { key: 'custoPremiosTorneio', label: 'Prémios por torneio', min: 0, max: 2000, step: 5, kind: 'currency' },
  { key: 'custoDJTorneio', label: 'DJ / staff por torneio', min: 0, max: 2000, step: 10, kind: 'currency' },
  { key: 'patrociniosTorneio', label: 'Patrocínios por torneio', min: 0, max: 5000, step: 10, kind: 'currency' },
  { key: 'outrosGastosTorneio', label: 'Outros gastos por torneio', min: 0, max: 2000, step: 5, kind: 'currency' },
];

export const SEMANA_FIELDS: FieldConfig[] = [
  ...SHARED_FIELDS.slice(0, 3),
  { key: 'horasPorCampo', label: 'Horas por campo', hint: 'Duração de cada campo', min: 0, max: 12, step: 0.5, kind: 'hours' },
  ...SHARED_FIELDS.slice(3),
];

export const FIM_DE_SEMANA_FIELDS: FieldConfig[] = [
  ...SHARED_FIELDS.slice(0, 3),
  { key: 'horasPorCampo', label: 'Horas por campo / dia', hint: 'Ocupação diária de cada campo', min: 0, max: 16, step: 0.5, kind: 'hours' },
  ...SHARED_FIELDS.slice(3),
];
