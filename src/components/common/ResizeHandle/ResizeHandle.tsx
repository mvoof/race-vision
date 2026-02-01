import React from 'react';
import styles from './ResizeHandle.module.scss';

export type ResizeHandleVariant = 'corner' | 'bar';

export interface ResizeHandleProps {
  /** Visual variant: 'corner' for 2D resize, 'bar' for vertical resize */
  variant: ResizeHandleVariant;
  /** Whether currently resizing */
  isResizing?: boolean;
  /** Mouse down handler */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Accessible label */
  ariaLabel?: string;
  /** Optional additional className */
  className?: string;
}

/**
 * Resize handle component with two visual variants:
 * - corner: L-shaped indicator for 2D resize (nwse-resize cursor)
 * - bar: Horizontal line for vertical resize (ns-resize cursor)
 * 
 * Both positioned at bottom-right corner.
 */
export function ResizeHandle({
  variant,
  isResizing = false,
  onMouseDown,
  ariaLabel = 'Resize',
  className = '',
}: ResizeHandleProps) {
  const variantClass = variant === 'bar' ? styles.bar : '';
  const resizingClass = isResizing ? styles.resizing : '';

  return (
    <div
      className={`${styles.resizeHandle} ${variantClass} ${resizingClass} ${className}`}
      onMouseDown={onMouseDown}
      role="separator"
      aria-label={ariaLabel}
      tabIndex={0}
    />
  );
}
