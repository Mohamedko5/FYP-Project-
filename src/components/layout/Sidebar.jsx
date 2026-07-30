import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getAdminChatUnreadCount } from '../../services/chatApi.js';
import { getAdminSupplyOfferPendingCount } from '../../services/supplyOffersApi.js';

const navigationItems = [
  { path: '/', labelKey: 'routes.dashboard' },
  { path: '/daily-journal', labelKey: 'routes.dailyJournal' },
  { path: '/warehouse-inventory', labelKey: 'routes.warehouseInventory' },
  { path: '/customers', labelKey: 'routes.customers' },
  { path: '/products', labelKey: 'routes.products' },
  { path: '/orders', labelKey: 'routes.orders' },
  { path: '/invoices', labelKey: 'routes.invoices' },
  { path: '/customer-messages', labelKey: 'routes.customerMessages', badge: 'chat' },
  { path: '/supply-offers', labelKey: 'routes.supplyOffers', badge: 'supplyOffers' },
  { path: '/zakat', labelKey: 'routes.zakat' },
  { path: '/weighing-shipment', labelKey: 'routes.weighingShipment' },
  { path: '/reports', labelKey: 'routes.reports' },
];

export default function Sidebar({ onLogout, onModuleNavigate, isOpen = false }) {
  const { t } = useLanguage();
  const [chatUnread, setChatUnread] = useState(0);
  const [supplyOfferPending, setSupplyOfferPending] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadUnread() {
      try {
        const response = await getAdminChatUnreadCount();
        if (active) setChatUnread(Number(response.unread_count || 0));
      } catch {
        if (active) setChatUnread(0);
      }
      try {
        const response = await getAdminSupplyOfferPendingCount();
        if (active) setSupplyOfferPending(Number(response.pending_count || 0));
      } catch {
        if (active) setSupplyOfferPending(0);
      }
    }
    loadUnread();
    const id = window.setInterval(loadUnread, 30000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`} aria-label={t('mainNavigation')}>
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
            <span>{t(item.labelKey)}</span>
            {item.badge === 'chat' && chatUnread > 0 && <span className="sidebar__badge">{chatUnread}</span>}
            {item.badge === 'supplyOffers' && supplyOfferPending > 0 && <span className="sidebar__badge">{supplyOfferPending}</span>}
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
