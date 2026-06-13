import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import {
  commodityProductLabels,
  companyWorkers,
  customers,
  formatCurrency,
  inventoryMovementHistory,
  journalEntries,
  products,
  shipments,
  warehouses,
} from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function getLatestDate(records) {
  return records
    .map((record) => record.date)
    .filter(Boolean)
    .sort()
    .at(-1);
}

function calculateCashSummary(records) {
  const incomeRecords = records.filter((entry) => entry.type === 'Income');
  const openingEntry = incomeRecords[0];
  const openingBalance = openingEntry?.amount || 0;
  const incomeAfterOpening = incomeRecords
    .filter((entry) => entry.id !== openingEntry?.id)
    .reduce((total, entry) => total + entry.amount, 0);
  const expenses = records
    .filter((entry) => entry.type === 'Expense')
    .reduce((total, entry) => total + entry.amount, 0);

  return {
    openingBalance,
    incomeAfterOpening,
    expenses,
    closingBalance: openingBalance + incomeAfterOpening - expenses,
  };
}

function productLabel(productName, isArabic) {
  return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
}

function DashboardIcon({ name }) {
  const paths = {
    cash: ['M4 7h16v10H4z', 'M8 11h.01', 'M16 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    inventory: ['M4 7l8-4 8 4-8 4z', 'M4 7v9l8 4 8-4V7', 'M12 11v9'],
    customers: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M17 11a2.5 2.5 0 1 0 0-5', 'M4 20a5 5 0 0 1 10 0', 'M15 18a4 4 0 0 1 5 2'],
    warehouse: ['M3 9l9-5 9 5', 'M5 10v10h14V10', 'M9 20v-6h6v6'],
    product: ['M5 12c4-7 11-7 14-2-5 1-8 4-9 9-2-3-3-5-5-7z', 'M5 12c3 0 7 2 10 7'],
    activity: ['M4 12h4l2-7 4 14 2-7h4'],
    alert: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
  };

  return (
    <span className="dashboard-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {paths[name].map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}

export default function Dashboard() {
  const { t, isArabic } = useLanguage();
  const businessDate = getLatestDate(journalEntries) || new Date().toISOString().slice(0, 10);
  const todayJournalEntries = journalEntries.filter((entry) => entry.date === businessDate);
  const cashSummary = calculateCashSummary(todayJournalEntries);

  const totalInventory = warehouses.reduce((warehouseTotal, warehouse) =>
    warehouseTotal + warehouse.storedProducts.reduce((productTotal, product) => productTotal + product.quantity, 0), 0);
  const totalWarehouseCapacity = warehouses.reduce((total, warehouse) => total + warehouse.capacity, 0);
  const usedWarehouseCapacity = warehouses.reduce((total, warehouse) => total + warehouse.currentStock, 0);
  const lowStockProducts = warehouses.flatMap((warehouse) =>
    warehouse.storedProducts.filter((product) => product.quantity <= product.minimumThreshold)
  );

  const coreProducts = ['White Sesame', 'Red Sesame', 'Corn']
    .map((name) => products.find((product) => product.name === name))
    .filter(Boolean);

  const secondaryMetrics = [
    { icon: 'inventory', label: t('dashboard.totalInventory'), value: totalInventory.toLocaleString(), note: t('dashboard.inventoryAcrossWarehouses') },
    { icon: 'customers', label: t('dashboard.totalCustomers'), value: (customers.length + companyWorkers.length).toLocaleString(), note: t('dashboard.customersAndWorkers') },
    { icon: 'warehouse', label: t('dashboard.totalWarehouses'), value: warehouses.length.toLocaleString(), note: t('dashboard.storageLocations') },
  ];

  const recentActivity = [
    {
      id: 'journal',
      title: t('dashboard.latestJournalTransaction'),
      main: todayJournalEntries[0]?.category || t('emptyMessage'),
      detail: todayJournalEntries[0]
        ? `${todayJournalEntries[0].party} - ${formatCurrency(todayJournalEntries[0].amount)}`
        : t('dashboard.noRecentActivity'),
      status: todayJournalEntries[0]?.type,
    },
    {
      id: 'stock',
      title: t('dashboard.latestStockMovement'),
      main: inventoryMovementHistory[0]?.product || t('emptyMessage'),
      detail: inventoryMovementHistory[0]
        ? `${inventoryMovementHistory[0].type} - ${inventoryMovementHistory[0].quantity} ${inventoryMovementHistory[0].unit}`
        : t('dashboard.noRecentActivity'),
      status: inventoryMovementHistory[0]?.type,
    },
    {
      id: 'customer',
      title: t('dashboard.latestCustomerTransaction'),
      main: customers[0]?.name || t('emptyMessage'),
      detail: customers[0]?.lastTransactionDate || t('dashboard.noRecentActivity'),
      status: customers[0]?.status,
    },
    {
      id: 'shipment',
      title: t('dashboard.latestShipment'),
      main: shipments[0]?.batchNo || t('emptyMessage'),
      detail: shipments[0] ? `${shipments[0].customer} - ${shipments[0].tracking}` : t('dashboard.noRecentActivity'),
      status: shipments[0]?.status,
    },
  ];

  const alerts = [
    ...warehouses
      .filter((warehouse) => warehouse.currentStock / warehouse.capacity >= 0.8)
      .map((warehouse) => ({
        id: `warehouse-${warehouse.id}`,
        title: t('dashboard.warehouseCapacityAlert'),
        detail: `${warehouse.warehouseName} - ${Math.round((warehouse.currentStock / warehouse.capacity) * 100)}%`,
        status: warehouse.currentStock >= warehouse.capacity ? 'Full' : 'Almost Full',
      })),
    ...lowStockProducts.map((product) => ({
      id: `product-${product.id}`,
      title: t('dashboard.productLowStockAlert'),
      detail: `${productLabel(product.productName, isArabic)} - ${product.quantity} ${product.unit}`,
      status: 'Low Stock',
    })),
    ...shipments
      .filter((shipment) => shipment.status === 'Pending Approval')
      .map((shipment) => ({
        id: `shipment-${shipment.id}`,
        title: t('dashboard.pendingShipmentAlert'),
        detail: `${shipment.batchNo} - ${shipment.customer}`,
        status: shipment.status,
      })),
  ].slice(0, 4);

  return (
    <div className="dashboard-page dashboard-page--calm">
      <section className="dashboard-hero">
        <Card className="dashboard-cash-card">
          <div className="dashboard-card-heading">
            <DashboardIcon name="cash" />
            <div>
              <p>{t('dashboard.currentCashBalance')}</p>
            </div>
          </div>
          <strong>{formatCurrency(cashSummary.closingBalance)}</strong>
          <div className="dashboard-cash-breakdown">
            <span>{t('dashboard.todayIncome')}: {formatCurrency(cashSummary.incomeAfterOpening)}</span>
            <span>{t('dashboard.todayExpenses')}: {formatCurrency(cashSummary.expenses)}</span>
          </div>
        </Card>

        <div className="dashboard-secondary-grid">
          {secondaryMetrics.map((metric) => (
            <Card key={metric.label} className="dashboard-secondary-card">
              <div className="dashboard-card-heading">
                <DashboardIcon name={metric.icon} />
                <p>{metric.label}</p>
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </Card>
          ))}
        </div>
      </section>

      <section className="dashboard-section dashboard-products-section">
        <div className="dashboard-section__header">
          <div>
            <span>{t('dashboard.productOverview')}</span>
            <h2>{t('dashboard.availableProducts')}</h2>
          </div>
          <DashboardIcon name="product" />
        </div>
        <div className="dashboard-product-grid">
          {coreProducts.map((product) => (
            <Card key={product.id} className="dashboard-product-card">
              <div>
                <p>{productLabel(product.name, isArabic)}</p>
                <StatusBadge status={product.status} />
              </div>
              <strong>{product.stock.toLocaleString()}</strong>
              <small>{product.unit}</small>
            </Card>
          ))}
        </div>
      </section>

      <section className="dashboard-panels">
        <Card title={t('dashboard.recentActivity')} subtitle={t('dashboard.recentActivitySubtitle')} className="dashboard-panel-card">
          <div className="dashboard-panel-title-icon">
            <DashboardIcon name="activity" />
          </div>
          <div className="activity-list">
            {recentActivity.map((activity) => (
              <div className="activity-row dashboard-activity-row" key={activity.id}>
                <div>
                  <span>{activity.title}</span>
                  <strong>{activity.main}</strong>
                  <small>{activity.detail}</small>
                </div>
                {activity.status && <StatusBadge status={activity.status} />}
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('dashboard.alerts')} subtitle={t('dashboard.alertsSubtitle')} className="dashboard-panel-card">
          <div className="dashboard-panel-title-icon">
            <DashboardIcon name="alert" />
          </div>
          <div className="activity-list">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div className="activity-row dashboard-activity-row" key={alert.id}>
                <div>
                  <span>{alert.title}</span>
                  <strong>{alert.detail}</strong>
                </div>
                <StatusBadge status={alert.status} />
              </div>
            )) : (
              <div className="dashboard-empty-alert">{t('dashboard.noAlerts')}</div>
            )}
          </div>
        </Card>
      </section>

      <section className="dashboard-context-strip">
        <div>
          <span>{t('dashboard.usedCapacity')}</span>
          <strong>{usedWarehouseCapacity.toLocaleString()} / {totalWarehouseCapacity.toLocaleString()}</strong>
        </div>
        <div>
          <span>{t('dashboard.lowStockAlerts')}</span>
          <strong>{lowStockProducts.length.toLocaleString()}</strong>
        </div>
      </section>
    </div>
  );
}
