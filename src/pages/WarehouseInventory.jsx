import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { products, warehouses, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WarehouseInventory() {
  const { t } = useLanguage();
  const [transfer, setTransfer] = useState({
    product: 'White Sesame',
    fromWarehouse: 'Main Warehouse',
    toWarehouse: 'North Store',
    quantity: '',
    note: '',
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setTransfer((current) => ({ ...current, [name]: value }));
  }

  const warehouseColumns = [
    { key: 'name', label: t('routes.warehouseInventory') },
    { key: 'location', label: t('common.location') },
    { key: 'capacity', label: t('common.capacity') },
    { key: 'currentStock', label: t('common.currentStock'), render: (row) => `${row.currentStock.toLocaleString()} bags` },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  const productColumns = [
    { key: 'name', label: t('common.product') },
    { key: 'unit', label: t('common.unit') },
    { key: 'stock', label: t('common.currentStock') },
    { key: 'price', label: t('common.price'), render: (row) => formatCurrency(row.price) },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="page-grid">
      <Card title={t('warehouse.listTitle')} subtitle={t('warehouse.listSubtitle')}>
        <Table columns={warehouseColumns} rows={warehouses} />
      </Card>

      <Card title={t('warehouse.stockTitle')} subtitle={t('warehouse.stockSubtitle')}>
        <Table columns={productColumns} rows={products} />
      </Card>

      <div className="two-column">
        <Card title={t('warehouse.transferTitle')} subtitle={t('warehouse.transferSubtitle')}>
          <form className="form-grid form-grid--single">
            <label>
              {t('common.product')}
              <select name="product" value={transfer.product} onChange={handleChange}>
                {products.map((product) => (
                  <option key={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              {t('warehouse.fromWarehouse')}
              <select name="fromWarehouse" value={transfer.fromWarehouse} onChange={handleChange}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>
            <label>
              {t('warehouse.toWarehouse')}
              <select name="toWarehouse" value={transfer.toWarehouse} onChange={handleChange}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>
            <label>
              {t('warehouse.quantityBags')}
              <input name="quantity" type="number" value={transfer.quantity} onChange={handleChange} placeholder="0" />
            </label>
            <label>
              {t('warehouse.transferNote')}
              <textarea name="note" value={transfer.note} onChange={handleChange} placeholder={t('warehouse.transferNotePlaceholder')} />
            </label>
            <Button>{t('warehouse.recordTransfer')}</Button>
          </form>
        </Card>

        <Card title={t('warehouse.auditTitle')} subtitle={t('warehouse.auditSubtitle')}>
          <div className="audit-list">
            <p><strong>{t('warehouse.openingStock')}</strong> 4,690 bags</p>
            <p><strong>{t('warehouse.stockIn')}</strong> 320 bags</p>
            <p><strong>{t('warehouse.stockOut')}</strong> 140 bags</p>
            <p><strong>{t('warehouse.expectedClosing')}</strong> 4,870 bags</p>
            <p><strong>{t('warehouse.lowStockItems')}</strong> Sacks / Khaysh, Dabara</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
