import { useState, useEffect, useCallback } from 'react';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettingsStore } from './stores';
import { useAutoScan } from './hooks';
import './styles/global.scss';

type Page = 'home' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const { initStore } = useSettingsStore();

  // Initialize settings store on app start
  useEffect(() => {
    initStore();
  }, [initStore]);

  // Auto-scan telemetry folder (initial + periodic)
  useAutoScan();

  const handleOpenSettings = useCallback(() => {
    setCurrentPage('settings');
  }, []);

  const handleCloseSettings = useCallback(() => {
    setCurrentPage('home');
  }, []);

  if (currentPage === 'settings') {
    return <SettingsPage onClose={handleCloseSettings} />;
  }

  return <HomePage onOpenSettings={handleOpenSettings} />;
}

export default App;
