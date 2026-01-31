import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  Layout,
  Map as MapIcon,
  Gauge,
  Gamepad2,
  Activity,
  Disc,
  Octagon,
  Zap,
  Flag,
  BarChart2,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';

import { useSessionStore, useSettingsStore } from '../../stores';
import { useLayoutStore } from '../../stores/layoutStore';
import {
  getTrajectory,
  getLapTelemetry,
  openAndLoadTelemetryFile,
  analyzeTrackBoundaries,
} from '../../services/tauri';
import {
  TrackCanvas,
  type ColorMode,
} from '../../components/track/TrackCanvas';
import { TimelineSlider } from '../../components/track/TimelineSlider';
import { WidgetGrid, WidgetContainer } from '../../components/layout';
import { usePlayback } from '../../hooks/usePlayback';
import { Button, Panel } from '../common';

import {
  TireMonitor,
  BrakeMonitor,
  DigitalDashboard,
  SteeringWheel,
  PedalInputs,
} from '../../components/widgets';
import { TelemetryChart } from '../../components/charts';

import type {
  TelemetrySample,
  LapTelemetry,
  TrackBoundaryEnvelope,
} from '../../types';
import styles from './AnalysisView.module.scss';

/**
 * Binary-search + lerp interpolation for smooth cursor animation.
 * Finds two bracketing samples by timestamp and linearly interpolates lapDistance.
 * Returns the interpolated distance and the nearest discrete sample (for widget display).
 */
function interpolateSampleAtTime(
  samples: TelemetrySample[],
  targetTime: number
): { distance: number; sample: TelemetrySample } | null {
  if (samples.length === 0) return null;

  // Clamp to bounds
  if (targetTime <= samples[0].timestamp) {
    return { distance: samples[0].lapDistance, sample: samples[0] };
  }
  if (targetTime >= samples[samples.length - 1].timestamp) {
    const last = samples[samples.length - 1];
    return { distance: last.lapDistance, sample: last };
  }

  // Binary search for bracket [lo, hi] where samples[lo].timestamp <= targetTime < samples[hi].timestamp
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid].timestamp <= targetTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const sA = samples[lo];
  const sB = samples[hi];
  const dt = sB.timestamp - sA.timestamp;

  if (dt === 0) {
    return { distance: sA.lapDistance, sample: sA };
  }

  const t = (targetTime - sA.timestamp) / dt;
  const distance = sA.lapDistance + (sB.lapDistance - sA.lapDistance) * t;

  // Use nearest sample for discrete widget values (gear, rpm, etc.)
  const nearestSample = t < 0.5 ? sA : sB;

  return { distance, sample: nearestSample };
}

// Widget Metadata
const WIDGET_META: Record<
  string,
  { title: string; icon: React.ReactNode; accent: string }
> = {
  track: { title: 'Track Map', icon: <MapIcon size={16} />, accent: '#ccff00' }, // Lime
  dashboard: {
    title: 'Dashboard',
    icon: <Gauge size={16} />,
    accent: '#00bcd4',
  }, // Cyan
  steering: {
    title: 'Steering',
    icon: <Gamepad2 size={16} />,
    accent: '#ffcc00',
  }, // Yellow
  pedals: { title: 'Pedals', icon: <Activity size={16} />, accent: '#bd00ff' }, // Purple
  tires: { title: 'Tires', icon: <Disc size={16} />, accent: '#f44336' }, // Red
  brakes: { title: 'Brakes', icon: <Octagon size={16} />, accent: '#ff5722' }, // Deep Orange
  gforce: { title: 'G-Force', icon: <Zap size={16} />, accent: '#ff9800' }, // Orange
  sectors: { title: 'Sectors', icon: <Flag size={16} />, accent: '#4caf50' }, // Green
  'lap-comparison': {
    title: 'Lap Comparison',
    icon: <BarChart2 size={16} />,
    accent: '#009688',
  }, // Teal
  'mini-chart': {
    title: 'Mini Chart',
    icon: <TrendingUp size={16} />,
    accent: '#3f51b5',
  }, // Indigo
};

interface AnalysisViewProps {
  onBack: () => void;
}

export function AnalysisView({ onBack }: AnalysisViewProps) {
  const { t } = useTranslation();

  // Stores
  const {
    session,
    laps,
    selectedLapNumber,
    trajectory,
    isLoadingTrajectory,
    lapCache,
    setSelectedLap,
    setTrajectory,
    setLoadingTrajectory,
    cacheLapData,
    setSession,
    setLaps,
    setLoading,
    setError,
    touchCache,
    isLoading,
  } = useSessionStore();

  const { telemetryFolder, isDialogOpen, setDialogOpen } = useSettingsStore();

  const {
    currentPreset,
    panelWidth,
    chartDrawerHeight,
    layouts,
    setPreset,
    setPanelWidth,
    setChartDrawerHeight,
    updateLayout,
    toggleWidgetVisibility,
  } = useLayoutStore();

  const currentLayout = layouts[currentPreset];

  // Local State
  const [colorMode, setColorMode] = useState<ColorMode>('speed');
  const [cursorDistance, setCursorDistance] = useState<number | null>(null);
  const [telemetrySample, setTelemetrySample] =
    useState<TelemetrySample | null>(null);
  const [lapTelemetry, setLapTelemetry] = useState<LapTelemetry | null>(null);
  const [envelope, setEnvelope] = useState<TrackBoundaryEnvelope | null>(null);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  // Resizing Logic
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = React.useRef(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      // Clamp width (min 300px, max 80% of screen to allow track shrinking)
      const clampedWidth = Math.max(
        300,
        Math.min(newWidth, window.innerWidth * 0.8)
      );
      setPanelWidth(clampedWidth);
    },
    [setPanelWidth]
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    resizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizingRef.current = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [handleMouseMove, stopResizing]
  );

  // Vertical Resizer (chart drawer)
  const [isVResizing, setIsVResizing] = useState(false);
  const vResizingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleVMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!vResizingRef.current || !contentRef.current) return;
      const contentRect = contentRef.current.getBoundingClientRect();
      const newHeight = contentRect.bottom - e.clientY;
      const clampedHeight = Math.max(100, Math.min(newHeight, contentRect.height * 0.6));
      setChartDrawerHeight(clampedHeight);
    },
    [setChartDrawerHeight]
  );

  const stopVResizing = useCallback(() => {
    setIsVResizing(false);
    vResizingRef.current = false;
    document.removeEventListener('mousemove', handleVMouseMove);
    document.removeEventListener('mouseup', stopVResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleVMouseMove]);

  const startVResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsVResizing(true);
      vResizingRef.current = true;
      document.addEventListener('mousemove', handleVMouseMove);
      document.addEventListener('mouseup', stopVResizing);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [handleVMouseMove, stopVResizing]
  );

  // Playback Logic
  const totalDuration = useMemo(() => {
    if (laps.length === 0) return 0;
    const lastLap = laps[laps.length - 1];
    return (
      lastLap.endTimestamp ?? lastLap.startTimestamp + (lastLap.lapTime || 0)
    );
  }, [laps]);

  const { isPlaying, currentTime, currentTimeRef, playbackSpeed, setPlaybackSpeed, play, pause, seek } = usePlayback({
    duration: totalDuration,
  });

  // Load Envelope if needed (and not loaded)
  useEffect(() => {
    if (session?.trackName && telemetryFolder && !envelope) {
      analyzeTrackBoundaries(telemetryFolder, session.trackName)
        .then(setEnvelope)
        .catch(console.warn);
    }
  }, [session, telemetryFolder, envelope]);

  // Synchronous cursor computation — runs in the SAME render pass as currentTime update.
  // This eliminates the 1-frame lag caused by useEffect → setState pipeline.
  const playbackCursor = useMemo(() => {
    if (!laps.length) return null;

    const activeLap = laps.find(
      (l) =>
        currentTime >= l.startTimestamp &&
        (l.endTimestamp ? currentTime < l.endTimestamp : true)
    );
    if (!activeLap) return null;

    const data =
      lapCache[activeLap.lapNumber]?.telemetry ||
      (activeLap.lapNumber === selectedLapNumber ? lapTelemetry : null);
    if (!data) return null;

    const lapTimeElapsed = currentTime - activeLap.startTimestamp;
    return interpolateSampleAtTime(data.samples, lapTimeElapsed);
  }, [currentTime, laps, selectedLapNumber, lapTelemetry, lapCache]);

  // Derived values: during playback use synchronous memo; otherwise use manual state
  const effectiveCursorDistance = playbackCursor?.distance ?? cursorDistance;
  const effectiveSample = playbackCursor?.sample ?? telemetrySample;

  // --- High-frequency cursor ref (60fps, bypasses React render cycle) ---
  // During playback the cursor canvas reads from this ref via rAF,
  // so even when React only re-renders at ~12fps, the cursor moves smoothly.
  const cursorDistanceRef = useRef<number | null>(null);

  // Store stable references to data needed for interpolation
  const lapsRef = useRef(laps);
  const lapCacheRef = useRef(lapCache);
  const selectedLapRef = useRef(selectedLapNumber);
  const lapTelemetryRef = useRef(lapTelemetry);
  lapsRef.current = laps;
  lapCacheRef.current = lapCache;
  selectedLapRef.current = selectedLapNumber;
  lapTelemetryRef.current = lapTelemetry;

  useEffect(() => {
    if (!isPlaying) {
      // When not playing, keep ref in sync with manual cursor
      cursorDistanceRef.current = cursorDistance;
      return;
    }

    let rafId = 0;
    let _avFrame = 0;
    const update = () => {
      _avFrame++;
      const time = currentTimeRef.current;
      const ls = lapsRef.current;
      // Debug: expose cursor ref chain state
      const _activeLap = ls.find(
        (l) => time >= l.startTimestamp && (l.endTimestamp ? time < l.endTimestamp : true)
      );
      const _cache = lapCacheRef.current;
      const _data = _activeLap ? (
        _cache[_activeLap.lapNumber]?.telemetry ||
        (_activeLap.lapNumber === selectedLapRef.current ? lapTelemetryRef.current : null)
      ) : null;
      (window as unknown as Record<string, unknown>).__analysisDebug = {
        frame: _avFrame, time, lapsCount: ls.length,
        activeLapNum: _activeLap?.lapNumber ?? null,
        activeLapStart: _activeLap?.startTimestamp ?? null,
        activeLapEnd: _activeLap?.endTimestamp ?? null,
        hasData: !!_data,
        samplesCount: _data?.samples?.length ?? 0,
        selectedLap: selectedLapRef.current,
        cursorDistRef: cursorDistanceRef.current,
        firstLapStart: ls[0]?.startTimestamp,
        elapsed: _activeLap ? time - _activeLap.startTimestamp : null,
        sampleTsRange: _data ? [_data.samples[0]?.timestamp, _data.samples[_data.samples.length - 1]?.timestamp] : null,
        sampleDistRange: _data ? [_data.samples[0]?.lapDistance, _data.samples[_data.samples.length - 1]?.lapDistance] : null,
      };
      if (!ls.length) {
        rafId = requestAnimationFrame(update);
        return;
      }

      const activeLap = ls.find(
        (l) =>
          time >= l.startTimestamp &&
          (l.endTimestamp ? time < l.endTimestamp : true)
      );
      if (!activeLap) {
        rafId = requestAnimationFrame(update);
        return;
      }

      const cache = lapCacheRef.current;
      const data =
        cache[activeLap.lapNumber]?.telemetry ||
        (activeLap.lapNumber === selectedLapRef.current
          ? lapTelemetryRef.current
          : null);

      if (data) {
        const elapsed = time - activeLap.startTimestamp;
        const result = interpolateSampleAtTime(data.samples, elapsed);
        cursorDistanceRef.current = result?.distance ?? null;
        // Debug: expose actual interpolation result
        (window as unknown as Record<string, unknown>).__interpDebug = {
          elapsed,
          resultDist: result?.distance,
          resultTs: result?.sample?.timestamp,
          sampleFirst: data.samples[0]?.timestamp,
          sampleLast: data.samples[data.samples.length - 1]?.timestamp,
        };
      }

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentTimeRef, cursorDistance]);

  // Side-effects: lap selection + prefetch (no cursor setState needed during playback)
  useEffect(() => {
    if (!laps.length) return;

    const activeLap = laps.find(
      (l) =>
        currentTime >= l.startTimestamp &&
        (l.endTimestamp ? currentTime < l.endTimestamp : true)
    );
    if (!activeLap) return;

    if (activeLap.lapNumber !== selectedLapNumber) {
      setSelectedLap(activeLap.lapNumber);
    }

    // Prefetch next lap's trajectory during playback for smooth transitions
    if (isPlaying) {
      const activeLapIdx = laps.indexOf(activeLap);
      const nextLap = laps[activeLapIdx + 1];
      if (nextLap && !lapCache[nextLap.lapNumber]?.trajectory) {
        getTrajectory(nextLap.lapNumber)
          .then((traj) => cacheLapData(nextLap.lapNumber, { trajectory: traj }))
          .catch(() => {});
      }
    }
  }, [currentTime, laps, selectedLapNumber, setSelectedLap, lapCache, isPlaying, cacheLapData]);

  // Sync state when playback stops so manual interaction picks up the right position
  const prevPlayingRef = useRef(false);
  useEffect(() => {
    if (prevPlayingRef.current && !isPlaying && playbackCursor) {
      setCursorDistance(playbackCursor.distance);
      setTelemetrySample(playbackCursor.sample);
    }
    prevPlayingRef.current = isPlaying;
  }, [isPlaying, playbackCursor]);

  // Load trajectory/telemetry when lap changes (lazy telemetry with LRU cache)
  useEffect(() => {
    if (selectedLapNumber === null) {
      if (trajectory.length !== 0) setTrajectory([]);
      if (lapTelemetry !== null) setLapTelemetry(null);
      return;
    }

    const cached = lapCache[selectedLapNumber];
    let cancelled = false;

    // Load trajectory if not cached
    if (cached?.trajectory) {
      if (isLoadingTrajectory) setLoadingTrajectory(false);
    } else {
      setLoadingTrajectory(true);
      getTrajectory(selectedLapNumber)
        .then((trajData) => {
          if (!cancelled) {
            setTrajectory(trajData);
            cacheLapData(selectedLapNumber, { trajectory: trajData });
          }
        })
        .catch((err) => {
          console.error('Failed to load trajectory', err);
          if (!cancelled) {
            if (trajectory.length !== 0) {
              setTrajectory([]);
            } else if (isLoadingTrajectory) {
              setLoadingTrajectory(false);
            }
          }
        });
    }

    // Load telemetry on-demand (only for selected lap)
    if (cached?.telemetry) {
      if (lapTelemetry !== cached.telemetry) {
        setLapTelemetry(cached.telemetry);
      }
      touchCache(selectedLapNumber);
    } else {
      getLapTelemetry(selectedLapNumber)
        .then((telemData) => {
          if (!cancelled) {
            setLapTelemetry(telemData);
            cacheLapData(selectedLapNumber, { telemetry: telemData });
          }
        })
        .catch((err) => {
          console.error('Failed to load lap telemetry', err);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    selectedLapNumber,
    setTrajectory,
    setLoadingTrajectory,
    lapCache,
    cacheLapData,
    touchCache,
  ]);

  // Calculate Delta
  const deltaValue = useMemo(() => {
    if (
      selectedLapNumber === null ||
      selectedLapNumber <= 1 ||
      !effectiveSample ||
      !effectiveCursorDistance
    )
      return null;

    // Find best lap (valid laps only)
    const validLaps = laps.filter((l) => l.isValid && l.lapTime !== null);
    if (validLaps.length === 0) return null;

    const bestLap = validLaps.reduce((best, curr) =>
      curr.lapTime! < best.lapTime! ? curr : best
    );

    // If we are comparing against best lap
    const bestLapData = lapCache[bestLap.lapNumber]?.telemetry;
    if (!bestLapData) return null;

    // Find sample in best lap at roughly the same distance
    const refSample = bestLapData.samples.find(
      (s) => Math.abs(s.lapDistance - effectiveCursorDistance) < 5
    );

    if (!refSample) return null;

    // Delta = Current Time - Reference Time
    return effectiveSample.timestamp - refSample.timestamp;
  }, [selectedLapNumber, effectiveSample, effectiveCursorDistance, laps, lapCache]);

  // Handle Open File from within Analysis
  const handleOpenFile = useCallback(async () => {
    if (isDialogOpen || isLoading) return;
    setDialogOpen(true);
    setLoading(true);
    setError(null);

    try {
      const result = await openAndLoadTelemetryFile();
      if (result) {
        setSession(result.session);
        setLaps(result.laps);
        setEnvelope(null); // Reset envelope for new track
        // Auto-select first lap so the track is visible immediately
        if (result.laps.length > 0) {
          setSelectedLap(result.laps[0].lapNumber);
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
    setDialogOpen,
    setLoading,
    setError,
    setSession,
    setLaps,
  ]);

  // Render Widget Helper
  const renderWidgetContent = useCallback(
    (widgetId: string, sample: TelemetrySample | null) => {
      const noData = <div className={styles.noData}>{t('hoverOverTrack')}</div>;

      switch (widgetId) {
        case 'dashboard':
          return sample ? (
            <DigitalDashboard
              speed={sample.speed}
              rpm={sample.rpm}
              gear={sample.gear}
              lapTime={sample.timestamp}
              compact={false}
            />
          ) : (
            noData
          );
        case 'steering':
          return sample ? (
            <SteeringWheel
              steering={sample.steering}
              maxAngle={540}
              compact={false}
            />
          ) : (
            noData
          );
        case 'pedals':
          return sample ? (
            <PedalInputs
              throttle={sample.throttle}
              brake={sample.brake}
              clutch={sample.clutch}
              compact={false}
            />
          ) : (
            noData
          );
        case 'tires':
          return sample ? (
            <TireMonitor
              tireTempLeft={sample.tireTempLeft}
              tireTempCenter={sample.tireTempCenter}
              tireTempRight={sample.tireTempRight}
              tirePressure={sample.tirePressure}
              tireWear={sample.tireWear}
              compact={false}
            />
          ) : (
            noData
          );
        case 'brakes':
          return sample ? (
            <BrakeMonitor brakeTemp={sample.brakeTemp} compact={false} />
          ) : (
            noData
          );
        default:
          return <div className={styles.comingSoon}>Coming Soon</div>;
      }
    },
    [t, lapTelemetry, cursorDistance, setCursorDistance]
  );

  // Filter widgets
  const telemetryWidgets = useMemo(
    () =>
      currentLayout.filter(
        (w) => w.i !== 'track' && w.i !== 'timeline' && w.i !== 'mini-chart' && w.visible
      ),
    [currentLayout]
  );

  const currentLapTimeDisplay = useMemo(() => {
    const activeLap = laps.find(
      (l) =>
        currentTime >= l.startTimestamp &&
        (l.endTimestamp ? currentTime < l.endTimestamp : true)
    );
    return activeLap ? currentTime - activeLap.startTimestamp : null;
  }, [currentTime, laps]);

  if (!session) return null;

  return (
    <div className={styles.analysisView}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            variant="ghost"
            icon={<RotateCcw size={18} />}
            onClick={onBack}
            title={t('backToFileList')}
          />
          <div className={styles.sessionInfo}>
            <h1 className={styles.trackName}>{session.trackName}</h1>
            <span className={styles.sessionMeta}>
              {session.carName} • {laps.length} {t('laps')}
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.presetSelector}>
            {(['beginner', 'advanced', 'pro'] as const).map((preset) => (
              <Button
                key={preset}
                variant={currentPreset === preset ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setPreset(preset)}
                className={styles.presetBtn}
              >
                {preset === 'beginner'
                  ? 'Basic'
                  : preset === 'advanced'
                    ? 'Adv'
                    : 'Pro'}
              </Button>
            ))}
          </div>

          <Button
            variant={showLayoutControls ? 'primary' : 'ghost'}
            icon={<Layout size={18} />}
            onClick={() => setShowLayoutControls(!showLayoutControls)}
          />

          <Button
            variant="ghost"
            icon={<FolderOpen size={18} />}
            onClick={handleOpenFile}
            disabled={isLoading}
          />
        </div>
      </header>

      {/* Layout Controls */}
      {showLayoutControls && (
        <div className={styles.controlsBar}>
          {Object.entries(WIDGET_META).map(([id, meta]) => {
            if (id === 'track' || id === 'mini-chart') return null;

            const widget = currentLayout.find((w) => w.i === id);
            const isVisible = widget?.visible ?? false;

            return (
              <Button
                key={id}
                variant={isVisible ? 'primary' : 'secondary'}
                size="small"
                icon={meta.icon}
                onClick={() => toggleWidgetVisibility(id)}
                className={styles.toggleBtn}
              >
                {meta.title}
              </Button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.content} ref={contentRef}>
        {/* Top Row: Track Map + Widgets */}
        <div className={styles.gridContainer}>
          {/* Left Panel: Track Map */}
          <div className={styles.trackSection}>
            <Panel
              title="Track Map"
              icon={<MapIcon size={16} />}
              className={styles.trackPanel}
              actions={
                selectedLapNumber !== null && (
                  <div className={styles.modeSwitch}>
                    <Button
                      variant={colorMode === 'speed' ? 'primary' : 'ghost'}
                      size="small"
                      onClick={() => setColorMode('speed')}
                    >
                      Speed
                    </Button>
                    <Button
                      variant={colorMode === 'throttle' ? 'primary' : 'ghost'}
                      size="small"
                      onClick={() => setColorMode('throttle')}
                    >
                      Inputs
                    </Button>
                  </div>
                )
              }
              footer={
                <div className={styles.timelineWrapper}>
                  <TimelineSlider
                    duration={totalDuration}
                    currentTime={currentTime}
                    currentTimeRef={currentTimeRef}
                    laps={laps}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    onSeek={seek}
                    onPlayPause={isPlaying ? pause : play}
                    onSpeedChange={setPlaybackSpeed}
                  />
                </div>
              }
            >
              <div className={styles.trackContainer} style={{ background: '#1a1a1a' }}>
                {isLoadingTrajectory ? (
                  <div className={styles.loadingPlaceholder}>
                    <span className={styles.spinner} />
                  </div>
                ) : trajectory.length > 0 ? (
                  <TrackCanvas
                    trajectory={trajectory}
                    envelope={envelope}
                    colorMode={colorMode}
                    showBoundaries={true}
                    showEnvelope={true}
                    cursorDistance={isPlaying ? null : effectiveCursorDistance}
                    cursorDistanceRef={cursorDistanceRef}
                    currentLapTime={currentLapTimeDisplay}
                    currentLapNumber={selectedLapNumber}
                    deltaTime={deltaValue}
                    onDistanceHover={setCursorDistance}
                  />
                ) : (
                  <div className={styles.placeholder}>
                    {t('selectLapToViewTrack')}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Resizer Handle */}
          <div
            className={`${styles.resizer} ${isResizing ? styles.resizing : ''}`}
            onMouseDown={startResizing}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            tabIndex={0}
          />

          {/* Right Panel: Widgets Grid */}
          <div className={styles.widgetsSection} style={{ width: panelWidth }}>
            <WidgetGrid
              layout={telemetryWidgets}
              onLayoutChange={(l) => updateLayout(currentPreset, l)}
              cols={2}
              rowHeight={70}
            >
              {telemetryWidgets.map((widget) => {
                const meta = WIDGET_META[widget.i];
                if (!meta) return null;
                return (
                  <div key={widget.i}>
                    <WidgetContainer
                      widgetId={widget.i}
                      title={meta.title}
                      accentColor={meta.accent}
                      onClose={() => toggleWidgetVisibility(widget.i)}
                      contentClassName={styles.widgetContent}
                    >
                      {renderWidgetContent(widget.i, effectiveSample)}
                    </WidgetContainer>
                  </div>
                );
              })}
            </WidgetGrid>
          </div>
        </div>

        {/* Chart Drawer Resizer (full width) */}
        <div
          className={`${styles.chartResizer} ${isVResizing ? styles.resizing : ''}`}
          onMouseDown={startVResizing}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize chart drawer"
          tabIndex={0}
        />

        {/* Chart Drawer (full width) */}
        <div
          className={styles.chartDrawer}
          style={{ height: chartDrawerHeight }}
        >
          {lapTelemetry ? (
            <TelemetryChart
              data={lapTelemetry.samples}
              cursorDistance={effectiveCursorDistance}
              onCursorChange={setCursorDistance}
              height="100%"
            />
          ) : (
            <div className={styles.noData}>{t('hoverOverTrack')}</div>
          )}
        </div>
      </div>
    </div>
  );
}