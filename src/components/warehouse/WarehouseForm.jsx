import { useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getUnitOptions } from './warehouseUtils.js';

export default function WarehouseForm({ form, errors, products, unitRules, onChange, onSubmit, onCancel }) {
  const { t, isArabic } = useLanguage();
  const unitOptions = useMemo(() => getUnitOptions(unitRules, form.productType), [unitRules, form.productType]);

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unit) {
    const unitInfo = commodityUnits.find((item) => item.value === unit.value);
    return isArabic ? (unitInfo?.arabicLabel || unit.label) : unit.label;
  }

  function handleProductChange(event) {
    const productType = event.target.value;
    const firstUnit = getUnitOptions(unitRules, productType)[0]?.value || '';
    onChange({ target: { name: 'productType', value: productType } });
    onChange({ target: { name: 'capacityUnit', value: firstUnit } });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('warehouse.warehouseName')}
        <input name="warehouseName" value={form.warehouseName} onChange={onChange} placeholder={t('warehouse.warehouseNamePlaceholder')} />
      </label>
      <label>
        {t('common.location')}
        <input name="location" value={form.location} onChange={onChange} placeholder={t('common.location')} />
      </label>
      <label>
        {t('warehouse.productType')}
        <select name="productType" value={form.productType} onChange={handleProductChange}>
          {products.map((product) => <option key={product.id} value={product.name}>{productLabel(product.name)}</option>)}
        </select>
      </label>
      <label>
        {t('warehouse.storageCapacity')}
        <input name="capacity" type="number" min="0" value={form.capacity} onChange={onChange} placeholder="0" />
      </label>
      <label>
        {t('warehouse.capacityUnit')}
        <select name="capacityUnit" value={form.capacityUnit} onChange={onChange}>
          {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unitLabel(unit)}</option>)}
        </select>
      </label>
      <label>
        {t('warehouse.managerName')}
        <input name="managerName" value={form.managerName} onChange={onChange} placeholder={t('warehouse.managerPlaceholder')} />
      </label>
      <label>
        {t('warehouse.guardName')}
        <input name="guardName" value={form.guardName} onChange={onChange} placeholder={t('warehouse.guardPlaceholder')} />
      </label>
      <label className="form-grid__wide">
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('warehouse.notesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('warehouse.addWarehouse')}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </form>
  );
}
