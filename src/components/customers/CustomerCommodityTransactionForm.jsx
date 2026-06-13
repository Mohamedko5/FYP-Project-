import { useEffect } from 'react';
import Button from '../ui/Button.jsx';
import { productLabel, unitLabel } from './customerHelpers.js';

const unitOptionsByProduct = {
  'White Sesame': ['Qintar'],
  'Red Sesame': ['Qintar'],
  Corn: ['Large Bag', 'Small Bag'],
  Dabara: ['Piece'],
  'Sacks / Khaysh': ['Bale', 'Number of Sacks'],
  Plastic: ['Roll', 'Meter', 'Bale'],
};

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
}) {
  const selectedUnitValues = unitOptionsByProduct[form.product] || [];
  const selectedUnitOptions = units.filter((unit) => selectedUnitValues.includes(unit.value));

  function changeField(name, value) {
    onChange({ target: { name, value } });
  }

  function handleProductChange(event) {
    const nextProduct = event.target.value;
    const firstUnit = unitOptionsByProduct[nextProduct]?.[0] || '';
    changeField('product', nextProduct);
    changeField('unit', firstUnit);
  }

  useEffect(() => {
    if (selectedUnitOptions.length > 0 && !selectedUnitOptions.some((unit) => unit.value === form.unit)) {
      changeField('unit', selectedUnitOptions[0].value);
    }
  }, [form.product, form.unit, selectedUnitOptions]);

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
          <option value="Product Received">{t('customers.productReceived')}</option>
          <option value="Product Delivered">{t('customers.productDelivered')}</option>
          <option value="Product Stored">{t('customers.productStored')}</option>
          <option value="Warehouse Withdrawal">{t('customers.productWithdrawn')}</option>
        </select>
      </label>
      <label>
        {t('common.product')}
        <select name="product" value={form.product} onChange={handleProductChange}>
          {products.map((product) => (
            <option key={product.id} value={product.name}>{productLabel(product.name, isArabic)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('common.quantity')}
        <input name="quantity" type="number" min="0" value={form.quantity} onChange={onChange} placeholder="0" />
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
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('journal.saveCommodityTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
