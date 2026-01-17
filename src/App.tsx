import { useState, useEffect, useCallback } from 'react';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettingsStore } from './stores';
import { scanTelemetryFolder } from './services/tauri';
import './styles/global.scss';

type Page = 'home' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const {
    initStore,
    telemetryFolder,
    setTelemetryFiles,
    setScanning,
    setScanError,
  } = useSettingsStore();

  // Initialize settings store on app start
  useEffect(() => {
    initStore();
  }, [initStore]);

  // Scan telemetry folder when it's loaded from settings
  useEffect(() => {
    if (telemetryFolder) {
      setScanning(true);
      setScanError(null);
      scanTelemetryFolder(telemetryFolder)
        .then((files) => {
          setTelemetryFiles(files);
        })
        .catch((err) => {
          setScanError(err instanceof Error ? err.message : String(err));
          setTelemetryFiles([]);
        })
        .finally(() => {
          setScanning(false);
        });
    }
  }, [telemetryFolder, setTelemetryFiles, setScanning, setScanError]);

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
