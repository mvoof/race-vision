import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type RefObject,
} from 'react';
import { Play, Pause, ChevronsRight } from 'lucide-react';
import type { Lap } from '../../../types';
import styles from './TimelineSlider.module.scss';

const SPEED_OPTIONS = [1, 1.5, 2, 3, 4];

interface TimelineSliderProps {
  duration: number; // Total session duration in seconds
  currentTime: number; // Current session time in seconds (React state — updates on pause/seek)
  /** High-frequency time ref updated at 60fps during playback.
   *  When provided + isPlaying, the timeline updates DOM directly via rAF. */
  currentTimeRef?: RefObject<number>;
  laps: Lap[];
  isPlaying: boolean;
  playbackSpeed: number;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimelineSlider({
  duration,
  currentTime,
  currentTimeRef,
  laps,
  isPlaying,
  playbackSpeed,
  onSeek,
  onPlayPause,
  onSpeedChange,
}: TimelineSliderProps) {
  const handleSpeedCycle = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    onSpeedChange(SPEED_OPTIONS[nextIndex]);
  }, [playbackSpeed, onSpeedChange]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSeek(parseFloat(e.target.value));
    },
    [onSeek]
  );

  const progress = useMemo(() => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Refs for direct DOM updates during playback (bypasses React)
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  // rAF loop: update time display + slider position directly during playback
  useEffect(() => {
    if (!isPlaying || !currentTimeRef) return;

    let rafId = 0;
    let prevFormatted = '';

    const update = () => {
      const t = currentTimeRef.current;
      const formatted = formatTime(t);

      // Only touch DOM when text actually changes (~1/sec)
      if (formatted !== prevFormatted) {
        prevFormatted = formatted;
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatted} / ${formatTime(duration)}`;
        }
      }

      // Update slider position + CSS custom property
      if (sliderRef.current) {
        sliderRef.current.value = String(t);
        const pct = duration > 0 ? (t / duration) * 100 : 0;
        sliderRef.current.style.setProperty('--progress', `${pct}%`);
      }

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentTimeRef, duration]);

  // Generate time labels at adaptive intervals
  const timeLabels = useMemo(() => {
    if (duration === 0) return [];
    // Adaptive interval: shorter sessions get denser labels
    const interval = duration < 300 ? 30 : duration < 1200 ? 60 : 120;
    const labels: { time: number; position: number }[] = [];
    for (let t = interval; t < duration; t += interval) {
      labels.push({ time: t, position: (t / duration) * 100 });
    }
    return labels;
  }, [duration]);

  // Warmup zone: from 0 to first lap boundary
  const warmupEnd = useMemo(() => {
    if (laps.length === 0 || duration === 0) return 0;
    return laps[0].startTimestamp;
  }, [laps, duration]);

  const warmupPct = duration > 0 ? (warmupEnd / duration) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${isPlaying ? styles.active : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className={`${styles.controlBtn} ${styles.speedBtn}`}
            onClick={handleSpeedCycle}
            title={`Speed: ${playbackSpeed}x`}
          >
            <ChevronsRight size={14} />
            <span className={styles.speedLabel}>{playbackSpeed}x</span>
          </button>
        </div>

        <div className={styles.timeDisplay} ref={timeDisplayRef}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div className={styles.sliderContainer}>
          <div className={styles.sliderTrack}>
            {warmupPct > 0 && (
              <div
                className={styles.warmupZone}
                style={{ width: `${warmupPct}%` }}
                title="Warmup lap"
              >
                <span className={styles.warmupLabel}>W</span>
              </div>
            )}
            <div className={styles.notches}>
              {laps.map((lap) => (
                <div
                  key={lap.id}
                  className={styles.notch}
                  style={{
                    left: `${(lap.startTimestamp / duration) * 100}%`,
                  }}
                  title={`Lap ${lap.lapNumber + 1}`}
                >
                  <span className={styles.notchLabel}>{lap.lapNumber + 1}</span>
                </div>
              ))}
            </div>

            <input
              ref={sliderRef}
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              onChange={handleSliderChange}
              className={styles.slider}
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            />
          </div>

          <div className={styles.timeLabels}>
            {timeLabels.map(({ time, position }) => (
              <span
                key={time}
                className={styles.timeLabel}
                style={{ left: `${position}%` }}
              >
                {formatTime(time)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimelineSlider;
