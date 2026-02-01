import { create } from 'zustand';
import type {
  ComputedTrackBoundary,
  BoundaryMode,
  BoundarySettings,
  Point2D,
  TrackBoundaryEnvelope,
  Corner,
} from '../types';
import { DEFAULT_BOUNDARY_SETTINGS } from '../types';
import {
  generateOffsetBoundary,
  generateBoundariesFromTrajectories,
  addTrajectoryToBoundary,
} from '../services/track';

interface BoundaryState {
  // Current computed boundary
  computedBoundary: ComputedTrackBoundary | null;

  // Track boundary envelope (from multi-file analysis)
  envelope: TrackBoundaryEnvelope | null;

  // Detected corners for current trajectory
  corners: Corner[];

  // Cache of computed boundaries by track name
  boundaryCache: Map<string, ComputedTrackBoundary>;

  // Trajectories collected for boundary generation
  collectedTrajectories: Point2D[][];

  // Loading state
  isGenerating: boolean;
  error: string | null;

  // Settings
  settings: BoundarySettings;

  // Actions
  generateBoundaryFromTrajectory: (
    trajectory: Point2D[],
    trackName: string,
    trackLayout?: string
  ) => void;

  generateBoundaryFromMultipleTrajectories: (
    trajectories: Point2D[][],
    trackName: string,
    trackLayout?: string
  ) => Promise<void>;

  addTrajectory: (trajectory: Point2D[]) => void;

  generateFromCollectedTrajectories: (
    trackName: string,
    trackLayout?: string
  ) => Promise<void>;

  clearCollectedTrajectories: () => void;

  loadCachedBoundary: (trackName: string) => ComputedTrackBoundary | null;

  clearBoundary: () => void;

  clearCache: () => void;

  setSettings: (settings: Partial<BoundarySettings>) => void;

  setMode: (mode: BoundaryMode) => void;

  toggleShowBoundaries: () => void;

  // Envelope + corners
  setEnvelope: (envelope: TrackBoundaryEnvelope | null) => void;
  setCorners: (corners: Corner[]) => void;
}

export const useBoundaryStore = create<BoundaryState>((set, get) => ({
  // Initial state
  computedBoundary: null,
  envelope: null,
  corners: [],
  boundaryCache: new Map(),
  collectedTrajectories: [],
  isGenerating: false,
  error: null,
  settings: DEFAULT_BOUNDARY_SETTINGS,

  // Actions
  generateBoundaryFromTrajectory: (
    trajectory: Point2D[],
    trackName: string,
    trackLayout: string = ''
  ) => {
    set({ isGenerating: true, error: null });

    try {
      const { settings } = get();
      const boundary = generateOffsetBoundary(
        trajectory,
        trackName,
        trackLayout,
        settings.fallbackWidth
      );

      if (boundary) {
        // Cache the boundary
        const cache = new Map(get().boundaryCache);
        cache.set(trackName, boundary);

        set({
          computedBoundary: boundary,
          boundaryCache: cache,
          isGenerating: false,
        });
      } else {
        set({
          isGenerating: false,
          error: 'Failed to generate boundary from trajectory',
        });
      }
    } catch (err) {
      set({
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  generateBoundaryFromMultipleTrajectories: async (
    trajectories: Point2D[][],
    trackName: string,
    trackLayout: string = ''
  ) => {
    set({ isGenerating: true, error: null });

    try {
      const { settings } = get();
      const boundary = await generateBoundariesFromTrajectories(
        trajectories,
        trackName,
        trackLayout,
        {
          fallbackWidth: settings.fallbackWidth,
          segmentSize: settings.segmentSize,
        }
      );

      if (boundary) {
        // Cache the boundary
        const cache = new Map(get().boundaryCache);
        cache.set(trackName, boundary);

        set({
          computedBoundary: boundary,
          boundaryCache: cache,
          isGenerating: false,
        });
      } else {
        set({
          isGenerating: false,
          error: 'Failed to generate boundaries from trajectories',
        });
      }
    } catch (err) {
      set({
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  addTrajectory: (trajectory: Point2D[]) => {
    const { collectedTrajectories, computedBoundary } = get();

    // Add to collected trajectories
    const newCollected = [...collectedTrajectories, trajectory];
    set({ collectedTrajectories: newCollected });

    // If we already have a boundary, incrementally update it
    if (computedBoundary) {
      try {
        const updatedBoundary = addTrajectoryToBoundary(
          computedBoundary,
          trajectory
        );

        const cache = new Map(get().boundaryCache);
        cache.set(computedBoundary.trackName, updatedBoundary);

        set({
          computedBoundary: updatedBoundary,
          boundaryCache: cache,
        });
      } catch (err) {
        console.error('Failed to update boundary:', err);
      }
    }
  },

  generateFromCollectedTrajectories: async (
    trackName: string,
    trackLayout: string = ''
  ) => {
    const { collectedTrajectories, settings } = get();

    if (collectedTrajectories.length === 0) {
      set({ error: 'No trajectories collected' });
      return;
    }

    set({ isGenerating: true, error: null });

    try {
      const boundary = await generateBoundariesFromTrajectories(
        collectedTrajectories,
        trackName,
        trackLayout,
        {
          fallbackWidth: settings.fallbackWidth,
          segmentSize: settings.segmentSize,
        }
      );

      if (boundary) {
        const cache = new Map(get().boundaryCache);
        cache.set(trackName, boundary);

        set({
          computedBoundary: boundary,
          boundaryCache: cache,
          isGenerating: false,
        });
      } else {
        set({
          isGenerating: false,
          error: 'Failed to generate boundaries',
        });
      }
    } catch (err) {
      set({
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  clearCollectedTrajectories: () => {
    set({ collectedTrajectories: [] });
  },

  loadCachedBoundary: (trackName: string) => {
    const { boundaryCache } = get();
    const cached = boundaryCache.get(trackName);

    if (cached) {
      set({ computedBoundary: cached, error: null });
      return cached;
    }

    return null;
  },

  clearBoundary: () => {
    set({ computedBoundary: null, error: null });
  },

  clearCache: () => {
    set({
      boundaryCache: new Map(),
      computedBoundary: null,
      collectedTrajectories: [],
    });
  },

  setSettings: (newSettings: Partial<BoundarySettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  setMode: (mode: BoundaryMode) => {
    set((state) => ({
      settings: { ...state.settings, mode },
    }));
  },

  toggleShowBoundaries: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        showBoundaries: !state.settings.showBoundaries,
      },
    }));
  },

  setEnvelope: (envelope) => set({ envelope }),
  setCorners: (corners) => set({ corners }),
}));

// Selectors
export const selectComputedBoundary = (state: BoundaryState) =>
  state.computedBoundary;
export const selectIsGenerating = (state: BoundaryState) => state.isGenerating;
export const selectBoundaryError = (state: BoundaryState) => state.error;
export const selectBoundarySettings = (state: BoundaryState) => state.settings;
export const selectBoundaryMode = (state: BoundaryState) => state.settings.mode;
export const selectShowComputedBoundaries = (state: BoundaryState) =>
  state.settings.showBoundaries;
export const selectCollectedTrajectoryCount = (state: BoundaryState) =>
  state.collectedTrajectories.length;
export const selectEnvelope = (state: BoundaryState) => state.envelope;
export const selectCorners = (state: BoundaryState) => state.corners;
