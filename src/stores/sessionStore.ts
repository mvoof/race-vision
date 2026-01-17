import { create } from 'zustand';
import type { Session, Lap, TrajectoryPoint } from '../types';

interface SessionState {
  // Текущая сессия
  session: Session | null;
  laps: Lap[];

  // Выбранный круг и его траектория
  selectedLapNumber: number | null;
  trajectory: TrajectoryPoint[];
  isLoadingTrajectory: boolean;

  // Статус загрузки
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (session: Session | null) => void;
  setLaps: (laps: Lap[]) => void;
  setSelectedLap: (lapNumber: number | null) => void;
  setTrajectory: (trajectory: TrajectoryPoint[]) => void;
  setLoadingTrajectory: (isLoading: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  laps: [],
  selectedLapNumber: null,
  trajectory: [],
  isLoadingTrajectory: false,
  isLoading: false,
  error: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSession: (session) => set({ session, error: null }),

  setLaps: (laps) => set({ laps }),

  setSelectedLap: (selectedLapNumber) => set({ selectedLapNumber }),

  setTrajectory: (trajectory) =>
    set({ trajectory, isLoadingTrajectory: false }),

  setLoadingTrajectory: (isLoadingTrajectory) => set({ isLoadingTrajectory }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),
}));

// Селекторы
export const selectSession = (state: SessionState) => state.session;
export const selectLaps = (state: SessionState) => state.laps;
export const selectSelectedLapNumber = (state: SessionState) =>
  state.selectedLapNumber;
export const selectTrajectory = (state: SessionState) => state.trajectory;
export const selectIsLoading = (state: SessionState) => state.isLoading;
export const selectIsLoadingTrajectory = (state: SessionState) =>
  state.isLoadingTrajectory;
export const selectError = (state: SessionState) => state.error;

export const selectBestLap = (state: SessionState): Lap | null => {
  const validLaps = state.laps.filter(
    (lap) => lap.isValid && lap.lapTime !== null
  );
  if (validLaps.length === 0) return null;
  return validLaps.reduce((best, lap) =>
    lap.lapTime! < best.lapTime! ? lap : best
  );
};

export const selectSelectedLap = (state: SessionState): Lap | null => {
  if (state.selectedLapNumber === null) return null;
  return (
    state.laps.find((lap) => lap.lapNumber === state.selectedLapNumber) || null
  );
};

export const selectValidLaps = (state: SessionState): Lap[] =>
  state.laps.filter((lap) => lap.isValid && lap.isComplete);
