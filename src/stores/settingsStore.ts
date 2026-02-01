import { create } from 'zustand';
import { load, Store } from '@tauri-apps/plugin-store';
import type { TelemetryFileInfo } from '../types';
import type { DateFormat } from '../utils/dateFormat';

const STORE_NAME = 'settings.json';
const TELEMETRY_FOLDER_KEY = 'telemetryFolder';
const DATE_FORMAT_KEY = 'dateFormat';
const AUTO_SCAN_ENABLED_KEY = 'autoScanEnabled';
const AUTO_SCAN_INTERVAL_KEY = 'autoScanInterval';

export type AutoScanInterval = 30 | 60 | 120 | 300;

interface SettingsState {
  // Settings
  telemetryFolder: string | null;
  dateFormat: DateFormat;
  autoScanEnabled: boolean;
  autoScanInterval: AutoScanInterval;

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
  setDateFormat: (format: DateFormat) => Promise<void>;
  setAutoScanEnabled: (enabled: boolean) => Promise<void>;
  setAutoScanInterval: (interval: AutoScanInterval) => Promise<void>;
  setTelemetryFiles: (files: TelemetryFileInfo[]) => void;
  setScanning: (isScanning: boolean) => void;
  setScanError: (error: string | null) => void;
  setDialogOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initial state
  telemetryFolder: null,
  dateFormat: 'locale',
  autoScanEnabled: false,
  autoScanInterval: 60,
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
      const savedDateFormat = await store.get<DateFormat>(DATE_FORMAT_KEY);
      const savedAutoScanEnabled = await store.get<boolean>(
        AUTO_SCAN_ENABLED_KEY
      );
      const savedAutoScanInterval = await store.get<AutoScanInterval>(
        AUTO_SCAN_INTERVAL_KEY
      );
      set({
        _store: store,
        telemetryFolder: savedFolder || null,
        dateFormat: savedDateFormat || 'locale',
        autoScanEnabled: savedAutoScanEnabled ?? false,
        autoScanInterval: savedAutoScanInterval || 60,
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

  // Set and persist the date format
  setDateFormat: async (format: DateFormat) => {
    const { _store } = get();

    set({ dateFormat: format });

    if (_store) {
      try {
        await _store.set(DATE_FORMAT_KEY, format);
        await _store.save();
      } catch (error) {
        console.error('Failed to save date format:', error);
      }
    }
  },

  // Set and persist auto scan enabled
  setAutoScanEnabled: async (enabled: boolean) => {
    const { _store } = get();

    set({ autoScanEnabled: enabled });

    if (_store) {
      try {
        await _store.set(AUTO_SCAN_ENABLED_KEY, enabled);
        await _store.save();
      } catch (error) {
        console.error('Failed to save auto scan enabled:', error);
      }
    }
  },

  // Set and persist auto scan interval
  setAutoScanInterval: async (interval: AutoScanInterval) => {
    const { _store } = get();

    set({ autoScanInterval: interval });

    if (_store) {
      try {
        await _store.set(AUTO_SCAN_INTERVAL_KEY, interval);
        await _store.save();
      } catch (error) {
        console.error('Failed to save auto scan interval:', error);
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
export const selectDateFormat = (state: SettingsState) => state.dateFormat;
export const selectAutoScanEnabled = (state: SettingsState) =>
  state.autoScanEnabled;
export const selectAutoScanInterval = (state: SettingsState) =>
  state.autoScanInterval;
export const selectTelemetryFiles = (state: SettingsState) =>
  state.telemetryFiles;
export const selectIsScanning = (state: SettingsState) => state.isScanning;
export const selectScanError = (state: SettingsState) => state.scanError;
export const selectIsDialogOpen = (state: SettingsState) => state.isDialogOpen;
