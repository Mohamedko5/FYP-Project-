import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { commodityProductLabels, commodityUnits, formatCurrency } from '../../data/dummyData.js';

export default function CommodityJournalTable({ entries, onEdit, t, statusLabel, isArabic, emptyMessage }) {
  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unit = commodityUnits.find((item) => item.value === unitValue);
    if (!unit) return unitValue;
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'party', label: t('common.customerSupplier') },
    { key: 'lahuWaAlayh', label: t('journal.lahuAlayh'), render: (row) => statusLabel(row.lahuWaAlayh) },
    { key: 'estimatedValue', label: t('journal.estimatedValue'), render: (row) => formatCurrency(row.estimatedValue) },
    { key: 'description', label: t('common.description') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-actions">
          <Button variant="secondary" onClick={() => onEdit(row)}>{t('edit')}</Button>
        </div>
      ),
    },
  ];

  return <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />;
}
