import { useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getProductCategory, getUnitOptions } from './warehouseUtils.js';

export default function StockForm({ form, errors, warning, warehouses, products, unitRules, onChange, onSubmit, onCancel }) {
  const { t, isArabic } = useLanguage();
  const unitOptions = useMemo(() => getUnitOptions(unitRules, form.product), [unitRules, form.product]);

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unit) {
    const unitInfo = commodityUnits.find((item) => item.value === unit.value);
    return isArabic ? (unitInfo?.arabicLabel || unit.label) : unit.label;
  }

  function handleProductChange(event) {
    const product = event.target.value;
    const firstUnit = getUnitOptions(unitRules, product)[0]?.value || '';
    onChange({ target: { name: 'product', value: product } });
    onChange({ target: { name: 'category', value: getProductCategory(products, product) } });
    onChange({ target: { name: 'unit', value: firstUnit } });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}
      {warning && <div className="form-warning form-grid__wide">{warning}</div>}

      <label>
        {t('warehouse.warehouse')}
        <select name="warehouseId" value={form.warehouseId} onChange={onChange}>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseName}</option>)}
        </select>
      </label>
      <label>
        {t('common.product')}
        <select name="product" value={form.product} onChange={handleProductChange}>
          {products.map((product) => <option key={product.id} value={product.name}>{productLabel(product.name)}</option>)}
        </select>
      </label>
      <label>
        {t('warehouse.driverName')}
        <input
          name="driverName"
          type="text"
          value={form.driverName}
          onChange={onChange}
          placeholder={t('warehouse.driverNamePlaceholder')}
        />
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
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('warehouse.stockNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('warehouse.addStock')}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </form>
  );
}
