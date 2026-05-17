import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { dashboardSummary, journalEntries, orders, warehouses, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Dashboard() {
  const { t } = useLanguage();
  const orderColumns = [
    { key: 'orderNo', label: t('common.orderNo') },
    { key: 'customer', label: t('common.customer') },
    { key: 'product', label: t('common.product') },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="page-grid">
      <div className="summary-grid">
        {dashboardSummary.map((item) => (
          <Card key={item.labelKey} className="summary-card">
            <p>{t(item.labelKey)}</p>
            <strong>{item.value}</strong>
            <small>{t(item.noteKey)}</small>
          </Card>
        ))}
      </div>

      <Card title={t('dashboard.warehouseSummary')} subtitle={t('dashboard.warehouseSummarySubtitle')}>
        <div className="warehouse-list">
          {warehouses.map((warehouse) => (
            <div className="warehouse-row" key={warehouse.id}>
              <div>
                <strong>{warehouse.name}</strong>
                <span>{warehouse.location}</span>
              </div>
              <div>
                <strong>{warehouse.currentStock.toLocaleString()} bags</strong>
                <span>{warehouse.capacity}</span>
              </div>
              <StatusBadge status={warehouse.status} />
            </div>
          ))}
        </div>
      </Card>

      <div className="two-column">
        <Card title={t('dashboard.recentJournalEntries')} subtitle={t('dashboard.recentJournalSubtitle')}>
          <div className="activity-list">
            {journalEntries.slice(0, 3).map((entry) => (
              <div className="activity-row" key={entry.id}>
                <div>
                  <strong>{entry.category}</strong>
                  <span>{entry.party}</span>
                </div>
                <div className="activity-row__amount">
                  <strong>{formatCurrency(entry.amount)}</strong>
                  <StatusBadge status={entry.type} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('dashboard.recentOrders')} subtitle={t('dashboard.recentOrdersSubtitle')}>
          <Table columns={orderColumns} rows={orders.slice(0, 4)} />
        </Card>
      </div>
    </div>
  );
}
