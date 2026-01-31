import { ReactNode } from 'react';
import styles from './AppLayout.module.scss';

export interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, children, className }: AppLayoutProps) {
  return (
    <div className={`${styles.appLayout} ${className || ''}`}>
      {sidebar}
      <main className={styles.pageContainer}>{children}</main>
    </div>
  );
}
