import { create } from 'zustand';

const MAX_SELECTED_LAPS = 4;

interface SelectionState {
  // Выбранные круги для сравнения (max 4)
  selectedLaps: number[];

  // Основной круг (первый в списке или специально выбранный)
  primaryLap: number | null;

  // Референсный круг для delta (обычно лучший)
  referenceLap: number | null;

  // Actions
  selectLap: (lapNumber: number) => void;
  deselectLap: (lapNumber: number) => void;
  toggleLap: (lapNumber: number) => void;
  setPrimaryLap: (lapNumber: number | null) => void;
  setReferenceLap: (lapNumber: number | null) => void;
  clearSelection: () => void;
  setSelectedLaps: (laps: number[]) => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedLaps: [],
  primaryLap: null,
  referenceLap: null,

  selectLap: (lapNumber) =>
    set((state) => {
      if (state.selectedLaps.includes(lapNumber)) return state;
      if (state.selectedLaps.length >= MAX_SELECTED_LAPS) return state;

      const newSelection = [...state.selectedLaps, lapNumber];
      return {
        selectedLaps: newSelection,
        primaryLap: state.primaryLap ?? lapNumber,
      };
    }),

  deselectLap: (lapNumber) =>
    set((state) => {
      const newSelection = state.selectedLaps.filter((n) => n !== lapNumber);
      return {
        selectedLaps: newSelection,
        primaryLap:
          state.primaryLap === lapNumber
            ? (newSelection[0] ?? null)
            : state.primaryLap,
        referenceLap:
          state.referenceLap === lapNumber ? null : state.referenceLap,
      };
    }),

  toggleLap: (lapNumber) => {
    const { selectedLaps, selectLap, deselectLap } = get();
    if (selectedLaps.includes(lapNumber)) {
      deselectLap(lapNumber);
    } else {
      selectLap(lapNumber);
    }
  },

  setPrimaryLap: (lapNumber) =>
    set((state) => {
      if (lapNumber !== null && !state.selectedLaps.includes(lapNumber)) {
        return state;
      }
      return { primaryLap: lapNumber };
    }),

  setReferenceLap: (lapNumber) => set({ referenceLap: lapNumber }),

  clearSelection: () =>
    set({
      selectedLaps: [],
      primaryLap: null,
      referenceLap: null,
    }),

  setSelectedLaps: (laps) =>
    set({
      selectedLaps: laps.slice(0, MAX_SELECTED_LAPS),
      primaryLap: laps[0] ?? null,
    }),
}));

// Селекторы
export const selectSelectedLaps = (state: SelectionState) => state.selectedLaps;
export const selectPrimaryLap = (state: SelectionState) => state.primaryLap;
export const selectReferenceLap = (state: SelectionState) => state.referenceLap;
export const selectIsLapSelected =
  (lapNumber: number) => (state: SelectionState) =>
    state.selectedLaps.includes(lapNumber);
export const selectCanSelectMore = (state: SelectionState) =>
  state.selectedLaps.length < MAX_SELECTED_LAPS;
