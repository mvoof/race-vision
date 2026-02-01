import { useLayoutStore } from '../../../stores/layoutStore';
import styles from './WidgetPalette.module.scss';

interface WidgetInfo {
  id: string;
  name: string;
  icon: string;
  category: 'core' | 'telemetry' | 'analysis';
}

const AVAILABLE_WIDGETS: WidgetInfo[] = [
  // Core widgets
  { id: 'track', name: 'Track Map', icon: '🗺️', category: 'core' },
  { id: 'dashboard', name: 'Dashboard', icon: '🎛️', category: 'core' },
  { id: 'timeline', name: 'Timeline', icon: '⏱️', category: 'core' },

  // Telemetry widgets
  { id: 'steering', name: 'Steering Wheel', icon: '🎮', category: 'telemetry' },
  { id: 'pedals', name: 'Pedal Inputs', icon: '🦶', category: 'telemetry' },
  { id: 'gforce', name: 'G-Force', icon: '⚡', category: 'telemetry' },
  { id: 'tires', name: 'Tire Monitor', icon: '🛞', category: 'telemetry' },
  { id: 'brakes', name: 'Brake Monitor', icon: '🔴', category: 'telemetry' },

  // Analysis widgets
  { id: 'sectors', name: 'Sector Times', icon: '🏁', category: 'analysis' },
  {
    id: 'lap-comparison',
    name: 'Lap Comparison',
    icon: '📊',
    category: 'analysis',
  },
  { id: 'mini-chart', name: 'Mini Chart', icon: '📈', category: 'analysis' },
];

const CATEGORY_NAMES = {
  core: 'Core',
  telemetry: 'Telemetry',
  analysis: 'Analysis',
};

export function WidgetPalette() {
  const { layouts, currentPreset, toggleWidgetVisibility } = useLayoutStore();
  const currentLayout = layouts[currentPreset];

  const getWidgetVisibility = (widgetId: string): boolean => {
    const widget = currentLayout.find((w) => w.i === widgetId);
    return widget?.visible ?? false;
  };

  const groupedWidgets = AVAILABLE_WIDGETS.reduce(
    (acc, widget) => {
      if (!acc[widget.category]) {
        acc[widget.category] = [];
      }
      acc[widget.category].push(widget);
      return acc;
    },
    {} as Record<string, WidgetInfo[]>
  );

  return (
    <div className={styles.widgetPalette}>
      <div className={styles.header}>
        <h3 className={styles.title}>Widgets</h3>
        <span className={styles.count}>
          {currentLayout.filter((w) => w.visible).length} /{' '}
          {currentLayout.length} visible
        </span>
      </div>

      <div className={styles.categories}>
        {Object.entries(groupedWidgets).map(([category, widgets]) => (
          <div key={category} className={styles.category}>
            <h4 className={styles.categoryTitle}>
              {CATEGORY_NAMES[category as keyof typeof CATEGORY_NAMES]}
            </h4>
            <div className={styles.widgetList}>
              {widgets.map((widget) => {
                const isVisible = getWidgetVisibility(widget.id);
                const isInLayout = currentLayout.some((w) => w.i === widget.id);

                return (
                  <button
                    key={widget.id}
                    className={`${styles.widgetItem} ${
                      isVisible ? styles.visible : styles.hidden
                    } ${!isInLayout ? styles.disabled : ''}`}
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    disabled={!isInLayout}
                    aria-label={`Toggle ${widget.name} widget`}
                  >
                    <div className={styles.widgetIcon}>{widget.icon}</div>
                    <span className={styles.widgetName}>{widget.name}</span>
                    <div className={styles.toggleIndicator}>
                      {isInLayout ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                        >
                          {isVisible ? (
                            <>
                              <path
                                d="M10 3C5.58 3 2 6.58 2 11C2 15.42 5.58 19 10 19C14.42 19 18 15.42 18 11C18 6.58 14.42 3 10 3ZM10 17C6.69 17 4 14.31 4 11C4 7.69 6.69 5 10 5C13.31 5 16 7.69 16 11C16 14.31 13.31 17 10 17Z"
                                fill="currentColor"
                              />
                              <circle
                                cx="10"
                                cy="11"
                                r="4"
                                fill="currentColor"
                              />
                            </>
                          ) : (
                            <path
                              d="M10 3C5.58 3 2 6.58 2 11C2 15.42 5.58 19 10 19C14.42 19 18 15.42 18 11C18 6.58 14.42 3 10 3ZM10 17C6.69 17 4 14.31 4 11C4 7.69 6.69 5 10 5C13.31 5 16 7.69 16 11C16 14.31 13.31 17 10 17Z"
                              fill="currentColor"
                            />
                          )}
                        </svg>
                      ) : (
                        <span className={styles.notAvailable}>N/A</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
