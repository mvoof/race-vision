import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Widget layout definition (mirrors react-grid-layout Layout + visibility)
export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  visible: boolean;
}

// Preset type
export type LayoutPreset = 'beginner' | 'advanced' | 'pro' | 'custom';

// Layout store state
interface LayoutState {
  // Current preset
  currentPreset: LayoutPreset;

  // Widget Panel Width
  panelWidth: number;

  // Chart drawer height (below track map)
  chartDrawerHeight: number;

  // Layouts for each preset
  layouts: Record<LayoutPreset, WidgetLayout[]>;

  // Actions
  setPreset: (preset: LayoutPreset) => void;
  setPanelWidth: (width: number) => void;
  setChartDrawerHeight: (height: number) => void;
  updateLayout: (preset: LayoutPreset, layouts: WidgetLayout[]) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  resetToPreset: (preset: LayoutPreset) => void;
  saveCustomLayout: (layouts: WidgetLayout[]) => void;
}

// Default preset layouts (Designed for 2-column grid)
const defaultPresets: Record<
  Exclude<LayoutPreset, 'custom'>,
  WidgetLayout[]
> = {
  beginner: [
    { i: 'dashboard', x: 0, y: 0, w: 2, h: 4, visible: true, minW: 2, minH: 3 },
    { i: 'tires', x: 0, y: 4, w: 2, h: 4, visible: true, minW: 2, minH: 3 },
  ],
  advanced: [
    { i: 'dashboard', x: 0, y: 0, w: 2, h: 3, visible: true, minW: 2, minH: 2 },
    { i: 'steering', x: 0, y: 3, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'pedals', x: 1, y: 3, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'gforce', x: 0, y: 6, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'tires', x: 1, y: 6, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'brakes', x: 0, y: 9, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'lap-comparison', x: 1, y: 9, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
  ],
  pro: [
    { i: 'dashboard', x: 0, y: 0, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'steering', x: 1, y: 0, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'pedals', x: 0, y: 3, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'gforce', x: 1, y: 3, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'sectors', x: 0, y: 6, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    {
      i: 'lap-comparison',
      x: 1,
      y: 6,
      w: 1,
      h: 3,
      visible: true,
      minW: 1,
      minH: 2,
    },
    { i: 'tires', x: 0, y: 9, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
    { i: 'brakes', x: 1, y: 9, w: 1, h: 3, visible: true, minW: 1, minH: 2 },
  ],
};

// Create the store
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      currentPreset: 'advanced',
      panelWidth: 480,
      chartDrawerHeight: 200,
      layouts: {
        beginner: [...defaultPresets.beginner],
        advanced: [...defaultPresets.advanced],
        pro: [...defaultPresets.pro],
        custom: [...defaultPresets.advanced],
      },

      setPreset: (preset) => {
        set({ currentPreset: preset });
      },

      setPanelWidth: (width) => {
        set({ panelWidth: width });
      },

      setChartDrawerHeight: (height) => {
        set({ chartDrawerHeight: height });
      },

      updateLayout: (preset, layouts) => {
        set((state) => {
          const existingLayout = state.layouts[preset];
          const newLayoutMap = new Map(layouts.map((l) => [l.i, l]));

          // Merge existing visible/invisible widgets with new positions
          const mergedLayout = existingLayout.map((widget) => {
            const updated = newLayoutMap.get(widget.i);
            if (updated) {
              return { ...widget, ...updated };
            }
            return widget;
          });

          return {
            layouts: {
              ...state.layouts,
              [preset]: mergedLayout,
            },
          };
        });
      },

      toggleWidgetVisibility: (widgetId) => {
        const { currentPreset, layouts } = get();
        const currentLayout = layouts[currentPreset];
        const existingWidget = currentLayout.find((w) => w.i === widgetId);

        let updatedLayout;

        if (existingWidget) {
          updatedLayout = currentLayout.map((widget) =>
            widget.i === widgetId
              ? { ...widget, visible: !widget.visible }
              : widget
          );
        } else {
          // Add new widget
          updatedLayout = [
            ...currentLayout,
            {
              i: widgetId,
              x: 0,
              y: 100, // Bottom
              w: 2, // Full width default
              h: 3,
              visible: true,
              minW: 1,
              minH: 2,
            },
          ];
        }

        set((state) => ({
          layouts: {
            ...state.layouts,
            [currentPreset]: updatedLayout,
          },
        }));
      },

      resetToPreset: (preset) => {
        if (preset === 'custom') return; // Can't reset custom

        set((state) => ({
          layouts: {
            ...state.layouts,
            [preset]: [...defaultPresets[preset]],
          },
        }));
      },

      saveCustomLayout: (layouts) => {
        set((state) => ({
          currentPreset: 'custom',
          layouts: {
            ...state.layouts,
            custom: layouts,
          },
        }));
      },
    }),
    {
      name: 'apex-layout-storage',
      version: 1,
    }
  )
);
