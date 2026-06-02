import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Tooltip from '../ui/Tooltip.jsx';

const navigationItems = [
  { path: '/', labelKey: 'routes.dashboard', tooltipKey: 'tooltips.nav.dashboard' },
  { path: '/daily-journal', labelKey: 'routes.dailyJournal', tooltipKey: 'tooltips.nav.dailyJournal' },
  { path: '/warehouse-inventory', labelKey: 'routes.warehouseInventory', tooltipKey: 'tooltips.nav.warehouseInventory' },
  { path: '/customers', labelKey: 'routes.customers', tooltipKey: 'tooltips.nav.customers' },
  { path: '/products', labelKey: 'routes.products', tooltipKey: 'tooltips.nav.products' },
  { path: '/orders', labelKey: 'routes.orders', tooltipKey: 'tooltips.nav.orders' },
  { path: '/weighing-shipment', labelKey: 'routes.weighingShipment', tooltipKey: 'tooltips.nav.weighingShipment' },
  { path: '/invoices', labelKey: 'routes.invoices', tooltipKey: 'tooltips.nav.invoices' },
  { path: '/reports', labelKey: 'routes.reports', tooltipKey: 'tooltips.nav.reports' },
];

export default function Sidebar({ onLogout }) {
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
          <Tooltip key={item.path} content={t(item.tooltipKey)} position="right" className="tooltip--block">
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
            >
              {t(item.labelKey)}
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      <div className="sidebar__footer">
        <Tooltip content={t('tooltips.logout')} position="right" className="tooltip--block">
          <button className="sidebar__logout" type="button" onClick={onLogout}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4H5v16h5" />
              <path d="M14 8l4 4-4 4" />
              <path d="M8 12h10" />
            </svg>
            <span>{t('logout')}</span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
