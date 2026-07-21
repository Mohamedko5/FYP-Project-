import { useLanguage } from '../../i18n/LanguageContext.jsx';
import WarehouseStockTable from '../warehouse/WarehouseStockTable.jsx';
import InventoryMovementHistory from '../warehouse/InventoryMovementHistory.jsx';

export default function PrintableWarehouseInventory({ warehouse, movements, adminName }) {
  const { t } = useLanguage();
  if (!warehouse) return null;

  return (
    <section className="print-area" aria-label="Printable warehouse inventory report">
      <div className="print-report">
        <header className="print-report__header">
          <h1>{t('companyName')}</h1>
          <p>{t('warehouse.printTitle')}</p>
        </header>
        <div className="print-report__meta">
          <div><span>{t('common.date')}</span><strong>{new Date().toLocaleDateString()}</strong></div>
          <div><span>{t('warehouse.admin')}</span><strong>{adminName}</strong></div>
          <div><span>{t('warehouse.warehouseCode')}</span><strong>{warehouse.code}</strong></div>
          <div><span>{t('warehouse.warehouseName')}</span><strong>{warehouse.warehouseName}</strong></div>
          <div><span>{t('common.location')}</span><strong>{warehouse.location}</strong></div>
          <div><span>{t('warehouse.managerName')}</span><strong>{warehouse.managerName}</strong></div>
          <div><span>{t('warehouse.guardName')}</span><strong>{warehouse.guardName}</strong></div>
          <div><span>{t('warehouse.productType')}</span><strong>{warehouse.productType}</strong></div>
          <div><span>{t('warehouse.totalCapacity')}</span><strong>{warehouse.capacity} {warehouse.capacityUnit}</strong></div>
          <div><span>{t('warehouse.usedCapacity')}</span><strong>{warehouse.currentStock} {warehouse.capacityUnit}</strong></div>
          <div><span>{t('warehouse.availableCapacity')}</span><strong>{warehouse.availableCapacity} {warehouse.capacityUnit}</strong></div>
          <div><span>{t('warehouse.capacityUsage')}</span><strong>{warehouse.usagePercent}%</strong></div>
          <div><span>{t('common.status')}</span><strong>{warehouse.status}</strong></div>
        </div>
        <section className="print-report__section">
          <h3>{t('warehouse.stockTitle')}</h3>
          <WarehouseStockTable stockItems={warehouse.storedProducts} warehouseCapacity={warehouse.capacity} />
        </section>
        <section className="print-report__section">
          <h3>{t('warehouse.movementHistoryTitle')}</h3>
          <InventoryMovementHistory movements={movements} />
        </section>
      </div>
    </section>
  );
}
