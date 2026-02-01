import styles from './SteeringWheel.module.scss';

interface SteeringWheelProps {
  steering: number; // degrees (-max to +max, e.g., -540 to +540)
  maxAngle?: number; // max steering angle (default 540)
  compact?: boolean;
}

export function SteeringWheel({
  steering,
  maxAngle = 540,
  compact = false,
}: SteeringWheelProps) {
  // Normalize steering to -1 to +1
  const normalized = Math.max(-1, Math.min(1, steering / maxAngle));

  // Convert to rotation angle for display
  const rotation = normalized * maxAngle;

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h3 className={styles.title}>Steering</h3>

      {/* SVG steering wheel */}
      <svg
        className={styles.wheelSvg}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={`rotate(${rotation} 100 100)`}>
          {/* Wheel rim */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="rgba(255, 255, 255, 0.8)"
            strokeWidth="8"
          />

          {/* Wheel spokes */}
          <line
            x1="100"
            y1="30"
            x2="100"
            y2="170"
            stroke="rgba(255, 255, 255, 0.8)"
            strokeWidth="6"
          />
          <line
            x1="30"
            y1="100"
            x2="170"
            y2="100"
            stroke="rgba(255, 255, 255, 0.8)"
            strokeWidth="6"
          />

          {/* Center hub */}
          <circle cx="100" cy="100" r="20" fill="rgba(255, 255, 255, 0.9)" />

          {/* Top marker (indicates forward direction) */}
          <circle cx="100" cy="30" r="8" fill="#00ff88" />
        </g>
      </svg>

      {/* Angle display */}
      <div className={styles.angleDisplay}>
        <span className={styles.angleValue}>
          {steering > 0 && '+'}
          {Math.round(steering)}°
        </span>
      </div>
    </div>
  );
}

export default SteeringWheel;
