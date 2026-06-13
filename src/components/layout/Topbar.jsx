import { useLocation } from 'react-router-dom';
import { useCurrency } from '../../i18n/CurrencyContext.jsx';
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

export default function Topbar({ headerAddon = null }) {
  const location = useLocation();
  const { t, toggleLanguage } = useLanguage();
  const { currency, setCurrency, currencyOptions } = useCurrency();
  const pageTitle = t(pageTitles[location.pathname] || 'routes.dashboard');

  return (
    <header className="topbar">
      <div className="topbar__title-area">
        <p className="topbar__company">{t('companyName')}</p>
        <h1>{pageTitle}</h1>
      </div>
      {headerAddon && <div className="topbar__addon">{headerAddon}</div>}
      <div className="topbar__meta">
        <label className="currency-selector">
          <span>{t('currency.label')}</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
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
