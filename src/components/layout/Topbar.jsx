import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Tooltip from '../ui/Tooltip.jsx';

const pageTitles = {
  '/': 'routes.dashboard',
  '/daily-journal': 'routes.dailyJournal',
  '/warehouse-inventory': 'routes.warehouseInventory',
  '/customers': 'routes.customerManagement',
  '/products': 'routes.products',
  '/orders': 'routes.orders',
  '/weighing-shipment': 'routes.weighingShipment',
  '/invoices': 'routes.invoices',
  '/reports': 'routes.reports',
};

export default function Topbar({ headerAddon = null, onMenuClick }) {
  const location = useLocation();
  const { t, toggleLanguage } = useLanguage();
  const pageTitle = t(pageTitles[location.pathname] || 'routes.dashboard');

  return (
    <header className="topbar">
      <div className="topbar__title-area">
        <button className="topbar__menu-button" type="button" onClick={onMenuClick} aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>
        <p className="topbar__company">{t('companyName')}</p>
        <h1>{pageTitle}</h1>
      </div>
      {headerAddon && <div className="topbar__addon">{headerAddon}</div>}
      <div className="topbar__meta">
        <Tooltip content={t('tooltips.switchLanguage')}>
          <button className="language-toggle" type="button" onClick={toggleLanguage}>
            {t('switchLanguage')}
          </button>
        </Tooltip>
        <span>{t('admin')}</span>
        <strong>{new Date().toLocaleDateString()}</strong>
      </div>
    </header>
  );
}
