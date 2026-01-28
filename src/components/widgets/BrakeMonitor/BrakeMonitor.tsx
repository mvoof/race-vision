import { useMemo } from 'react';
import type { WheelData } from '../../../types';
import styles from './BrakeMonitor.module.scss';

interface BrakeMonitorProps {
  // Brake temperatures in °C
  brakeTemp: WheelData;
  // Optional compact mode
  compact?: boolean;
}

/**
 * Get color for brake temperature
 * Cold (<200°C) = blue, Normal (200-400°C) = green/yellow, Hot (>400°C) = red/orange
 */
function getBrakeTempColor(temp: number): string {
  if (temp < 200) {
    // Cold - blue to cyan
    const normalized = Math.max(0, temp / 200);
    return `hsl(${200 + normalized * 20}, 80%, 50%)`;
  } else if (temp < 400) {
    // Normal - green to yellow
    const normalized = (temp - 200) / 200;
    return `hsl(${120 - normalized * 60}, 80%, 50%)`;
  } else if (temp < 600) {
    // Hot - yellow to orange
    const normalized = (temp - 400) / 200;
    return `hsl(${60 - normalized * 30}, 90%, 55%)`;
  } else {
    // Very hot - orange to red
    const normalized = Math.min(1, (temp - 600) / 200);
    return `hsl(${30 - normalized * 30}, 95%, 50%)`;
  }
}

/**
 * Brake disc component - renders a single brake disc
 */
function BrakeDisc({
  label,
  temp,
  compact,
}: {
  label: string;
  temp: number;
  compact?: boolean;
}) {
  return (
    <div className={styles.brake}>
      <div className={styles.brakeLabel}>{label}</div>

      {/* SVG brake disc visualization */}
      <svg
        className={styles.brakeSvg}
        viewBox="0 0 80 80"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Disc background */}
        <circle
          cx="40"
          cy="40"
          r="32"
          fill={getBrakeTempColor(temp)}
          opacity="0.9"
        />

        {/* Disc outline */}
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke="#333"
          strokeWidth="2"
        />

        {/* Center hub */}
        <circle
          cx="40"
          cy="40"
          r="12"
          fill="#1a1a2e"
          stroke="#333"
          strokeWidth="1.5"
        />

        {/* Ventilation holes */}
        <circle cx="40" cy="20" r="4" fill="#1a1a2e" />
        <circle cx="52" cy="28" r="4" fill="#1a1a2e" />
        <circle cx="60" cy="40" r="4" fill="#1a1a2e" />
        <circle cx="52" cy="52" r="4" fill="#1a1a2e" />
        <circle cx="40" cy="60" r="4" fill="#1a1a2e" />
        <circle cx="28" cy="52" r="4" fill="#1a1a2e" />
        <circle cx="20" cy="40" r="4" fill="#1a1a2e" />
        <circle cx="28" cy="28" r="4" fill="#1a1a2e" />

        {/* Disc grooves */}
        <circle
          cx="40"
          cy="40"
          r="24"
          fill="none"
          stroke="#333"
          strokeWidth="0.5"
          opacity="0.5"
        />
        <circle
          cx="40"
          cy="40"
          r="16"
          fill="none"
          stroke="#333"
          strokeWidth="0.5"
          opacity="0.5"
        />
      </svg>

      {/* Brake data */}
      {!compact && (
        <div className={styles.brakeData}>
          <div className={styles.brakeDataRow}>
            <span className={styles.brakeDataLabel}>Temp:</span>
            <span className={styles.brakeDataValue}>{temp.toFixed(0)}°C</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrakeMonitor({
  brakeTemp,
  compact = false,
}: BrakeMonitorProps) {
  // Wheel order: [FL, FR, RL, RR]
  const brakes = useMemo(
    () => [
      { label: 'FL', temp: brakeTemp[0] },
      { label: 'FR', temp: brakeTemp[1] },
      { label: 'RL', temp: brakeTemp[2] },
      { label: 'RR', temp: brakeTemp[3] },
    ],
    [brakeTemp]
  );

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h3 className={styles.title}>Brakes</h3>
      <div className={styles.grid}>
        <BrakeDisc {...brakes[0]} compact={compact} />
        <BrakeDisc {...brakes[1]} compact={compact} />
        <BrakeDisc {...brakes[2]} compact={compact} />
        <BrakeDisc {...brakes[3]} compact={compact} />
      </div>
    </div>
  );
}

export default BrakeMonitor;
