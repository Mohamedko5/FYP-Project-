import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
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

  function operationLabel(operation) {
    if (operation === 'stock_in') return t('journal.addStock');
    if (operation === 'manual_withdrawal') return t('journal.manualWithdrawal');
    if (operation === 'shipment_out') return t('journal.shipmentWithdrawal');
    return '-';
  }

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'warehouseOperation', label: t('journal.warehouseOperation'), render: (row) => <StatusBadge status={operationLabel(row.warehouseOperation)} /> },
    { key: 'warehouseName', label: t('warehouse.warehouse'), render: (row) => row.warehouseName || '-' },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'party', label: t('common.customerSupplier') },
    { key: 'estimatedValue', label: t('journal.estimatedValue'), render: (row) => formatCurrency(row.estimatedValue) },
    { key: 'description', label: t('common.description') },
    { key: 'movementReference', label: t('journal.linkedInventoryMovement'), render: (row) => row.movementReference || row.sourceReference || '-' },
    { key: 'administrator', label: t('journal.administrator'), render: (row) => row.administrator || '-' },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-actions">
          {row.isSystemGenerated ? (
            <span>{t('journal.readOnly')}</span>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onEdit(row)}>{t('edit')}</Button>
              <Button variant="secondary" onClick={() => onDelete(row.id)}>{t('delete')}</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!entries.length) return <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />;

  return (
    <>
      <div className="commodity-history-table">
        <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />
      </div>
      <div className="commodity-history-cards">
        {entries.map((row) => (
          <article className="commodity-history-card" key={row.id}>
            <div>
              <StatusBadge status={operationLabel(row.warehouseOperation)} />
              <span>{row.date} {row.time || ''}</span>
            </div>
            <strong>{productLabel(row.product)} - {row.quantity} {unitLabel(row.unit)}</strong>
            <p>{row.warehouseName || '-'}</p>
            <small>{row.movementReference || row.sourceReference || '-'}</small>
            <Button variant="secondary" onClick={() => onEdit(row)} disabled={row.isSystemGenerated}>{row.isSystemGenerated ? t('journal.readOnly') : t('view')}</Button>
          </article>
        ))}
      </div>
    </>
  );
}
