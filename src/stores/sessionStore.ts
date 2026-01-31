import { create } from 'zustand';
import type { Session, Lap, TrajectoryPoint, LapTelemetry } from '../types';

const MAX_CACHED_TELEMETRY = 3;
const MAX_CACHED_TRAJECTORIES = 10;

interface SessionState {
  // Текущая сессия
  session: Session | null;
  laps: Lap[];

  // Выбранный круг и его траектория
  selectedLapNumber: number | null;
  trajectory: TrajectoryPoint[]; // Current trajectory (for backward compatibility/convenience)
  isLoadingTrajectory: boolean;

  // Cache for all loaded laps
  lapCache: Record<number, { trajectory: TrajectoryPoint[]; telemetry: LapTelemetry | null }>;

  // LRU order for eviction (most recent at end)
  telemetryCacheOrder: number[];
  trajectoryCacheOrder: number[];

  // Статус загрузки
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (session: Session | null) => void;
  setLaps: (laps: Lap[]) => void;
  setSelectedLap: (lapNumber: number | null) => void;
  setTrajectory: (trajectory: TrajectoryPoint[]) => void;
  cacheLapData: (lapNumber: number, data: { trajectory?: TrajectoryPoint[]; telemetry?: LapTelemetry | null }) => void;
  touchCache: (lapNumber: number) => void;
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
  lapCache: {},
  telemetryCacheOrder: [],
  trajectoryCacheOrder: [],
  isLoading: false,
  error: null,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setSession: (session) => set({ session, error: null }),

  setLaps: (laps) => set({ laps, lapCache: {}, telemetryCacheOrder: [], trajectoryCacheOrder: [] }), // Reset cache on new laps

  setSelectedLap: (selectedLapNumber) => {
    const { lapCache } = get();
    if (selectedLapNumber !== null && lapCache[selectedLapNumber]) {
      set({
        selectedLapNumber,
        trajectory: lapCache[selectedLapNumber].trajectory,
        isLoadingTrajectory: false
      });
    } else {
      set({ selectedLapNumber });
    }
  },

  setTrajectory: (trajectory) => {
    const { selectedLapNumber, lapCache } = get();
    if (selectedLapNumber !== null) {
      // Avoid redundant updates
      if (lapCache[selectedLapNumber]?.trajectory === trajectory) {
        set({ isLoadingTrajectory: false });
        return;
      }

      set({
        trajectory,
        isLoadingTrajectory: false,
        lapCache: {
          ...lapCache,
          [selectedLapNumber]: {
            ...lapCache[selectedLapNumber],
            trajectory
          }
        }
      });
    } else {
      set({ trajectory, isLoadingTrajectory: false });
    }
  },

  // Action to cache data with LRU eviction for telemetry
  cacheLapData: (lapNumber, data) => set((state) => {
    const current = state.lapCache[lapNumber];
    if (
      current &&
      (data.trajectory === undefined || current.trajectory === data.trajectory) &&
      (data.telemetry === undefined || current.telemetry === data.telemetry)
    ) {
      return state;
    }

    const newTelemetry = data.telemetry ?? current?.telemetry ?? null;
    let newTelemetryOrder = [...state.telemetryCacheOrder];
    let newTrajectoryOrder = [...state.trajectoryCacheOrder];
    let newLapCache = { ...state.lapCache };

    // If we're adding telemetry data, manage LRU
    if (data.telemetry !== undefined && data.telemetry !== null) {
      newTelemetryOrder = newTelemetryOrder.filter(n => n !== lapNumber);
      newTelemetryOrder.push(lapNumber);

      while (newTelemetryOrder.length > MAX_CACHED_TELEMETRY) {
        const evictLap = newTelemetryOrder.shift()!;
        if (newLapCache[evictLap]) {
          newLapCache = {
            ...newLapCache,
            [evictLap]: {
              trajectory: newLapCache[evictLap].trajectory,
              telemetry: null,
            }
          };
        }
      }
    }

    // If we're adding trajectory data, manage LRU
    if (data.trajectory !== undefined && data.trajectory.length > 0) {
      newTrajectoryOrder = newTrajectoryOrder.filter(n => n !== lapNumber);
      newTrajectoryOrder.push(lapNumber);

      while (newTrajectoryOrder.length > MAX_CACHED_TRAJECTORIES) {
        const evictLap = newTrajectoryOrder.shift()!;
        if (newLapCache[evictLap]) {
          if (newLapCache[evictLap].telemetry) {
            // Keep entry but remove trajectory
            newLapCache = {
              ...newLapCache,
              [evictLap]: {
                trajectory: [],
                telemetry: newLapCache[evictLap].telemetry,
              }
            };
          } else {
            // No telemetry either — remove entry entirely
            const { [evictLap]: _, ...rest } = newLapCache;
            newLapCache = rest;
          }
        }
      }
    }

    newLapCache = {
      ...newLapCache,
      [lapNumber]: {
        trajectory: data.trajectory ?? current?.trajectory ?? [],
        telemetry: newTelemetry,
      }
    };

    return {
      lapCache: newLapCache,
      telemetryCacheOrder: newTelemetryOrder,
      trajectoryCacheOrder: newTrajectoryOrder,
    };
  }),

  // Touch cache entry to update LRU order (without loading new data)
  touchCache: (lapNumber) => set((state) => {
    if (!state.telemetryCacheOrder.includes(lapNumber)) return state;
    return {
      telemetryCacheOrder: [
        ...state.telemetryCacheOrder.filter(n => n !== lapNumber),
        lapNumber,
      ],
    };
  }),

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
