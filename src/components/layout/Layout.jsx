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

  function refreshCurrentModule() {
    setHeaderAddon(null);
    setRouteRefreshVersion((current) => current + 1);
  }

  return (
    <div className="app-shell" dir={direction} lang={language}>
      <Sidebar onLogout={onLogout} onModuleNavigate={refreshCurrentModule} />
      <div className="app-shell__main">
        <Topbar headerAddon={headerAddon} />
        <main className="content">
          <Outlet key={`${location.pathname}-${routeRefreshVersion}`} context={{ setHeaderAddon }} />
        </main>
      </div>
    </div>
  );
}
