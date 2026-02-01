import { useState, useEffect, useCallback } from 'react';
import { SettingsPage } from './pages/SettingsPage';
import { SessionDashboard } from './components/session/SessionDashboard';
import { AnalysisView } from './components/analysis/AnalysisView';
import { AppLayout, Sidebar } from './components/layout';
import type { PageId } from './components/layout';
import { useSettingsStore } from './stores';
import { useAutoScan } from './hooks';
import './styles/global.scss';

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('sessions');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { initStore } = useSettingsStore();

  // Initialize settings store on app start
  useEffect(() => {
    initStore();
  }, [initStore]);

  // Auto-scan telemetry folder (initial + periodic)
  useAutoScan();

  const handleNavigate = useCallback((page: PageId) => {
    setCurrentPage(page);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setCurrentPage('settings');
  }, []);

  const handleCloseSettings = useCallback(() => {
    setCurrentPage('sessions');
  }, []);

  const handleNavigateToAnalysis = useCallback(() => {
    setCurrentPage('analysis');
  }, []);

  return (
    <AppLayout
      sidebar={
        <Sidebar
          collapsed={sidebarCollapsed}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onToggle={handleToggleSidebar}
        />
      }
    >
      {/* Page Content */}
      {currentPage === 'sessions' && (
        <SessionDashboard
          onNavigateToAnalysis={handleNavigateToAnalysis}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {currentPage === 'analysis' && (
        <AnalysisView onBack={() => setCurrentPage('sessions')} />
      )}

      {currentPage === 'comparison' && (
        <div style={{ padding: '24px', color: '#e0e0e0' }}>
          <h2>Comparison Page</h2>
          <p>Coming soon in Phase 4...</p>
        </div>
      )}

      {currentPage === 'stint' && (
        <div style={{ padding: '24px', color: '#e0e0e0' }}>
          <h2>Stint Analysis Page</h2>
          <p>Coming soon in Phase 4...</p>
        </div>
      )}

      {currentPage === 'settings' && (
        <SettingsPage onClose={handleCloseSettings} />
      )}
    </AppLayout>
  );
}

export default App;
