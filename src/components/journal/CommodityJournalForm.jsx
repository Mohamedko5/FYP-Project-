import { useEffect } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels } from '../../data/dummyData.js';

export default function CommodityJournalForm({ form, errors, isEditing, products, units, isArabic, onChange, onSubmit, onCancel, t, statusLabel }) {
  const unitOptionsByProduct = {
    'White Sesame': ['Qintar'],
    'Red Sesame': ['Qintar'],
    Corn: ['Large Bag', 'Small Bag'],
    Dabara: ['Piece'],
    'Sacks / Khaysh': ['Bale', 'Number of Sacks'],
    Plastic: ['Roll', 'Meter', 'Bale'],
  };

  const selectedUnitValues = unitOptionsByProduct[form.product] || [];
  const selectedUnitOptions = units.filter((unit) => selectedUnitValues.includes(unit.value));

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unit) {
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

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
        {t('common.date')}
        <input name="date" type="date" value={form.date} onChange={onChange} />
      </label>
      <label>
        {t('common.productName')}
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
          {selectedUnitOptions.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unitLabel(unit)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('common.customerSupplier')}
        <input name="party" value={form.party} onChange={onChange} placeholder={t('journal.partyPlaceholder')} />
      </label>
      <label>
        {t('journal.lahuAlayh')}
        <select name="lahuWaAlayh" value={form.lahuWaAlayh} onChange={onChange}>
          <option value="Lahu">{statusLabel('Lahu')}</option>
          <option value="Alayh">{statusLabel('Alayh')}</option>
        </select>
      </label>
      <label>
        {t('journal.estimatedValue')}
        <input name="estimatedValue" type="number" min="0" value={form.estimatedValue} onChange={onChange} placeholder="0" />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{isEditing ? t('journal.saveChanges') : t('journal.saveCommodityTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
