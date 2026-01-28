import React, { useCallback, useMemo } from 'react';
import type { Lap } from '../../../types';
import styles from './TimelineSlider.module.scss';

interface TimelineSliderProps {
  // Current lap data
  currentLap: Lap | null;
  currentDistance: number; // meters
  maxDistance: number; // total lap distance in meters

  // Reference lap (optional for comparison)
  referenceLap?: Lap | null;

  // Callbacks
  onDistanceChange: (distance: number) => void;

  // Channel toggles
  visibleChannels?: Set<string>;
  onChannelToggle?: (channel: string) => void;
}

const AVAILABLE_CHANNELS = [
  { id: 'speed', label: 'Speed', color: '#00d9ff' },
  { id: 'throttle', label: 'Throttle', color: '#2ed573' },
  { id: 'brake', label: 'Brake', color: '#ff4757' },
  { id: 'gear', label: 'Gear', color: '#ffd700' },
  { id: 'rpm', label: 'RPM', color: '#ff9f43' },
  { id: 'fuel', label: 'Fuel', color: '#a29bfe' },
];

function formatLapTime(seconds: number | null): string {
  if (seconds === null) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

export function TimelineSlider({
  currentLap,
  currentDistance,
  maxDistance,
  referenceLap,
  onDistanceChange,
  visibleChannels = new Set(['speed', 'throttle', 'brake']),
  onChannelToggle,
}: TimelineSliderProps) {
  // Calculate current lap progress (0-1)
  const currentProgress = useMemo(() => {
    if (maxDistance === 0) return 0;
    return Math.max(0, Math.min(1, currentDistance / maxDistance));
  }, [currentDistance, maxDistance]);

  // Calculate time at current position (estimate based on progress)
  const currentTime = useMemo(() => {
    if (!currentLap?.lapTime) return null;
    return currentLap.lapTime * currentProgress;
  }, [currentLap, currentProgress]);

  // Calculate delta (simplified - would need interpolation for accuracy)
  const delta = useMemo(() => {
    if (!currentTime || !referenceLap?.lapTime) return null;
    const referenceTime = referenceLap.lapTime * currentProgress;
    return currentTime - referenceTime;
  }, [currentTime, referenceLap, currentProgress]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const progress = parseFloat(e.target.value);
      const distance = progress * maxDistance;
      onDistanceChange(distance);
    },
    [maxDistance, onDistanceChange]
  );

  // Handle channel toggle
  const handleChannelClick = useCallback(
    (channelId: string) => {
      if (onChannelToggle) {
        onChannelToggle(channelId);
      }
    },
    [onChannelToggle]
  );

  // Sector times (from currentLap)
  const sectors = useMemo(() => {
    if (!currentLap) return [];
    return [
      {
        number: 1,
        time: currentLap.sector1Time,
        delta: referenceLap?.sector1Time
          ? (currentLap.sector1Time ?? 0) - (referenceLap.sector1Time ?? 0)
          : null,
      },
      {
        number: 2,
        time: currentLap.sector2Time,
        delta: referenceLap?.sector2Time
          ? (currentLap.sector2Time ?? 0) - (referenceLap.sector2Time ?? 0)
          : null,
      },
      {
        number: 3,
        time: currentLap.sector3Time,
        delta: referenceLap?.sector3Time
          ? (currentLap.sector3Time ?? 0) - (referenceLap.sector3Time ?? 0)
          : null,
      },
    ];
  }, [currentLap, referenceLap]);

  if (!currentLap) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Top section: Lap times and delta */}
      <div className={styles.header}>
        <div className={styles.lapTime}>
          <div className={styles.lapLabel}>MY LAP</div>
          <div className={styles.lapValue}>{formatLapTime(currentTime)}</div>
        </div>

        {delta !== null && (
          <div className={styles.delta}>
            <div
              className={`${styles.deltaValue} ${delta >= 0 ? styles.positive : styles.negative}`}
            >
              {formatDelta(delta)}
            </div>
          </div>
        )}

        {referenceLap && (
          <div className={styles.lapTime}>
            <div className={styles.lapLabel}>REFERENCE</div>
            <div className={styles.lapValue}>
              {formatLapTime(referenceLap.lapTime)}
            </div>
          </div>
        )}
      </div>

      {/* Progress bars */}
      <div className={styles.progressBars}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${currentProgress * 100}%` }}
          />
        </div>
        {referenceLap && (
          <div className={`${styles.progressBar} ${styles.reference}`}>
            <div
              className={styles.progressFill}
              style={{ width: `${currentProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Slider */}
      <div className={styles.sliderContainer}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={currentProgress}
          onChange={handleSliderChange}
          className={styles.slider}
        />

        {/* Sector markers */}
        <div className={styles.sectorMarkers}>
          {sectors.map((sector) => (
            <div
              key={sector.number}
              className={styles.sectorMarker}
              style={{ left: `${(sector.number / 3) * 100}%` }}
            >
              <div className={styles.sectorBadge}>
                <div className={styles.sectorNumber}>S{sector.number}</div>
                {sector.delta !== null && (
                  <div
                    className={`${styles.sectorDelta} ${
                      sector.delta >= 0 ? styles.positive : styles.negative
                    }`}
                  >
                    {formatDelta(sector.delta)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel toggles */}
      {onChannelToggle && (
        <div className={styles.channelToggles}>
          {AVAILABLE_CHANNELS.map((channel) => (
            <button
              key={channel.id}
              className={`${styles.channelToggle} ${
                visibleChannels.has(channel.id) ? styles.active : ''
              }`}
              onClick={() => handleChannelClick(channel.id)}
              style={
                {
                  '--channel-color': channel.color,
                } as React.CSSProperties
              }
            >
              <div
                className={styles.channelIndicator}
                style={{ backgroundColor: channel.color }}
              />
              <span>{channel.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TimelineSlider;
