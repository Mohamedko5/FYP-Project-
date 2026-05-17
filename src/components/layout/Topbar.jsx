import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

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

export default function Topbar() {
  const location = useLocation();
  const { t, toggleLanguage } = useLanguage();
  const pageTitle = t(pageTitles[location.pathname] || 'routes.dashboard');

  return (
    <header className="topbar">
      <div>
        <p className="topbar__company">{t('companyName')}</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="topbar__meta">
        <button className="language-toggle" type="button" onClick={toggleLanguage}>
          {t('switchLanguage')}
        </button>
        <span>{t('admin')}</span>
        <strong>{new Date().toLocaleDateString()}</strong>
      </div>
    </header>
  );
}
