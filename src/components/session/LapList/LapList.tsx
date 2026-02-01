
import type { Lap } from '../../../types';
import styles from './LapList.module.scss';

interface LapListProps {
  laps: Lap[];
  selectedLapNumber: number | null;
  onLapSelect: (lapNumber: number) => void;
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

export function LapList({ laps, selectedLapNumber, onLapSelect }: LapListProps) {
  return (
    <div className={styles.lapList}>
      {laps.map((lap) => {
        const isSelected = selectedLapNumber === lap.lapNumber;
        const hasDelta = lap.lapNumber > 0 && lap.deltaToSessionBest !== null && lap.deltaToSessionBest !== 0;

        return (
          <div
            key={lap.id}
            className={`${styles.lapItem} ${lap.isPersonalBest ? styles.bestLap : ''} ${isSelected ? styles.selected : ''}`}
            onClick={() => onLapSelect(lap.lapNumber)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLapSelect(lap.lapNumber);
              }
            }}
          >
            <div className={styles.lapMainInfo}>
              <span className={styles.lapNumber}>{lap.lapNumber + 1}</span>
              <span className={styles.lapTime}>
                {lap.lapTime ? formatLapTime(lap.lapTime) : '--:--.---'}
              </span>
            </div>

            {hasDelta && (
              <span
                className={`${styles.delta} ${lap.deltaToSessionBest! > 0 ? styles.slower : styles.faster}`}
              >
                {formatDelta(lap.deltaToSessionBest!)}
              </span>
            )}
            
            {lap.isPersonalBest && !hasDelta && (
              <span className={styles.bestLabel}>BEST</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
