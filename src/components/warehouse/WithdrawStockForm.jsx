import { useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function WithdrawStockForm({ form, errors, warehouse, isSaving = false, onChange, onSubmit, onCancel }) {
  const { t, isArabic } = useLanguage();
  const stockItems = warehouse?.storedProducts || [];
  const productOptions = [...new Set(stockItems.map((item) => item.productName))];
  const unitOptions = useMemo(
    () => stockItems.filter((item) => item.productName === form.product).map((item) => item.unit),
    [stockItems, form.product]
  );
  const selectedStock = stockItems.find((item) => item.productName === form.product && item.unit === form.unit);

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unitInfo = commodityUnits.find((item) => item.value === unitValue);
    return isArabic ? (unitInfo?.arabicLabel || unitValue) : (unitInfo?.englishLabel || unitValue);
  }

  function handleProductChange(event) {
    const product = event.target.value;
    const selectedStock = stockItems.find((item) => item.productName === product);
    onChange({ target: { name: 'product', value: product } });
    onChange({ target: { name: 'category', value: selectedStock?.category || '' } });
    onChange({ target: { name: 'unit', value: selectedStock?.unit || '' } });
  }

  function handleUnitChange(event) {
    const unit = event.target.value;
    const selectedStock = stockItems.find((item) => item.productName === form.product && item.unit === unit);
    onChange({ target: { name: 'unit', value: unit } });
    onChange({ target: { name: 'category', value: selectedStock?.category || form.category } });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}
      {stockItems.length === 0 && (
        <div className="form-warning form-grid__wide">{t('warehouse.noStockToWithdraw')}</div>
      )}

      <label>
        {t('warehouse.warehouse')}
        <input value={warehouse?.warehouseName || ''} readOnly />
      </label>
      <label>
        {t('common.product')}
        <select name="product" value={form.product} onChange={handleProductChange}>
          {productOptions.map((product) => <option key={product} value={product}>{productLabel(product)}</option>)}
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
        <input name="quantity" type="number" min="0" step="0.001" value={form.quantity} onChange={onChange} placeholder="0" />
      </label>
      <label>
        {t('common.unit')}
        <select name="unit" value={form.unit} onChange={handleUnitChange}>
          {unitOptions.map((unit) => <option key={unit} value={unit}>{unitLabel(unit)}</option>)}
        </select>
      </label>
      <div className="withdraw-available-note">
        <span>{t('warehouse.availableStock')}</span>
        <strong>{Number(selectedStock?.quantity || 0).toLocaleString()} {form.unit ? unitLabel(form.unit) : ''}</strong>
      </div>
      <label className="form-grid__wide">
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('warehouse.withdrawNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('warehouse.withdrawStock')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
