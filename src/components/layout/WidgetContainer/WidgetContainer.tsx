import React, { ReactNode } from 'react';
import styles from './WidgetContainer.module.scss';

export interface WidgetContainerProps {
  widgetId: string;
  title: string;
  icon?: ReactNode;
  accentColor?: string; // F1-style colored bar on the left
  onMinimize?: () => void;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function WidgetContainer({
  widgetId,
  title,
  icon,
  accentColor = '#3b82f6', // default to accent-primary
  onMinimize,
  onClose,
  children,
  className,
  contentClassName,
}: WidgetContainerProps) {
  return (
    <div
      className={`${styles.widgetContainer} ${className || ''}`}
      style={{ '--accent-color': accentColor } as React.CSSProperties}
      data-widget-id={widgetId}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`${styles.dragHandle} widget-drag-handle`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="4" cy="4" r="1.5" fill="currentColor" />
              <circle cx="4" cy="8" r="1.5" fill="currentColor" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              <circle cx="8" cy="4" r="1.5" fill="currentColor" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="8" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="4" r="1.5" fill="currentColor" />
              <circle cx="12" cy="8" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          {icon && <div className={styles.icon}>{icon}</div>}
          <h3 className={styles.title}>{title}</h3>
        </div>

        <div className={styles.headerRight}>
          {onMinimize && (
            <button
              className={styles.controlButton}
              onClick={onMinimize}
              title="Minimize"
              aria-label="Minimize widget"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 7H12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              className={styles.controlButton}
              onClick={onClose}
              title="Close"
              aria-label="Close widget"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 2L12 12M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.content} ${contentClassName || ''}`}>
        {children}
      </div>
    </div>
  );
}
