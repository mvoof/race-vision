import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Settings,
  ChevronDown,
  FolderOpen,
  Activity,
  Calendar,
  Clock,
  Database,
} from 'lucide-react';
import {
  useSettingsStore,
  useSessionStore,
  useDashboardStore,
} from '../../stores';
import {
  openAndLoadTelemetryFile,
  loadTelemetryFile,
  analyzeTrackBoundaries,
} from '../../services/tauri';
import { formatDate } from '../../utils/dateFormat';
import type { TelemetryFileInfo } from '../../types';
import { Button } from '../common';
import styles from './SessionDashboard.module.scss';

interface SessionDashboardProps {
  onNavigateToAnalysis: () => void;
  onOpenSettings: () => void;
}

export function SessionDashboard({
  onNavigateToAnalysis,
  onOpenSettings,
}: SessionDashboardProps) {
  const { t } = useTranslation();

  // Store access
  const {
    telemetryFiles,
    telemetryFolder,
    isScanning,
    isDialogOpen,
    setDialogOpen,
    dateFormat,
  } = useSettingsStore();

  const {
    setSession,
    setLaps,
    setLoading,
    setError,
    setSelectedLap,
    setTrajectory,
    isLoading,
    error,
  } = useSessionStore();

  const {
    searchQuery,
    sortBy,
    setSearchQuery,
    setSortBy,
    getFilteredFiles,
    getGroupedFiles,
  } = useDashboardStore();

  // Local state for UI only
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter and Sort Logic
  const filteredFiles = useMemo(
    () => getFilteredFiles(telemetryFiles),
    [telemetryFiles, searchQuery, sortBy, getFilteredFiles]
  );

  // Grouping Logic
  const groupedFiles = useMemo(
    () => getGroupedFiles(filteredFiles, t),
    [filteredFiles, sortBy, t, getGroupedFiles]
  );

  // Handlers
  const handleOpenFile = useCallback(async () => {
    if (isDialogOpen || isLoading) return;

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
        // Auto-select first lap so the track is visible immediately
        if (result.laps.length > 0) {
          setSelectedLap(result.laps[0].lapNumber);
        }

        // Trigger analysis navigation
        onNavigateToAnalysis();

        // Background task: analyze boundaries
        if (result.session.trackName && telemetryFolder) {
          analyzeTrackBoundaries(
            telemetryFolder,
            result.session.trackName
          ).catch(console.warn);
        }
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
    telemetryFolder,
    setDialogOpen,
    setSession,
    setLaps,
    setLoading,
    setError,
    setSelectedLap,
    setTrajectory,
    onNavigateToAnalysis,
  ]);

  const handleFileSelect = useCallback(
    async (file: TelemetryFileInfo) => {
      if (isDialogOpen || isLoading) return;

      setLoading(true);
      setError(null);
      setSelectedLap(null);
      setTrajectory([]);

      try {
        const result = await loadTelemetryFile(file.path);
        setSession(result.session);
        setLaps(result.laps);
        // Auto-select first lap so the track is visible immediately
        if (result.laps.length > 0) {
          setSelectedLap(result.laps[0].lapNumber);
        }

        onNavigateToAnalysis();

        if (result.session.trackName && telemetryFolder) {
          analyzeTrackBoundaries(
            telemetryFolder,
            result.session.trackName
          ).catch(console.warn);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [
      isDialogOpen,
      isLoading,
      telemetryFolder,
      setSession,
      setLaps,
      setLoading,
      setError,
      setSelectedLap,
      setTrajectory,
      onNavigateToAnalysis,
    ]
  );

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // --- RENDER ---

  if (!telemetryFolder) {
    return (
      <div
        className={`${styles.emptyState} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.emptyContent}>
          <Activity size={64} className={styles.logoIcon} />
          <h1 className={styles.title}>APEX Telemetry</h1>
          <p className={styles.subtitle}>{t('welcomeSubtitle')}</p>

          <Button
            variant="primary"
            size="large"
            icon={<FolderOpen size={20} />}
            onClick={handleOpenFile}
            disabled={isLoading || isDialogOpen}
            className={styles.setupButton}
          >
            {isLoading ? t('loading') : t('openTelemetryFile')}
          </Button>

          <div className={styles.setupHint}>
            <p>{t('setupFolderHint')}</p>
            <Button variant="secondary" onClick={onOpenSettings}>
              {t('openSettings')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Sessions</h1>
          <span className={styles.countBadge}>
            {filteredFiles.length} files
          </span>
        </div>

        <div className={styles.controls}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={16} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Sort */}
          <div className={styles.sortWrapper}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={styles.sortSelect}
            >
              <option value="date">{t('sortByDate')}</option>
              <option value="name">{t('sortByName')}</option>
              <option value="track">{t('sortByTrack')}</option>
            </select>
            <ChevronDown className={styles.chevronIcon} size={16} />
          </div>

          <Button
            variant="ghost"
            size="medium"
            icon={<Settings size={20} />}
            onClick={onOpenSettings}
            title={t('settings')}
          />
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {isScanning && (
          <div className={styles.loadingBanner}>
            <span className={styles.spinner} />
            Scanning telemetry folder...
          </div>
        )}

        {groupedFiles.length > 0 ? (
          <div className={styles.gridContainer}>
            {groupedFiles.map((group) => (
              <div key={group.key} className={styles.groupSection}>
                <h3 className={styles.groupHeader}>{group.label}</h3>
                <div className={styles.cardsGrid}>
                  {group.files.map((file) => (
                    <div
                      key={file.path}
                      className={`${styles.sessionCard} ${isLoading ? styles.disabled : ''}`}
                      onClick={() => !isLoading && handleFileSelect(file)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.trackName}>
                          {file.trackName || t('unknownTrack')}
                        </span>
                      </div>

                      <div className={styles.cardBody}>
                        <div className={styles.infoRow}>
                          <Database size={14} />
                          <span>{file.carName || t('unknownCar')}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <Clock size={14} />
                          <span>{file.sessionType || 'Session'}</span>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        <div className={styles.date}>
                          <Calendar size={12} />
                          {formatDate(file.modifiedTime, dateFormat)}
                        </div>
                        <div className={styles.arrow}>→</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyStateSimple}>
            <p>{searchQuery ? t('noFilesMatch') : t('noFilesInFolder')}</p>
            <Button variant="secondary" onClick={handleOpenFile}>
              Import File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}