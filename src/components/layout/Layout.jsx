import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function Layout({ onLogout }) {
  const { direction, language } = useLanguage();
  const location = useLocation();
  const [headerAddon, setHeaderAddon] = useState(null);
  const [routeRefreshVersion, setRouteRefreshVersion] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function refreshCurrentModule() {
    setHeaderAddon(null);
    setRouteRefreshVersion((current) => current + 1);
    setIsSidebarOpen(false);
  }

  function handleLogout() {
    setIsSidebarOpen(false);
    onLogout();
  }

  return (
    <div className={`app-shell ${isSidebarOpen ? 'app-shell--sidebar-open' : ''}`} dir={direction} lang={language}>
      <Sidebar onLogout={handleLogout} onModuleNavigate={refreshCurrentModule} isOpen={isSidebarOpen} />
      {isSidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setIsSidebarOpen(false)} />}
      <div className="app-shell__main">
        <Topbar headerAddon={headerAddon} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="content">
          <Outlet key={`${location.pathname}-${routeRefreshVersion}`} context={{ setHeaderAddon }} />
        </main>
      </div>
    </div>
  );
}
