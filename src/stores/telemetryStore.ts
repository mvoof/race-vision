import { create } from 'zustand';
import type { LapTelemetry, TrajectoryPoint } from '../types';

interface TelemetryCache {
  [lapNumber: number]: LapTelemetry;
}

interface TrajectoryCache {
  [lapNumber: number]: TrajectoryPoint[];
}

interface TelemetryState {
  // Кэш телеметрии по номерам кругов
  telemetryCache: TelemetryCache;
  trajectoryCache: TrajectoryCache;

  // Текущий загружаемый круг
  loadingLaps: Set<number>;
  loadingTrajectories: Set<number>;

  // Actions
  setLapTelemetry: (lapNumber: number, telemetry: LapTelemetry) => void;
  setTrajectory: (lapNumber: number, trajectory: TrajectoryPoint[]) => void;
  setLapLoading: (lapNumber: number, isLoading: boolean) => void;
  setTrajectoryLoading: (lapNumber: number, isLoading: boolean) => void;
  getLapTelemetry: (lapNumber: number) => LapTelemetry | undefined;
  getTrajectory: (lapNumber: number) => TrajectoryPoint[] | undefined;
  clearCache: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  telemetryCache: {},
  trajectoryCache: {},
  loadingLaps: new Set(),
  loadingTrajectories: new Set(),

  setLapTelemetry: (lapNumber, telemetry) =>
    set((state) => ({
      telemetryCache: { ...state.telemetryCache, [lapNumber]: telemetry },
      loadingLaps: new Set([...state.loadingLaps].filter((n) => n !== lapNumber)),
    })),

  setTrajectory: (lapNumber, trajectory) =>
    set((state) => ({
      trajectoryCache: { ...state.trajectoryCache, [lapNumber]: trajectory },
      loadingTrajectories: new Set(
        [...state.loadingTrajectories].filter((n) => n !== lapNumber)
      ),
    })),

  setLapLoading: (lapNumber, isLoading) =>
    set((state) => {
      const newSet = new Set(state.loadingLaps);
      if (isLoading) {
        newSet.add(lapNumber);
      } else {
        newSet.delete(lapNumber);
      }
      return { loadingLaps: newSet };
    }),

  setTrajectoryLoading: (lapNumber, isLoading) =>
    set((state) => {
      const newSet = new Set(state.loadingTrajectories);
      if (isLoading) {
        newSet.add(lapNumber);
      } else {
        newSet.delete(lapNumber);
      }
      return { loadingTrajectories: newSet };
    }),

  getLapTelemetry: (lapNumber) => get().telemetryCache[lapNumber],

  getTrajectory: (lapNumber) => get().trajectoryCache[lapNumber],

  clearCache: () =>
    set({
      telemetryCache: {},
      trajectoryCache: {},
      loadingLaps: new Set(),
      loadingTrajectories: new Set(),
    }),
}));

// Селекторы
export const selectTelemetryCache = (state: TelemetryState) => state.telemetryCache;
export const selectTrajectoryCache = (state: TelemetryState) => state.trajectoryCache;
export const selectLoadingLaps = (state: TelemetryState) => state.loadingLaps;
