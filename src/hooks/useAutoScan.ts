import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores';
import { scanTelemetryFolder } from '../services/tauri';

/**
 * Hook for automatic periodic scanning of the telemetry folder.
 * Should be used at the app root level.
 */
export function useAutoScan() {
  const {
    telemetryFolder,
    autoScanEnabled,
    autoScanInterval,
    isScanning,
    setTelemetryFiles,
    setScanning,
    setScanError,
  } = useSettingsStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningRef = useRef(false);

  const performScan = useCallback(async () => {
    if (!telemetryFolder || isScanningRef.current) {
      return;
    }

    isScanningRef.current = true;
    setScanning(true);
    setScanError(null);

    try {
      const files = await scanTelemetryFolder(telemetryFolder);
      setTelemetryFiles(files);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      isScanningRef.current = false;
      setScanning(false);
    }
  }, [telemetryFolder, setTelemetryFiles, setScanning, setScanError]);

  // Initial scan when folder is set (always, regardless of autoScanEnabled)
  // Dependency on performScan intentionally omitted to only trigger on folder change
  useEffect(() => {
    if (telemetryFolder) {
      performScan();
    }
  }, [telemetryFolder, performScan]);

  // Set up periodic scanning
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't set up interval if disabled or no folder
    if (!autoScanEnabled || !telemetryFolder) {
      return;
    }

    // Set up new interval (interval is in seconds, convert to ms)
    intervalRef.current = setInterval(() => {
      performScan();
    }, autoScanInterval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoScanEnabled, autoScanInterval, telemetryFolder, performScan]);

  return {
    isScanning,
    performScan,
  };
}

export default useAutoScan;
