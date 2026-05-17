import StatusBadge from '../ui/StatusBadge.jsx';
import { commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import WarehouseStockTable from './WarehouseStockTable.jsx';
import { getAvailableCapacity, getUsagePercent, getUsedCapacity, getWarehouseStatus } from './warehouseUtils.js';

export default function WarehouseDetails({ warehouse }) {
  const { t, isArabic } = useLanguage();
  if (!warehouse) return null;

  const usedCapacity = getUsedCapacity(warehouse);
  const availableCapacity = getAvailableCapacity(warehouse);
  const usagePercent = getUsagePercent(warehouse);
  const capacityUnit = commodityUnits.find((unit) => unit.value === warehouse.capacityUnit);
  const unitLabel = isArabic ? (capacityUnit?.arabicLabel || warehouse.capacityUnit) : warehouse.capacityUnit;

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

      <p className="warehouse-details__notes">{warehouse.notes}</p>
      <WarehouseStockTable stockItems={warehouse.storedProducts} warehouseCapacity={warehouse.capacity} />
    </div>
  );
}
