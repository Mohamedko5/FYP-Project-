import { useEffect } from 'react';
import Button from '../ui/Button.jsx';
import { productLabel, unitLabel } from './customerHelpers.js';

export default function CustomerCommodityTransactionForm({
  form,
  errors,
  customerName,
  products,
  units,
  isArabic,
  onChange,
  onSubmit,
  onCancel,
  t,
  isSaving = false,
}) {
  const selectedProduct = products.find((product) => String(product.id) === String(form.productId));
  const selectedUnitOptions = selectedProduct?.units || [];

  function changeField(name, value) {
    onChange({ target: { name, value } });
  }

  function handleProductChange(event) {
    const nextProductId = event.target.value;
    const product = products.find((item) => String(item.id) === String(nextProductId));
    const firstUnit = product?.units?.[0]?.value || '';
    changeField('productId', nextProductId);
    changeField('unit', firstUnit);
  }

  useEffect(() => {
    if (selectedUnitOptions.length > 0 && !selectedUnitOptions.some((unit) => unit.value === form.unit)) {
      changeField('unit', selectedUnitOptions[0].value);
    }
  }, [form.productId, form.unit, selectedUnitOptions]);

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('journal.transactionType')}
        <select name="transactionType" value={form.transactionType} onChange={onChange}>
          <option value="product_received">{t('customers.productReceived')}</option>
          <option value="product_delivered">{t('customers.productDelivered')}</option>
        </select>
      </label>
      <label>
        {t('common.product')}
        <select name="productId" value={form.productId} onChange={handleProductChange}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{productLabel(product.name, isArabic)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('common.quantity')}
        <input name="quantity" type="number" min="0" step="0.001" value={form.quantity} onChange={onChange} placeholder="0" />
      </label>
      <label>
        {t('common.unit')}
        <select name="unit" value={form.unit} onChange={onChange}>
          {selectedUnitOptions.map((unit) => (
            <option key={unit.value} value={unit.value}>{unitLabel(unit.value, isArabic)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('common.customerName')}
        <input name="customer" value={customerName} readOnly />
      </label>
      <label>
        {t('journal.estimatedValue')}
        <input name="estimatedValue" type="number" min="0" step="0.01" value={form.estimatedValue || ''} onChange={onChange} placeholder="0" />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('journal.saveCommodityTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
