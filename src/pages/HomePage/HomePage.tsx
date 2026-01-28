import React from 'react';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, useSettingsStore } from '../../stores';
import {
  openAndLoadTelemetryFile,
  getTrajectory,
  loadTelemetryFile,
  getLapTelemetry,
} from '../../services/tauri';
import { TrackSVG } from '../../components/track/TrackSVG';
import { TimelineSlider } from '../../components/track/TimelineSlider';
import type { ColorMode } from '../../components/track/TrackSVG';
import type {
  TelemetryFileInfo,
  TelemetrySample,
  LapTelemetry,
} from '../../types';
import {
  TireMonitor,
  BrakeMonitor,
  DigitalDashboard,
  SteeringWheel,
  PedalInputs,
} from '../../components/widgets';
import {
  formatDate,
  getDatePeriod,
  getFirstLetter,
} from '../../utils/dateFormat';
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
    dateFormat,
  } = useSettingsStore();

  // Get reset function for back navigation
  const reset = useSessionStore((state) => state.reset);

  // Local state - always called
  const [isDragOver, setIsDragOver] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('speed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'track'>('date');
  const [cursorDistance, setCursorDistance] = useState<number | null>(null);
  const [telemetrySample, setTelemetrySample] =
    useState<TelemetrySample | null>(null);
  const [lapTelemetry, setLapTelemetry] = useState<LapTelemetry | null>(null);
  const [widgetOrder, setWidgetOrder] = useState<string[]>([
    'dashboard',
    'steering',
    'pedals',
    'tires',
    'brakes',
  ]);

  // Load trajectory and telemetry when lap is selected
  useEffect(() => {
    if (selectedLapNumber === null) {
      setTrajectory([]);
      setLapTelemetry(null);
      setTelemetrySample(null);
      setCursorDistance(null);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoadingTrajectory(true);
      try {
        const [trajectoryData, telemetryData] = await Promise.all([
          getTrajectory(selectedLapNumber!),
          getLapTelemetry(selectedLapNumber!),
        ]);

        if (!cancelled) {
          setTrajectory(trajectoryData);
          setLapTelemetry(telemetryData);
          // Initialize cursor at start of lap
          if (trajectoryData.length > 0) {
            setCursorDistance(0);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        if (!cancelled) {
          setTrajectory([]);
          setLapTelemetry(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingTrajectory(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [selectedLapNumber, setTrajectory, setLoadingTrajectory]);

  // Find telemetry sample by distance
  useEffect(() => {
    if (cursorDistance === null || !lapTelemetry) {
      setTelemetrySample(null);
      return;
    }

    // Find closest sample by lapDistance
    let closestSample: TelemetrySample | null = null;
    let minDiff = Infinity;

    for (const sample of lapTelemetry.samples) {
      const diff = Math.abs(sample.lapDistance - cursorDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closestSample = sample;
      }
    }

    setTelemetrySample(closestSample);
  }, [cursorDistance, lapTelemetry]);

  // Handle widget drag and drop
  const handleWidgetDragStart = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', widgetId);
    },
    []
  );

  const handleWidgetDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleWidgetDrop = useCallback(
    (e: React.DragEvent, targetWidgetId: string) => {
      e.preventDefault();
      const sourceWidgetId = e.dataTransfer.getData('text/plain');

      if (sourceWidgetId === targetWidgetId) return;

      setWidgetOrder((prevOrder) => {
        const newOrder = [...prevOrder];
        const sourceIndex = newOrder.indexOf(sourceWidgetId);
        const targetIndex = newOrder.indexOf(targetWidgetId);

        if (sourceIndex === -1 || targetIndex === -1) return prevOrder;

        // Swap widgets
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, sourceWidgetId);

        return newOrder;
      });
    },
    []
  );

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

  // Group files by category based on sort type
  const groupedFiles = useMemo(() => {
    const groups: { key: string; label: string; files: TelemetryFileInfo[] }[] =
      [];
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
  }, [filteredFiles, sortBy, t]);

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

  // Render widget by ID
  const renderWidget = useCallback(
    (widgetId: string, sample: TelemetrySample | null) => {
      if (!sample) {
        return (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>
            {t('hoverOverTrack')}
          </div>
        );
      }

      switch (widgetId) {
        case 'dashboard':
          return (
            <DigitalDashboard
              speed={sample.speed}
              rpm={sample.rpm}
              gear={sample.gear}
              lapTime={sample.timestamp}
              compact={false}
            />
          );
        case 'steering':
          return (
            <SteeringWheel
              steering={sample.steering}
              maxAngle={540}
              compact={false}
            />
          );
        case 'pedals':
          return (
            <PedalInputs
              throttle={sample.throttle}
              brake={sample.brake}
              clutch={sample.clutch}
              compact={false}
            />
          );
        case 'tires':
          return (
            <TireMonitor
              tireTempLeft={sample.tireTempLeft}
              tireTempCenter={sample.tireTempCenter}
              tireTempRight={sample.tireTempRight}
              tirePressure={sample.tirePressure}
              tireWear={sample.tireWear}
              compact={false}
            />
          );
        case 'brakes':
          return <BrakeMonitor brakeTemp={sample.brakeTemp} compact={false} />;
        default:
          return null;
      }
    },
    [t]
  );

  // If session is loaded, show the analysis view
  if (session) {
    const selectedLap = laps.find((l) => l.lapNumber === selectedLapNumber);

    return (
      <div className={styles.analysisView}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.backButton}
              onClick={reset}
              title={t('backToFileList')}
            >
              <svg viewBox="0 0 24 24" fill="none" className={styles.icon}>
                <path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className={styles.sessionInfo}>
              <h1 className={styles.trackName}>{session.trackName}</h1>
              <span className={styles.sessionMeta}>
                {session.carName} • {session.sessionType} • {laps.length}{' '}
                {t('laps')}
              </span>
            </div>
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
          <main className={styles.main}>
            <div className={styles.mainContent}>
              <div className={styles.trackPanel}>
                <div className={styles.trackHeader}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                    }}
                  >
                    <h2 className={styles.sectionTitle}>{t('trackMap')}</h2>
                    {laps.length > 0 && (
                      <select
                        className={styles.lapSelector}
                        value={selectedLapNumber ?? ''}
                        onChange={(e) => {
                          const lapNum = e.target.value
                            ? parseInt(e.target.value, 10)
                            : null;
                          setSelectedLap(lapNum);
                        }}
                      >
                        <option value="">{t('selectLap')}</option>
                        {laps.map((lap) => (
                          <option
                            key={lap.id}
                            value={lap.lapNumber}
                            className={lap.isPersonalBest ? styles.bestLap : ''}
                          >
                            {t('lap')} {lap.lapNumber + 1}
                            {lap.lapTime
                              ? ` - ${formatLapTime(lap.lapTime)}`
                              : ''}
                            {lap.isPersonalBest ? ' ⭐' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
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
                    <TrackSVG
                      trajectory={trajectory}
                      colorMode={colorMode}
                      showBoundaries={true}
                      cursorDistance={cursorDistance}
                      onDistanceHover={setCursorDistance}
                    />
                  </div>
                ) : (
                  <div className={styles.trackPlaceholder}>
                    {t('noTrajectoryData')}
                  </div>
                )}
              </div>

              {/* Timeline Slider */}
              {selectedLapNumber !== null && trajectory.length > 0 && (
                <TimelineSlider
                  currentLap={selectedLap ?? null}
                  currentDistance={cursorDistance ?? 0}
                  maxDistance={trajectory[trajectory.length - 1]?.distance ?? 0}
                  onDistanceChange={setCursorDistance}
                />
              )}
            </div>

            {/* Telemetry Widgets - Always visible when lap is loaded */}
            {selectedLapNumber !== null && lapTelemetry && (
              <aside className={styles.widgetsPanel}>
                {widgetOrder.map((widgetId) => {
                  const widget = renderWidget(widgetId, telemetrySample);
                  return (
                    <div
                      key={widgetId}
                      className={styles.widgetWrapper}
                      draggable
                      onDragStart={(e) => handleWidgetDragStart(e, widgetId)}
                      onDragOver={handleWidgetDragOver}
                      onDrop={(e) => handleWidgetDrop(e, widgetId)}
                    >
                      {widget}
                    </div>
                  );
                })}
              </aside>
            )}
          </main>{' '}
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
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {isScanning ? (
            <div className={styles.fileListLoading}>
              <span className={styles.spinner} />
              {t('scanning')}
            </div>
          ) : groupedFiles.length > 0 ? (
            <div className={styles.fileListGrouped}>
              {groupedFiles.map((group) => (
                <div key={group.key} className={styles.fileGroup}>
                  <h3 className={styles.groupHeader}>{group.label}</h3>
                  <div className={styles.fileListGrid}>
                    {group.files.map((file) => (
                      <div
                        key={file.path}
                        role="button"
                        tabIndex={isLoading ? -1 : 0}
                        className={`${styles.fileCard} ${isLoading ? styles.disabled : ''}`}
                        onClick={() => !isLoading && handleFileSelect(file)}
                        onKeyDown={(e) => {
                          if (
                            !isLoading &&
                            (e.key === 'Enter' || e.key === ' ')
                          ) {
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
                          {formatDate(file.modifiedTime, dateFormat)}
                        </div>
                      </div>
                    ))}
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
