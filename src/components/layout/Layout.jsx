import { Outlet } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function Layout() {
  const { direction, language } = useLanguage();

  return (
    <div className="app-shell" dir={direction} lang={language}>
      <Sidebar />
      <div className="app-shell__main">
        <Topbar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
