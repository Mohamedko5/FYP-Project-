import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getStockStatus } from './warehouseUtils.js';

export default function WarehouseStockTable({ stockItems, warehouseCapacity }) {
  const { t, isArabic } = useLanguage();

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unit = commodityUnits.find((item) => item.value === unitValue);
    return isArabic ? (unit?.arabicLabel || unitValue) : unitValue;
  }

  const columns = [
    { key: 'productName', label: t('common.productName'), render: (row) => productLabel(row.productName) },
    { key: 'category', label: t('common.category') },
    { key: 'quantity', label: t('common.quantity'), render: (row) => Number(row.quantity).toLocaleString() },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    {
      key: 'capacityUsage',
      label: t('warehouse.capacityUsage'),
      render: (row) => `${Math.round((Number(row.quantity) / Number(warehouseCapacity || 1)) * 100)}%`,
    },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={getStockStatus(row)} /> },
  ];

  return <Table columns={columns} rows={stockItems} emptyMessage={t('warehouse.noProductsStored')} />;
}
