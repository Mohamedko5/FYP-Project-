import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { commodityProductLabels, commodityUnits, formatCurrency } from '../../data/dummyData.js';

export default function CommodityJournalTable({ entries, onEdit, onDelete, t, statusLabel, isArabic, emptyMessage }) {
  const unitLabels = {
    Qintar: { en: 'Qintar', ar: commodityUnits.find((unit) => unit.value === 'Qintar')?.arabicLabel || 'Qintar' },
    KG: { en: 'KG', ar: 'KG' },
    Bag: { en: 'Bag', ar: 'Bag' },
    Bale: { en: 'Bale', ar: commodityUnits.find((unit) => unit.value === 'Bale')?.arabicLabel || 'Bale' },
    Unit: { en: 'Unit', ar: commodityUnits.find((unit) => unit.value === 'Piece')?.arabicLabel || 'Unit' },
  };

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    if (unitLabels[unitValue]) return unitLabels[unitValue][isArabic ? 'ar' : 'en'];
    const unit = commodityUnits.find((item) => item.value === unitValue);
    if (!unit) return unitValue;
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'party', label: t('common.customerSupplier') },
    { key: 'estimatedValue', label: t('journal.estimatedValue'), render: (row) => formatCurrency(row.estimatedValue) },
    { key: 'description', label: t('common.description') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-actions">
          <Button variant="secondary" onClick={() => onEdit(row)}>{t('edit')}</Button>
          <Button variant="secondary" onClick={() => onDelete(row.id)}>{t('delete')}</Button>
        </div>
      ),
    },
  ];

  return <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />;
}
