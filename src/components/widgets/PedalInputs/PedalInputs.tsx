import styles from './PedalInputs.module.scss';

interface PedalInputsProps {
  throttle: number; // 0-100%
  brake: number; // 0-100%
  clutch: number; // 0-100%
  compact?: boolean;
}

/**
 * Pedal component - renders a single vertical bar
 */
function Pedal({
  label,
  value,
  color,
  compact,
}: {
  label: string;
  value: number;
  color: string;
  compact?: boolean;
}) {
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div className={styles.pedal}>
      <div className={styles.pedalLabel}>{label}</div>
      <div className={styles.pedalBar}>
        <div
          className={styles.pedalFill}
          style={{
            height: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className={styles.pedalValue}>{Math.round(percentage)}%</div>
    </div>
  );
}

export function PedalInputs({
  throttle,
  brake,
  clutch,
  compact = false,
}: PedalInputsProps) {
  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h3 className={styles.title}>Pedals</h3>
      <div className={styles.pedalsGrid}>
        <Pedal label="T" value={throttle} color="#00ff88" compact={compact} />
        <Pedal label="B" value={brake} color="#ff4444" compact={compact} />
        <Pedal label="C" value={clutch} color="#4499ff" compact={compact} />
      </div>
    </div>
  );
}

export default PedalInputs;
