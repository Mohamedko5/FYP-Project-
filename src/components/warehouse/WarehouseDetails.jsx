import StatusBadge from '../ui/StatusBadge.jsx';
import { commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import WarehouseStockTable from './WarehouseStockTable.jsx';
import { getAvailableCapacity, getUsagePercent, getUsedCapacity, getWarehouseStatus } from './warehouseUtils.js';

export default function WarehouseDetails({ warehouse, actionSlot }) {
  const { t, isArabic } = useLanguage();
  if (!warehouse) return null;

  const usedCapacity = getUsedCapacity(warehouse);
  const availableCapacity = getAvailableCapacity(warehouse);
  const usagePercent = getUsagePercent(warehouse);
  const availablePercent = Math.max(0, Math.min(100, 100 - usagePercent));
  const capacityUnit = commodityUnits.find((unit) => unit.value === warehouse.capacityUnit);
  const unitLabel = isArabic ? (capacityUnit?.arabicLabel || warehouse.capacityUnit) : warehouse.capacityUnit;
  const graphTitle = isArabic ? 'رسم توفر المخزون' : 'Stock Availability Graph';
  const availableLabel = t('warehouse.availableCapacity');
  const usedLabel = t('warehouse.usedCapacity');
  const totalLabel = t('warehouse.totalCapacity');
  const formatQuantity = (value) => `${Number(value || 0).toLocaleString()} ${unitLabel}`;

  return (
    <div className="warehouse-details">
      <div className="warehouse-details__summary">
        <div>
          <span>{t('warehouse.warehouse')}</span>
          <strong>{warehouse.warehouseName}</strong>
        </div>
        <div>
          <span>{t('common.location')}</span>
          <strong>{warehouse.location}</strong>
        </div>
        <div>
          <span>{t('warehouse.managerName')}</span>
          <strong>{warehouse.managerName}</strong>
        </div>
        <div>
          <span>{t('warehouse.guardName')}</span>
          <strong>{warehouse.guardName}</strong>
        </div>
        <div>
          <span>{t('warehouse.totalCapacity')}</span>
          <strong>{Number(warehouse.capacity).toLocaleString()} {unitLabel}</strong>
        </div>
        <div>
          <span>{t('warehouse.usedCapacity')}</span>
          <strong>{usedCapacity.toLocaleString()} {unitLabel}</strong>
        </div>
        <div>
          <span>{t('warehouse.availableCapacity')}</span>
          <strong>{availableCapacity.toLocaleString()} {unitLabel}</strong>
        </div>
        <div>
          <span>{t('common.status')}</span>
          <StatusBadge status={getWarehouseStatus(warehouse)} />
        </div>
      </div>

      <div className="capacity-meter capacity-meter--large">
        <span style={{ width: `${usagePercent}%` }} />
      </div>

      <section className="warehouse-stock-graph" aria-labelledby="warehouse-stock-graph-title">
        <div className="warehouse-stock-graph__header">
          <div>
            <h3 id="warehouse-stock-graph-title">{graphTitle}</h3>
            <p>{warehouse.warehouseName}</p>
          </div>
          <strong>{availablePercent.toFixed(1)}% {isArabic ? 'متاح' : 'available'}</strong>
        </div>
        <div
          className="warehouse-stock-graph__bar"
          role="img"
          aria-label={`${availableLabel}: ${formatQuantity(availableCapacity)}. ${usedLabel}: ${formatQuantity(usedCapacity)}. ${totalLabel}: ${formatQuantity(warehouse.capacity)}.`}
        >
          <span className="warehouse-stock-graph__bar-used" style={{ width: `${usagePercent}%` }} />
          <span className="warehouse-stock-graph__bar-available" style={{ width: `${availablePercent}%` }} />
        </div>
        <div className="warehouse-stock-graph__legend">
          <span><i className="warehouse-stock-graph__swatch warehouse-stock-graph__swatch--used" />{usedLabel}: <strong>{formatQuantity(usedCapacity)}</strong></span>
          <span><i className="warehouse-stock-graph__swatch warehouse-stock-graph__swatch--available" />{availableLabel}: <strong>{formatQuantity(availableCapacity)}</strong></span>
          <span>{totalLabel}: <strong>{formatQuantity(warehouse.capacity)}</strong></span>
        </div>
      </section>

      {actionSlot && <div className="warehouse-details__actions">{actionSlot}</div>}
      <WarehouseStockTable stockItems={warehouse.storedProducts} warehouseCapacity={warehouse.capacity} />
    </div>
  );
}
