import styles from './DigitalDashboard.module.scss';

interface DigitalDashboardProps {
  speed: number; // km/h
  rpm: number;
  gear: number; // -1 = R, 0 = N, 1-8 = gears
  lapTime?: number; // seconds from lap start
  compact?: boolean;
}

/**
 * Format lap time as MM:SS.mmm
 */
function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Get gear display string
 */
function getGearDisplay(gear: number): string {
  if (gear === -1) return 'R';
  if (gear === 0) return 'N';
  return gear.toString();
}

/**
 * Get RPM percentage for gauge (0-1)
 */
function getRpmPercentage(rpm: number, maxRpm: number = 8000): number {
  return Math.min(1, Math.max(0, rpm / maxRpm));
}

/**
 * Get color for RPM based on percentage
 */
function getRpmColor(percentage: number): string {
  if (percentage < 0.7) {
    return '#00ff88'; // Green
  } else if (percentage < 0.85) {
    return '#ffff00'; // Yellow
  } else if (percentage < 0.95) {
    return '#ff9900'; // Orange
  } else {
    return '#ff0000'; // Red
  }
}

export function DigitalDashboard({
  speed,
  rpm,
  gear,
  lapTime,
  compact = false,
}: DigitalDashboardProps) {
  const rpmPercentage = getRpmPercentage(rpm);
  const rpmColor = getRpmColor(rpmPercentage);

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h3 className={styles.title}>Dashboard</h3>

      {/* Speed */}
      <div className={styles.speed}>
        <div className={styles.speedValue}>{Math.round(speed)}</div>
        <div className={styles.speedUnit}>km/h</div>
      </div>

      {/* Gear */}
      <div className={styles.gear}>
        <div className={styles.gearValue}>{getGearDisplay(gear)}</div>
        <div className={styles.gearLabel}>Gear</div>
      </div>

      {/* RPM gauge */}
      <div className={styles.rpmGauge}>
        <div className={styles.rpmLabel}>RPM</div>
        <div className={styles.rpmBar}>
          <div
            className={styles.rpmFill}
            style={{
              width: `${rpmPercentage * 100}%`,
              backgroundColor: rpmColor,
            }}
          />
        </div>
        <div className={styles.rpmValue}>{Math.round(rpm)}</div>
      </div>

      {/* Lap time */}
      {lapTime !== undefined && (
        <div className={styles.lapTime}>
          <div className={styles.lapTimeLabel}>Lap Time</div>
          <div className={styles.lapTimeValue}>{formatLapTime(lapTime)}</div>
        </div>
      )}
    </div>
  );
}

export default DigitalDashboard;
