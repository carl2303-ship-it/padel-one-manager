import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_FIM_DE_SEMANA,
  DEFAULT_SEMANA,
  STORAGE_KEY,
} from '../lib/tournament-roi/defaults';
import type { SimulatorState, TournamentInputs } from '../lib/tournament-roi/types';

export const DEFAULT_STATE: SimulatorState = {
  semana: DEFAULT_SEMANA,
  fimDeSemana: DEFAULT_FIM_DE_SEMANA,
};

let clientState: SimulatorState | null = null;
const listeners = new Set<() => void>();

function readStoredState(): SimulatorState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SimulatorState>;
    return {
      semana: { ...DEFAULT_SEMANA, ...parsed.semana },
      fimDeSemana: { ...DEFAULT_FIM_DE_SEMANA, ...parsed.fimDeSemana },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function getClientSnapshot(): SimulatorState {
  if (!clientState) clientState = readStoredState();
  return clientState;
}

function getServerSnapshot(): SimulatorState {
  return DEFAULT_STATE;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeState(next: SimulatorState) {
  clientState = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emit();
}

export function useTournamentRoiState() {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const setState = useCallback(
    (updater: SimulatorState | ((current: SimulatorState) => SimulatorState)) => {
      const current = getClientSnapshot();
      const next = typeof updater === 'function' ? updater(current) : updater;
      writeState(next);
    },
    [],
  );

  const updateModality = useCallback(
    (modality: keyof SimulatorState, key: keyof TournamentInputs, value: number) => {
      setState((current) => ({
        ...current,
        [modality]: { ...current[modality], [key]: value },
      }));
    },
    [setState],
  );

  const reset = useCallback(() => {
    writeState({
      semana: { ...DEFAULT_SEMANA },
      fimDeSemana: { ...DEFAULT_FIM_DE_SEMANA },
    });
  }, []);

  return { state, updateModality, reset };
}
