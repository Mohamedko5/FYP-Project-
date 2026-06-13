import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const navigationItems = [
  { path: '/', labelKey: 'routes.dashboard' },
  { path: '/daily-journal', labelKey: 'routes.dailyJournal' },
  { path: '/warehouse-inventory', labelKey: 'routes.warehouseInventory' },
  { path: '/customers', labelKey: 'routes.customers' },
  { path: '/products', labelKey: 'routes.products' },
  { path: '/orders', labelKey: 'routes.orders' },
  { path: '/weighing-shipment', labelKey: 'routes.weighingShipment' },
  { path: '/invoices', labelKey: 'routes.invoices' },
  { path: '/reports', labelKey: 'routes.reports' },
];

export default function Sidebar({ onLogout, onModuleNavigate }) {
  const { t } = useLanguage();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark">B</span>
        <div>
          <strong>{t('brandName')}</strong>
          <small>{t('brandSubtitle')}</small>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label={t('mainNavigation')}>
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
            onClick={onModuleNavigate}
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button className="sidebar__logout" type="button" onClick={onLogout}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4H5v16h5" />
            <path d="M14 8l4 4-4 4" />
            <path d="M8 12h10" />
          </svg>
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
