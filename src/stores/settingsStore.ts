import { create } from 'zustand';
import { load, Store } from '@tauri-apps/plugin-store';
import type { TelemetryFileInfo } from '../types';

const STORE_NAME = 'settings.json';
const TELEMETRY_FOLDER_KEY = 'telemetryFolder';

interface SettingsState {
  // Settings
  telemetryFolder: string | null;

  // File list from scanned folder
  telemetryFiles: TelemetryFileInfo[];
  isScanning: boolean;
  scanError: string | null;

  // Dialog state (global to prevent multiple dialogs)
  isDialogOpen: boolean;

  // Store instance (initialized lazily)
  _store: Store | null;

  // Actions
  initStore: () => Promise<void>;
  setTelemetryFolder: (folder: string | null) => Promise<void>;
  setTelemetryFiles: (files: TelemetryFileInfo[]) => void;
  setScanning: (isScanning: boolean) => void;
  setScanError: (error: string | null) => void;
  setDialogOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initial state
  telemetryFolder: null,
  telemetryFiles: [],
  isScanning: false,
  scanError: null,
  isDialogOpen: false,
  _store: null,

  // Initialize the store and load saved settings
  initStore: async () => {
    try {
      const store = await load(STORE_NAME);
      const savedFolder = await store.get<string>(TELEMETRY_FOLDER_KEY);
      set({
        _store: store,
        telemetryFolder: savedFolder || null,
      });
    } catch (error) {
      console.error('Failed to initialize settings store:', error);
    }
  },

  // Set and persist the telemetry folder
  setTelemetryFolder: async (folder: string | null) => {
    const { _store } = get();

    set({ telemetryFolder: folder });

    if (_store) {
      try {
        if (folder) {
          await _store.set(TELEMETRY_FOLDER_KEY, folder);
        } else {
          await _store.delete(TELEMETRY_FOLDER_KEY);
        }
        await _store.save();
      } catch (error) {
        console.error('Failed to save telemetry folder:', error);
      }
    }
  },

  setTelemetryFiles: (files) => set({ telemetryFiles: files }),
  setScanning: (isScanning) => set({ isScanning }),
  setScanError: (scanError) => set({ scanError }),
  setDialogOpen: (isDialogOpen) => set({ isDialogOpen }),
}));

// Selectors
export const selectTelemetryFolder = (state: SettingsState) =>
  state.telemetryFolder;
export const selectTelemetryFiles = (state: SettingsState) =>
  state.telemetryFiles;
export const selectIsScanning = (state: SettingsState) => state.isScanning;
export const selectScanError = (state: SettingsState) => state.scanError;
export const selectIsDialogOpen = (state: SettingsState) => state.isDialogOpen;
