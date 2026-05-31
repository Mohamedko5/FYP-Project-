import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function InventoryMovementHistory({ movements }) {
  const { t, isArabic } = useLanguage();

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unit = commodityUnits.find((item) => item.value === unitValue);
    return isArabic ? (unit?.arabicLabel || unitValue) : (unit?.englishLabel || unitValue);
  }

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={row.type} /> },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity'), render: (row) => Number(row.quantity).toLocaleString() },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'adminName', label: t('warehouse.admin') },
    { key: 'driverName', label: t('warehouse.driverName'), render: (row) => row.driverName || '-' },
    { key: 'notes', label: t('warehouse.movementNotes') },
  ];

  return (
    <section className="inventory-movement-history">
      <div className="section-heading">
        <h3>{t('warehouse.movementHistoryTitle')}</h3>
        <p>{t('warehouse.movementHistorySubtitle')}</p>
      </div>
      <Table columns={columns} rows={movements} emptyMessage={t('warehouse.noMovementHistory')} />
    </section>
  );
}
