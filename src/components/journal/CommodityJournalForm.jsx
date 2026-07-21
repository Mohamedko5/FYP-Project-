import { useEffect, useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export default function CommodityJournalForm({ form, errors, isEditing, isSaving = false, products, isArabic, onChange, onSubmit, onCancel, t }) {
  const unitOptionsByProduct = {
    'White Sesame': ['Qintar'],
    'Red Sesame': ['Qintar'],
    Corn: ['KG', 'Bag'],
    Dabara: ['Bale', 'Unit'],
    'Sacks / Khaysh': ['Bale', 'Unit'],
    Plastic: ['Bale', 'Unit'],
  };

  const unitLabels = {
    Qintar: { en: 'Qintar', ar: commodityUnits.find((unit) => unit.value === 'Qintar')?.arabicLabel || 'Qintar' },
    KG: { en: 'KG', ar: 'KG' },
    Bag: { en: 'Bag', ar: 'Bag' },
    Bale: { en: 'Bale', ar: commodityUnits.find((unit) => unit.value === 'Bale')?.arabicLabel || 'Bale' },
    Unit: { en: 'Unit', ar: commodityUnits.find((unit) => unit.value === 'Piece')?.arabicLabel || 'Unit' },
  };

  const selectedUnitValues = unitOptionsByProduct[form.product] || [];
  const selectedUnitOptions = useMemo(() => selectedUnitValues.map((value) => ({
    value,
    label: unitLabels[value]?.[isArabic ? 'ar' : 'en'] || value,
  })), [selectedUnitValues, isArabic]);

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
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
        {t('common.productName')}
        <select name="product" value={form.product} onChange={handleProductChange}>
          {products.map((product) => <option key={product.id} value={product.name}>{productLabel(product.name)}</option>)}
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
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('common.customerSupplier')}
        <input name="party" value={form.party} onChange={onChange} placeholder={t('journal.partyPlaceholder')} />
      </label>
      <label>
        {t('journal.estimatedValue')}
        <input name="estimatedValue" type="number" min="0" step="0.01" value={form.estimatedValue} onChange={onChange} placeholder="0" />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : isEditing ? t('journal.saveChanges') : t('journal.saveCommodityTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
