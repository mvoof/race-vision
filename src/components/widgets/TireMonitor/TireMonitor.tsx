import { useMemo } from 'react';
import type { WheelData } from '../../../types';
import styles from './TireMonitor.module.scss';

interface TireMonitorProps {
  // Temperatures for each tire (left, center, right)
  tireTempLeft: WheelData;
  tireTempCenter: WheelData;
  tireTempRight: WheelData;
  // Pressure in kPa
  tirePressure: WheelData;
  // Wear percentage (0-100, where 100 is new)
  tireWear: WheelData;
  // Optional compact mode
  compact?: boolean;
}

/**
 * Get color for temperature value
 * Cold (<60°C) = blue, Normal (60-90°C) = green/yellow, Hot (>90°C) = red
 */
function getTempColor(temp: number): string {
  if (temp < 60) {
    // Cold - blue to cyan
    const normalized = Math.max(0, temp / 60);
    return `hsl(${200 + normalized * 20}, 80%, 50%)`;
  } else if (temp < 90) {
    // Normal - green to yellow
    const normalized = (temp - 60) / 30;
    return `hsl(${120 - normalized * 60}, 80%, 50%)`;
  } else {
    // Hot - yellow to red
    const normalized = Math.min(1, (temp - 90) / 30);
    return `hsl(${60 - normalized * 60}, 80%, 50%)`;
  }
}

/**
 * Get average temperature for a tire
 */
function getAvgTemp(left: number, center: number, right: number): number {
  return (left + center + right) / 3;
}

/**
 * Tire component - renders a single tire with 3 temperature zones
 */
function Tire({
  label,
  tempLeft,
  tempCenter,
  tempRight,
  pressure,
  wear,
  compact,
}: {
  label: string;
  tempLeft: number;
  tempCenter: number;
  tempRight: number;
  pressure: number;
  wear: number;
  compact?: boolean;
}) {
  const avgTemp = getAvgTemp(tempLeft, tempCenter, tempRight);

  return (
    <div className={styles.tire}>
      <div className={styles.tireLabel}>{label}</div>

      {/* SVG tire visualization with 3 temperature zones */}
      <svg
        className={styles.tireSvg}
        viewBox="0 0 60 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left zone */}
        <rect
          x="5"
          y="10"
          width="15"
          height="80"
          rx="2"
          fill={getTempColor(tempLeft)}
          opacity="0.9"
        />

        {/* Center zone */}
        <rect
          x="22"
          y="10"
          width="16"
          height="80"
          rx="2"
          fill={getTempColor(tempCenter)}
          opacity="0.9"
        />

        {/* Right zone */}
        <rect
          x="40"
          y="10"
          width="15"
          height="80"
          rx="2"
          fill={getTempColor(tempRight)}
          opacity="0.9"
        />

        {/* Tire outline */}
        <rect
          x="5"
          y="10"
          width="50"
          height="80"
          rx="2"
          fill="none"
          stroke="#333"
          strokeWidth="2"
        />

        {/* Tire grooves */}
        <line x1="5" y1="30" x2="55" y2="30" stroke="#333" strokeWidth="1" />
        <line x1="5" y1="50" x2="55" y2="50" stroke="#333" strokeWidth="1" />
        <line x1="5" y1="70" x2="55" y2="70" stroke="#333" strokeWidth="1" />
      </svg>

      {/* Tire data */}
      {!compact && (
        <div className={styles.tireData}>
          <div className={styles.tireDataRow}>
            <span className={styles.tireDataLabel}>Temp:</span>
            <span className={styles.tireDataValue}>{avgTemp.toFixed(0)}°C</span>
          </div>
          <div className={styles.tireDataRow}>
            <span className={styles.tireDataLabel}>Press:</span>
            <span className={styles.tireDataValue}>
              {pressure.toFixed(0)} kPa
            </span>
          </div>
          <div className={styles.tireDataRow}>
            <span className={styles.tireDataLabel}>Wear:</span>
            <span className={styles.tireDataValue}>{wear.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function TireMonitor({
  tireTempLeft,
  tireTempCenter,
  tireTempRight,
  tirePressure,
  tireWear,
  compact = false,
}: TireMonitorProps) {
  // Wheel order: [FL, FR, RL, RR]
  const tires = useMemo(
    () => [
      {
        label: 'FL',
        tempLeft: tireTempLeft[0],
        tempCenter: tireTempCenter[0],
        tempRight: tireTempRight[0],
        pressure: tirePressure[0],
        wear: tireWear[0],
      },
      {
        label: 'FR',
        tempLeft: tireTempLeft[1],
        tempCenter: tireTempCenter[1],
        tempRight: tireTempRight[1],
        pressure: tirePressure[1],
        wear: tireWear[1],
      },
      {
        label: 'RL',
        tempLeft: tireTempLeft[2],
        tempCenter: tireTempCenter[2],
        tempRight: tireTempRight[2],
        pressure: tirePressure[2],
        wear: tireWear[2],
      },
      {
        label: 'RR',
        tempLeft: tireTempLeft[3],
        tempCenter: tireTempCenter[3],
        tempRight: tireTempRight[3],
        pressure: tirePressure[3],
        wear: tireWear[3],
      },
    ],
    [tireTempLeft, tireTempCenter, tireTempRight, tirePressure, tireWear]
  );

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h3 className={styles.title}>Tires</h3>
      <div className={styles.grid}>
        <Tire {...tires[0]} compact={compact} />
        <Tire {...tires[1]} compact={compact} />
        <Tire {...tires[2]} compact={compact} />
        <Tire {...tires[3]} compact={compact} />
      </div>
    </div>
  );
}

export default TireMonitor;
