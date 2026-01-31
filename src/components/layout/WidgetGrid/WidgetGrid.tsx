import { ReactNode, useRef, useState, useEffect } from 'react';
import { GridLayout, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import type { WidgetLayout } from '../../../stores/layoutStore';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import styles from './WidgetGrid.module.scss';

export interface WidgetGridProps {
  layout: WidgetLayout[];
  onLayoutChange: (layout: WidgetLayout[]) => void;
  children: ReactNode;
  isDraggable?: boolean;
  isResizable?: boolean;
  cols?: number;
  rowHeight?: number;
  className?: string;
}

export function WidgetGrid({
  layout,
  onLayoutChange,
  children,
  isDraggable = true,
  isResizable = true,
  cols = 12,
  rowHeight = 80,
  className,
}: WidgetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });

    observer.observe(el);
    if (el.clientWidth > 0) setWidth(el.clientWidth);

    return () => observer.disconnect();
  }, []);

  const visibleLayout = layout.filter((widget) => widget.visible);

  const handleLayoutChange = (newLayout: Layout) => {
    const mergedLayout = (newLayout as unknown as WidgetLayout[]).map(
      (item) => {
        const originalWidget = layout.find((w) => w.i === item.i);
        return {
          ...item,
          visible: originalWidget?.visible ?? true,
        } as WidgetLayout;
      }
    );
    onLayoutChange(mergedLayout);
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.widgetGrid} ${className || ''}`}
    >
      {width > 0 && (
        <GridLayout
          className={styles.gridLayout}
          layout={visibleLayout}
          onLayoutChange={handleLayoutChange}
          width={width}
          autoSize={true}
          compactor={verticalCompactor}
          gridConfig={{
            cols,
            rowHeight,
            margin: [12, 12] as const,
            containerPadding: [0, 0] as const,
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: isDraggable,
            handle: '.widget-drag-handle',
            bounded: false,
            threshold: 3,
          }}
          resizeConfig={{
            enabled: isResizable,
            handles: ['se'],
          }}
        >
          {children}
        </GridLayout>
      )}
    </div>
  );
}
