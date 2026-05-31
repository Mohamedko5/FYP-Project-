import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function Layout() {
  const { direction, language } = useLanguage();
  const [headerAddon, setHeaderAddon] = useState(null);

  return (
    <div className="app-shell" dir={direction} lang={language}>
      <Sidebar />
      <div className="app-shell__main">
        <Topbar headerAddon={headerAddon} />
        <main className="content">
          <Outlet context={{ setHeaderAddon }} />
        </main>
      </div>
    </div>
  );
}
