import { create } from 'zustand';

type ChartXAxis = 'time' | 'distance';
type ColorMode = 'speed' | 'throttle' | 'brake' | 'gear' | 'gforce';

interface UiState {
  // Sidebar
  sidebarCollapsed: boolean;

  // Графики
  chartXAxis: ChartXAxis;
  showGrid: boolean;
  showMarkers: boolean;

  // Track view
  trackColorMode: ColorMode;
  showSectorMarkers: boolean;
  showSpeedLabels: boolean;

  // Sync cursor position (для синхронизации между графиками и картой)
  cursorDistance: number | null;
  cursorTimestamp: number | null;

  // Zoom state
  zoomRange: { start: number; end: number } | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChartXAxis: (axis: ChartXAxis) => void;
  setTrackColorMode: (mode: ColorMode) => void;
  toggleShowGrid: () => void;
  toggleShowMarkers: () => void;
  toggleSectorMarkers: () => void;
  toggleSpeedLabels: () => void;
  setCursorPosition: (
    distance: number | null,
    timestamp: number | null
  ) => void;
  setZoomRange: (range: { start: number; end: number } | null) => void;
  resetZoom: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  chartXAxis: 'distance',
  showGrid: true,
  showMarkers: true,
  trackColorMode: 'speed',
  showSectorMarkers: true,
  showSpeedLabels: false,
  cursorDistance: null,
  cursorTimestamp: null,
  zoomRange: null,

  // Actions
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setChartXAxis: (axis) => set({ chartXAxis: axis }),

  setTrackColorMode: (mode) => set({ trackColorMode: mode }),

  toggleShowGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleShowMarkers: () =>
    set((state) => ({ showMarkers: !state.showMarkers })),

  toggleSectorMarkers: () =>
    set((state) => ({ showSectorMarkers: !state.showSectorMarkers })),

  toggleSpeedLabels: () =>
    set((state) => ({ showSpeedLabels: !state.showSpeedLabels })),

  setCursorPosition: (distance, timestamp) =>
    set({ cursorDistance: distance, cursorTimestamp: timestamp }),

  setZoomRange: (range) => set({ zoomRange: range }),

  resetZoom: () => set({ zoomRange: null }),
}));

// Селекторы
export const selectSidebarCollapsed = (state: UiState) =>
  state.sidebarCollapsed;
export const selectChartXAxis = (state: UiState) => state.chartXAxis;
export const selectTrackColorMode = (state: UiState) => state.trackColorMode;
export const selectCursorPosition = (state: UiState) => ({
  distance: state.cursorDistance,
  timestamp: state.cursorTimestamp,
});
export const selectZoomRange = (state: UiState) => state.zoomRange;
