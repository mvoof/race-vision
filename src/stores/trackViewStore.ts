import { create } from 'zustand';
import type { TelemetrySample } from '../types';
import type { ColorMode } from '../components/track/TrackCanvas/utils/colorUtils';

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrackViewState {
  // Camera / viewport
  viewBox: ViewBox | null;

  // Interaction modes
  isFollowing: boolean;
  isPanning: boolean;
  isDraggingCursor: boolean;

  // Visualization
  colorMode: ColorMode;

  // Cursor position on track (by distance along trajectory)
  cursorDistance: number | null;

  // Current telemetry sample under cursor
  telemetrySample: TelemetrySample | null;

  // UI toggles
  showLayoutControls: boolean;

  // Actions
  setViewBox: (viewBox: ViewBox | null) => void;
  setIsFollowing: (isFollowing: boolean) => void;
  toggleFollowing: () => void;
  setIsPanning: (isPanning: boolean) => void;
  setIsDraggingCursor: (isDragging: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setCursorDistance: (distance: number | null) => void;
  setTelemetrySample: (sample: TelemetrySample | null) => void;
  setShowLayoutControls: (show: boolean) => void;
  toggleLayoutControls: () => void;

  // Reset interaction state (e.g. on mouse leave)
  resetInteraction: () => void;
}

export const useTrackViewStore = create<TrackViewState>((set) => ({
  // Initial state
  viewBox: null,
  isFollowing: false,
  isPanning: false,
  isDraggingCursor: false,
  colorMode: 'speed',
  cursorDistance: null,
  telemetrySample: null,
  showLayoutControls: false,

  // Actions
  setViewBox: (viewBox) => set({ viewBox }),
  setIsFollowing: (isFollowing) => set({ isFollowing }),
  toggleFollowing: () => set((s) => ({ isFollowing: !s.isFollowing })),
  setIsPanning: (isPanning) => set({ isPanning }),
  setIsDraggingCursor: (isDragging) => set({ isDraggingCursor: isDragging }),
  setColorMode: (colorMode) => set({ colorMode }),
  setCursorDistance: (cursorDistance) => set({ cursorDistance }),
  setTelemetrySample: (telemetrySample) => set({ telemetrySample }),
  setShowLayoutControls: (showLayoutControls) => set({ showLayoutControls }),
  toggleLayoutControls: () =>
    set((s) => ({ showLayoutControls: !s.showLayoutControls })),

  resetInteraction: () =>
    set({ isPanning: false, isDraggingCursor: false }),
}));

// Selectors
export const selectViewBox = (s: TrackViewState) => s.viewBox;
export const selectIsFollowing = (s: TrackViewState) => s.isFollowing;
export const selectColorMode = (s: TrackViewState) => s.colorMode;
export const selectCursorDistance = (s: TrackViewState) => s.cursorDistance;
export const selectTelemetrySample = (s: TrackViewState) => s.telemetrySample;
export const selectShowLayoutControls = (s: TrackViewState) =>
  s.showLayoutControls;
