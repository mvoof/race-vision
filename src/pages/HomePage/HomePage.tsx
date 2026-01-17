import React from 'react';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, useSettingsStore } from '../../stores';
import {
  openAndLoadTelemetryFile,
  getTrajectory,
  loadTelemetryFile,
} from '../../services/tauri';
import { TrackCanvas } from '../../components/track/TrackCanvas';
import type { ColorMode } from '../../components/track/TrackCanvas';
import type { TelemetryFileInfo } from '../../types';
import styles from './HomePage.module.scss';

interface HomePageProps {
  onOpenSettings: () => void;
}

export function HomePage({ onOpenSettings }: HomePageProps) {
  const { t } = useTranslation();

  // Session store - always called
  const {
    session,
    laps,
    isLoading,
    error,
    selectedLapNumber,
    trajectory,
    isLoadingTrajectory,
    setSession,
    setLaps,
    setLoading,
    setError,
    setSelectedLap,
    setTrajectory,
    setLoadingTrajectory,
  } = useSessionStore();

  // Settings store - always called
  const {
    telemetryFiles,
    telemetryFolder,
    isScanning,
    isDialogOpen,
    setDialogOpen,
  } = useSettingsStore();

  // Local state - always called
  const [isDragOver, setIsDragOver] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('speed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'track'>('date');

  // Load trajectory when lap is selected
  useEffect(() => {
    if (selectedLapNumber === null) {
      setTrajectory([]);
      return;
    }

    let cancelled = false;

    async function loadTrajectory() {
      setLoadingTrajectory(true);
      try {
        const data = await getTrajectory(selectedLapNumber!);
        if (!cancelled) {
          setTrajectory(data);
        }
      } catch (err) {
        console.error('Failed to load trajectory:', err);
        if (!cancelled) {
          setTrajectory([]);
        }
      }
    }

    loadTrajectory();

    return () => {
      cancelled = true;
    };
  }, [selectedLapNumber, setTrajectory, setLoadingTrajectory]);

  // Filtered and sorted files
  const filteredFiles = useMemo(() => {
    let files = [...telemetryFiles];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      files = files.filter(
        (file) =>
          file.fileName.toLowerCase().includes(query) ||
          file.trackName?.toLowerCase().includes(query) ||
          file.carName?.toLowerCase().includes(query) ||
          file.driverName?.toLowerCase().includes(query)
      );
    }

    // Sort
    files.sort((a, b) => {
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

    return files;
  }, [telemetryFiles, searchQuery, sortBy]);

  const handleOpenFile = useCallback(async () => {
    // Prevent opening multiple dialogs
    if (isDialogOpen || isLoading) {
      return;
    }

    setDialogOpen(true);
    setLoading(true);
    setError(null);
    setSelectedLap(null);
    setTrajectory([]);

    try {
      const result = await openAndLoadTelemetryFile();
      if (result) {
        setSession(result.session);
        setLaps(result.laps);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDialogOpen(false);
      setLoading(false);
    }
  }, [
    isDialogOpen,
    isLoading,
    setDialogOpen,
    setSession,
    setLaps,
    setLoading,
    setError,
    setSelectedLap,
    setTrajectory,
  ]);

  const handleLapClick = useCallback(
    (lapNumber: number) => {
      if (selectedLapNumber === lapNumber) {
        setSelectedLap(null);
      } else {
        setSelectedLap(lapNumber);
      }
    },
    [selectedLapNumber, setSelectedLap]
  );

  const handleFileSelect = useCallback(
    async (file: TelemetryFileInfo) => {
      if (isDialogOpen || isLoading) {
        return;
      }

      setLoading(true);
      setError(null);
      setSelectedLap(null);
      setTrajectory([]);

      try {
        const result = await loadTelemetryFile(file.path);
        setSession(result.session);
        setLaps(result.laps);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [
      isDialogOpen,
      isLoading,
      setSession,
      setLaps,
      setLoading,
      setError,
      setSelectedLap,
      setTrajectory,
    ]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // TODO: Handle file drop when Tauri supports it
  }, []);

  // If session is loaded, show the analysis view
  if (session) {
    const selectedLap = laps.find((l) => l.lapNumber === selectedLapNumber);

    return (
      <div className={styles.analysisView}>
        <header className={styles.header}>
          <div className={styles.sessionInfo}>
            <h1 className={styles.trackName}>{session.trackName}</h1>
            <span className={styles.sessionMeta}>
              {session.carName} • {session.sessionType} • {laps.length}{' '}
              {t('laps')}
            </span>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.openButton}
              onClick={handleOpenFile}
              disabled={isLoading || isDialogOpen}
            >
              {isLoading ? t('loading') : t('openFile')}
            </button>
            <button
              className={styles.settingsButton}
              onClick={onOpenSettings}
              title={t('settings')}
            >
              <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
                <path
                  d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <aside className={styles.sidebar}>
            <div className={styles.lapList}>
              <h2 className={styles.sectionTitle}>{t('laps')}</h2>
              {laps.map((lap) => (
                <div
                  key={lap.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.lapItem} ${lap.isPersonalBest ? styles.bestLap : ''} ${selectedLapNumber === lap.lapNumber ? styles.selected : ''}`}
                  onClick={() => handleLapClick(lap.lapNumber)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLapClick(lap.lapNumber);
                    }
                  }}
                >
                  <span className={styles.lapNumber}>{lap.lapNumber}</span>
                  <span className={styles.lapTime}>
                    {lap.lapTime ? formatLapTime(lap.lapTime) : '--:--.---'}
                  </span>
                  {lap.deltaToSessionBest !== null &&
                    lap.deltaToSessionBest !== 0 && (
                      <span
                        className={`${styles.delta} ${lap.deltaToSessionBest > 0 ? styles.slower : styles.faster}`}
                      >
                        {lap.deltaToSessionBest > 0 ? '+' : ''}
                        {lap.deltaToSessionBest.toFixed(3)}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.trackPanel}>
              <div className={styles.trackHeader}>
                <h2 className={styles.sectionTitle}>{t('trackMap')}</h2>
                {selectedLapNumber !== null && (
                  <div className={styles.colorModeSelector}>
                    <button
                      className={`${styles.colorModeBtn} ${colorMode === 'speed' ? styles.active : ''}`}
                      onClick={() => setColorMode('speed')}
                    >
                      {t('speed')}
                    </button>
                    <button
                      className={`${styles.colorModeBtn} ${colorMode === 'throttle' ? styles.active : ''}`}
                      onClick={() => setColorMode('throttle')}
                    >
                      {t('throttle')}/{t('brake')}
                    </button>
                  </div>
                )}
              </div>

              {selectedLapNumber === null ? (
                <div className={styles.trackPlaceholder}>
                  {t('selectLapToViewTrack')}
                </div>
              ) : isLoadingTrajectory ? (
                <div className={styles.trackPlaceholder}>
                  <span className={styles.spinner} />
                  {t('loading')}
                </div>
              ) : trajectory.length > 0 ? (
                <div className={styles.trackContainer}>
                  <TrackCanvas trajectory={trajectory} colorMode={colorMode} />
                  {selectedLap && (
                    <div className={styles.lapInfo}>
                      <span className={styles.lapInfoLabel}>
                        {t('lap')} {selectedLapNumber}
                      </span>
                      {selectedLap.lapTime && (
                        <span className={styles.lapInfoTime}>
                          {formatLapTime(selectedLap.lapTime)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.trackPlaceholder}>
                  {t('noTrajectoryData')}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Welcome screen - show file list if folder is configured, otherwise show file open
  return (
    <div
      className={`${styles.welcome} ${isDragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Settings button in corner */}
      <button
        className={styles.cornerSettingsButton}
        onClick={onOpenSettings}
        title={t('settings')}
      >
        <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
          <path
            d="M12 15a3 3 0 100-6 3 3 0 000 6z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </button>

      {/* Show file list if folder is configured, otherwise show file open prompt */}
      {telemetryFolder ? (
        <div className={styles.fileListFullPage}>
          <div className={styles.fileListHeader}>
            <h1 className={styles.fileListTitle}>{t('selectTelemetry')}</h1>
            <div className={styles.fileListControls}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'date' | 'name' | 'track')
                }
              >
                <option value="date">{t('sortByDate')}</option>
                <option value="name">{t('sortByName')}</option>
                <option value="track">{t('sortByTrack')}</option>
              </select>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {isScanning ? (
            <div className={styles.fileListLoading}>
              <span className={styles.spinner} />
              {t('scanning')}
            </div>
          ) : filteredFiles.length > 0 ? (
            <div className={styles.fileListGrid}>
              {filteredFiles.map((file) => (
                <div
                  key={file.path}
                  role="button"
                  tabIndex={isLoading ? -1 : 0}
                  className={`${styles.fileCard} ${isLoading ? styles.disabled : ''}`}
                  onClick={() => !isLoading && handleFileSelect(file)}
                  onKeyDown={(e) => {
                    if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleFileSelect(file);
                    }
                  }}
                >
                  <div className={styles.fileCardTrack}>
                    {file.trackName || t('unknownTrack')}
                  </div>
                  <div className={styles.fileCardMeta}>
                    <span className={styles.fileCardCar}>
                      {file.carName || t('unknownCar')}
                    </span>
                    <span className={styles.fileCardSession}>
                      {file.sessionType || t('unknown')}
                    </span>
                  </div>
                  <div className={styles.fileCardDate}>
                    {new Date(file.modifiedTime * 1000).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noFiles}>
              {searchQuery ? t('noFilesMatch') : t('noFilesInFolder')}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.welcomeContent}>
          <div className={styles.logo}>
            <svg viewBox="0 0 48 48" fill="none" className={styles.logoIcon}>
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M24 8 L24 24 L36 32"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="24" r="3" fill="currentColor" />
            </svg>
          </div>

          <h1 className={styles.title}>Race Vision</h1>
          <p className={styles.subtitle}>{t('welcomeSubtitle')}</p>

          <button
            className={styles.openFileButton}
            onClick={handleOpenFile}
            disabled={isLoading || isDialogOpen}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                {t('loading')}
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={styles.buttonIcon}
                >
                  <path
                    d="M3 15V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 3V15M12 15L7 10M12 15L17 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t('openTelemetryFile')}
              </>
            )}
          </button>

          <p className={styles.hint}>{t('dropFileHint')}</p>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.supportedFormats}>
            <span className={styles.formatsLabel}>
              {t('supportedFormats')}:
            </span>
            <span className={styles.format}>Le Mans Ultimate (.duckdb)</span>
          </div>

          <div className={styles.setupHint}>
            <p>{t('setupFolderHint')}</p>
            <button className={styles.setupButton} onClick={onOpenSettings}>
              {t('openSettings')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

export default HomePage;
