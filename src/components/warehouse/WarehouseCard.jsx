import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getAvailableCapacity, getUsagePercent, getUsedCapacity, getWarehouseStatus } from './warehouseUtils.js';

export default function WarehouseCard({ warehouse, isSelected, onSelect }) {
  const { t, isArabic } = useLanguage();
  const usedCapacity = getUsedCapacity(warehouse);
  const availableCapacity = getAvailableCapacity(warehouse);
  const usagePercent = getUsagePercent(warehouse);
  const status = getWarehouseStatus(warehouse);
  const productName = commodityProductLabels[warehouse.productType]?.[isArabic ? 'ar' : 'en'] || warehouse.productType;
  const capacityUnit = commodityUnits.find((unit) => unit.value === warehouse.capacityUnit);
  const unitLabel = isArabic ? (capacityUnit?.arabicLabel || warehouse.capacityUnit) : warehouse.capacityUnit;

  return (
    <article className={`warehouse-card ${isSelected ? 'is-selected' : ''}`}>
      <div className="warehouse-card__header">
        <div>
          <h3>{warehouse.warehouseName}</h3>
          <p>{warehouse.location}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="warehouse-card__capacity">
        <div>
          <span>{t('warehouse.used')}</span>
          <strong>{usedCapacity.toLocaleString()} {unitLabel}</strong>
        </div>
        <div>
          <span>{t('warehouse.available')}</span>
          <strong>{availableCapacity.toLocaleString()} {unitLabel}</strong>
        </div>
      </div>

      <div className="capacity-meter" aria-label="Warehouse capacity usage">
        <span style={{ width: `${usagePercent}%` }} />
      </div>

      <div className="warehouse-card__meta">
        <span>{t('common.capacity')}: {Number(warehouse.capacity).toLocaleString()} {unitLabel}</span>
        <span>{t('common.product')}: {productName}</span>
        <span>{t('warehouse.managerName')}: {warehouse.managerName}</span>
        <span>{t('warehouse.guardName')}: {warehouse.guardName}</span>
      </div>

      <Button variant={isSelected ? 'primary' : 'secondary'} onClick={() => onSelect(warehouse.id)}>
        {t('warehouse.viewDetails')}
      </Button>
    </article>
  );
}
