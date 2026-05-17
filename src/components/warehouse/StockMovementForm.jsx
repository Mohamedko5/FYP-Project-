import { useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getUnitOptions } from './warehouseUtils.js';

export default function StockMovementForm({ form, errors, warehouses, products, unitRules, onChange, onSubmit }) {
  const { t, isArabic } = useLanguage();
  const unitOptions = useMemo(() => getUnitOptions(unitRules, form.product), [unitRules, form.product]);

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unit) {
    const unitInfo = commodityUnits.find((item) => item.value === unit.value);
    return isArabic ? (unitInfo?.arabicLabel || unit.label) : unit.label;
  }

  function movementLabel(value) {
    const labels = {
      'Stock In': t('warehouse.movementStockIn'),
      'Stock Out': t('warehouse.movementStockOut'),
      Transfer: t('warehouse.movementTransfer'),
    };
    return labels[value] || value;
  }

  function handleProductChange(event) {
    const product = event.target.value;
    const firstUnit = getUnitOptions(unitRules, product)[0]?.value || '';
    onChange({ target: { name: 'product', value: product } });
    onChange({ target: { name: 'unit', value: firstUnit } });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('warehouse.movementType')}
        <select name="movementType" value={form.movementType} onChange={onChange}>
          {['Stock In', 'Stock Out', 'Transfer'].map((type) => (
            <option key={type} value={type}>{movementLabel(type)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('warehouse.fromWarehouse')}
        <select name="fromWarehouseId" value={form.fromWarehouseId} onChange={onChange}>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseName}</option>)}
        </select>
      </label>
      {form.movementType === 'Transfer' && (
        <label>
          {t('warehouse.toWarehouse')}
          <select name="toWarehouseId" value={form.toWarehouseId} onChange={onChange}>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseName}</option>)}
          </select>
        </label>
      )}
      <label>
        {t('common.product')}
        <select name="product" value={form.product} onChange={handleProductChange}>
          {products.map((product) => <option key={product.id} value={product.name}>{productLabel(product.name)}</option>)}
        </select>
      </label>
      <label>
        {t('common.quantity')}
        <input name="quantity" type="number" min="0" value={form.quantity} onChange={onChange} placeholder="0" />
      </label>
      <label>
        {t('common.unit')}
        <select name="unit" value={form.unit} onChange={onChange}>
          {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unitLabel(unit)}</option>)}
        </select>
      </label>
      <label>
        {t('common.date')}
        <input name="date" type="date" value={form.date} onChange={onChange} />
      </label>
      <label className="form-grid__wide">
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('warehouse.movementNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions">
        <Button type="submit">{t('warehouse.recordMovement')}</Button>
      </div>
    </form>
  );
}
