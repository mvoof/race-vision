import { ReactNode } from 'react';
import styles from './Panel.module.scss';

export interface PanelProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  scrollable?: boolean;
  noBorder?: boolean;
  noBackground?: boolean;
}

export function Panel({
  title,
  icon,
  children,
  actions,
  footer,
  className = '',
  contentClassName = '',
  scrollable = false,
  noBorder = false,
  noBackground = false,
}: PanelProps) {
  const panelClasses = [
    styles.panel,
    noBorder ? styles.noBorder : '',
    noBackground ? styles.noBackground : '',
    className,
  ].join(' ');

  const contentClasses = [
    styles.content,
    scrollable ? styles.scrollable : '',
    contentClassName,
  ].join(' ');

  return (
    <div className={panelClasses}>
      {(title || icon || actions) && (
        <div className={styles.header}>
          <div className={styles.title}>
            {icon && <span className={styles.titleIcon}>{icon}</span>}
            {title && <span>{title}</span>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={contentClasses}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
