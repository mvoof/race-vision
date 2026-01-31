import { useLayoutStore, LayoutPreset } from '../../../stores/layoutStore';
import styles from './LayoutPresets.module.scss';

interface PresetInfo {
  id: LayoutPreset;
  name: string;
  description: string;
  widgetCount: number;
  icon: string;
}

const PRESETS: PresetInfo[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Large track view with essential widgets',
    widgetCount: 3,
    icon: '🎯',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Track plus 7 core analysis widgets',
    widgetCount: 7,
    icon: '📊',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Dense grid with 10+ widgets and charts',
    widgetCount: 10,
    icon: '🏎️',
  },
];

export function LayoutPresets() {
  const { currentPreset, setPreset, resetToPreset } = useLayoutStore();

  const handlePresetChange = (preset: LayoutPreset) => {
    if (preset === 'custom') return; // Can't select custom directly

    // Ask user if they want to reset or just switch
    if (currentPreset === preset) {
      // Reset to default preset layout
      resetToPreset(preset);
    } else {
      // Switch to preset
      setPreset(preset);
    }
  };

  return (
    <div className={styles.layoutPresets}>
      <div className={styles.header}>
        <h3 className={styles.title}>Layout Presets</h3>
        {currentPreset === 'custom' && (
          <span className={styles.badge}>Custom</span>
        )}
      </div>

      <div className={styles.presetGrid}>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`${styles.presetCard} ${
              currentPreset === preset.id ? styles.active : ''
            }`}
            onClick={() => handlePresetChange(preset.id)}
            aria-label={`Select ${preset.name} layout preset`}
          >
            <div className={styles.presetIcon}>{preset.icon}</div>
            <div className={styles.presetContent}>
              <h4 className={styles.presetName}>{preset.name}</h4>
              <p className={styles.presetDescription}>{preset.description}</p>
              <div className={styles.presetMeta}>
                <span className={styles.widgetCount}>
                  {preset.widgetCount} widgets
                </span>
              </div>
            </div>
            {currentPreset === preset.id && (
              <div className={styles.activeIndicator}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7 10L9 12L13 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {currentPreset !== 'custom' && (
        <button
          className={styles.resetButton}
          onClick={() => resetToPreset(currentPreset)}
          aria-label="Reset current preset to default"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M13.65 2.35C12.2 0.9 10.21 0 8 0C3.58 0 0.01 3.58 0.01 8C0.01 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.73 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2.01 11.31 2.01 8C2.01 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z"
              fill="currentColor"
            />
          </svg>
          Reset to Default
        </button>
      )}
    </div>
  );
}
