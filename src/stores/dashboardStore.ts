import { create } from 'zustand';
import { TelemetryFileInfo } from '../types';

import { getFirstLetter, getDatePeriod } from '../utils/dateFormat';

interface DashboardState {
  searchQuery: string;
  sortBy: 'date' | 'name' | 'track';
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'date' | 'name' | 'track') => void;
  
  // Selectors/Computed helpers
  getFilteredFiles: (files: TelemetryFileInfo[]) => TelemetryFileInfo[];
  getGroupedFiles: (files: TelemetryFileInfo[], t: (key: string) => string) => { key: string; label: string; files: TelemetryFileInfo[] }[];
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  searchQuery: '',
  sortBy: 'date',

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),

  getFilteredFiles: (files) => {
    const { searchQuery, sortBy } = get();
    let filtered = [...files];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (file) =>
          file.fileName.toLowerCase().includes(query) ||
          file.trackName?.toLowerCase().includes(query) ||
          file.carName?.toLowerCase().includes(query) ||
          file.driverName?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.fileName.localeCompare(b.fileName);
        case 'track':
          return (a.trackName || '').localeCompare(b.trackName || '');
        case 'date':
        default:
          return b.modifiedTime - a.modifiedTime;
      }
    });

    return filtered;
  },

  getGroupedFiles: (filteredFiles, t) => {
    const { sortBy } = get();
    const groups: { key: string; label: string; files: TelemetryFileInfo[] }[] = [];
    const groupMap = new Map<string, TelemetryFileInfo[]>();

    filteredFiles.forEach((file) => {
      let groupKey: string;
      switch (sortBy) {
        case 'name':
          groupKey = getFirstLetter(file.fileName);
          break;
        case 'track':
          groupKey = getFirstLetter(file.trackName || '');
          break;
        case 'date':
        default:
          groupKey = getDatePeriod(file.modifiedTime, t);
          break;
      }
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(file);
    });

    groupMap.forEach((files, key) => {
      groups.push({ key, label: key, files });
    });

    return groups;
  },
}));
