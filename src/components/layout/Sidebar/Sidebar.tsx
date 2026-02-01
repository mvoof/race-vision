import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Activity,
  GitCompare,
  Timer,
  Settings,
  ChevronRight,
  ChevronLeft,
  Triangle,
} from 'lucide-react';
import styles from './Sidebar.module.scss';

export type PageId =
  | 'sessions'
  | 'analysis'
  | 'comparison'
  | 'stint'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'sessions',
    label: 'Sessions',
    icon: <LayoutDashboard size={20} />,
  },
  {
    id: 'analysis',
    label: 'Lap Analysis',
    icon: <Activity size={20} />,
  },
  {
    id: 'comparison',
    label: 'Comparison',
    icon: <GitCompare size={20} />,
  },
  {
    id: 'stint',
    label: 'Stint Analysis',
    icon: <Timer size={20} />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={20} />,
  },
];

export interface SidebarProps {
  collapsed: boolean;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onToggle: () => void;
}

export function Sidebar({
  collapsed,
  currentPage,
  onNavigate,
  onToggle,
}: SidebarProps) {
  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Triangle size={24} fill="currentColor" />
        </div>
        {!collapsed && <h1 className={styles.logoText}>Race Vision</h1>}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${
              currentPage === item.id ? styles.active : ''
            }`}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            aria-label={`Navigate to ${item.label}`}
          >
            <div className={styles.navIcon}>{item.icon}</div>
            {!collapsed && (
              <span className={styles.navLabel}>{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      <button
        className={styles.collapseButton}
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
  );
}
