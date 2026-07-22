import { useEffect, useMemo } from 'react';
import Button from '../ui/Button.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export default function CommodityJournalForm({ form, errors, isEditing, isSaving = false, products = [], warehouses = [], stockItems = [], isArabic, onChange, onSubmit, onCancel, t }) {
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

  function getProductName(product) {
    return product.name_en || product.name || product.product_name || '';
  }

  function getProductUnits(product) {
    if (Array.isArray(product.units) && product.units.length > 0) {
      return product.units.map((unit) => unit.unit || unit.value || unit).filter(Boolean);
    }
    return unitOptionsByProduct[getProductName(product)] || [];
  }

  const selectedProduct = products.find((product) => String(product.id) === String(form.productId));
  const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === String(form.warehouseId));
  const stockForWarehouse = stockItems.filter((item) => String(item.warehouse) === String(form.warehouseId) && Number(item.quantity || 0) > 0);
  const selectedStock = stockForWarehouse.find((item) => String(item.product_id || item.product?.id) === String(form.productId));
  const selectedUnitValues = form.warehouseOperation === 'manual_withdrawal'
    ? [selectedStock?.unit].filter(Boolean)
    : getProductUnits(selectedProduct || {});
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
    const [nextProductId, selectedUnit] = event.target.value.split('|');
    const nextProduct = products.find((product) => String(product.id) === String(nextProductId));
    const warehouseStock = stockItems.find((item) => (
      String(item.warehouse) === String(form.warehouseId)
      && String(item.product_id || item.product?.id) === String(nextProductId)
      && (!selectedUnit || item.unit === selectedUnit)
    ));
    const firstUnit = form.warehouseOperation === 'manual_withdrawal'
      ? warehouseStock?.unit || ''
      : getProductUnits(nextProduct || {})[0] || '';
    changeField('productId', nextProductId);
    changeField('product', getProductName(nextProduct || {}));
    changeField('unit', firstUnit);
  }

  function handleOperationChange(event) {
    changeField('warehouseOperation', event.currentTarget.value);
    changeField('productId', '');
    changeField('product', '');
    changeField('unit', '');
    changeField('quantity', '');
  }

  function handleOperationKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const nextOperation = form.warehouseOperation === 'stock_in' ? 'manual_withdrawal' : 'stock_in';
    changeField('warehouseOperation', nextOperation);
    changeField('productId', '');
    changeField('product', '');
    changeField('unit', '');
    changeField('quantity', '');
  }

  useEffect(() => {
    if (selectedUnitOptions.length > 0 && !selectedUnitOptions.some((unit) => unit.value === form.unit)) {
      changeField('unit', selectedUnitOptions[0].value);
    }
  }, [form.productId, form.unit, selectedUnitOptions]);

  const projectedQuantity = selectedStock ? Number(selectedStock.quantity || 0) - Number(form.quantity || 0) : null;
  const projectedUsedCapacity = selectedWarehouse ? Number(selectedWarehouse.used_capacity || 0) + Number(form.quantity || 0) : null;
  const projectedUsagePercent = selectedWarehouse && Number(selectedWarehouse.capacity || 0) > 0
    ? (projectedUsedCapacity / Number(selectedWarehouse.capacity || 1)) * 100
    : null;
  const withdrawalInvalid = form.warehouseOperation === 'manual_withdrawal' && selectedStock && Number(form.quantity || 0) > Number(selectedStock.quantity || 0);
  const isWithdrawal = form.warehouseOperation === 'manual_withdrawal';
  const currentStock = selectedStock ? Number(selectedStock.quantity || 0) : 0;
  const newStock = isWithdrawal ? projectedQuantity : currentStock + Number(form.quantity || 0);
  const saveLabel = isWithdrawal ? t('journal.confirmWithdrawal') : t('journal.addStockAction');

  return (
    <form className="warehouse-transaction-form" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <div className="warehouse-operation-segment" role="radiogroup" aria-label={t('journal.warehouseOperation')}>
        <button
          type="button"
          role="radio"
          aria-checked={form.warehouseOperation === 'stock_in'}
          className={form.warehouseOperation === 'stock_in' ? 'is-active' : ''}
          value="stock_in"
          onClick={handleOperationChange}
          onKeyDown={handleOperationKeyDown}
          disabled={isEditing}
        >
          <span aria-hidden="true">+</span>
          {t('journal.addStock')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={form.warehouseOperation === 'manual_withdrawal'}
          className={form.warehouseOperation === 'manual_withdrawal' ? 'is-active' : ''}
          value="manual_withdrawal"
          onClick={handleOperationChange}
          onKeyDown={handleOperationKeyDown}
          disabled={isEditing}
        >
          <span aria-hidden="true">-</span>
          {t('journal.withdrawStock')}
        </button>
      </div>

      <div className="warehouse-transaction-grid">
        <label>
          {t('journal.selectWarehouse')}
          <select name="warehouseId" value={form.warehouseId} onChange={onChange} disabled={isEditing}>
            <option value="">{t('journal.selectWarehouse')}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {isWithdrawal ? t('journal.availableInventoryItem') : t('common.productName')}
          <select
            name="productId"
            value={isWithdrawal && form.productId ? `${form.productId}|${form.unit}` : form.productId}
            onChange={handleProductChange}
            disabled={isEditing || !form.warehouseId}
          >
            <option value="">{t('journal.selectProduct')}</option>
            {(isWithdrawal ? stockForWarehouse : products).map((item) => {
              const product = item.product || item;
              const id = item.product_id || product.id;
              const name = item.product_name || getProductName(product);
              const value = isWithdrawal ? `${id}|${item.unit}` : id;
              const label = isWithdrawal ? `${productLabel(name)} - ${item.quantity} ${item.unit}` : productLabel(name);
              return <option key={`${id}-${item.unit || ''}`} value={value}>{label}</option>;
            })}
          </select>
        </label>

        <label>
          {t('common.unit')}
          <select name="unit" value={form.unit} onChange={onChange} disabled={isEditing || isWithdrawal}>
            <option value="">{t('common.unit')}</option>
            {selectedUnitOptions.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {isWithdrawal ? t('journal.withdrawalQuantity') : t('common.quantity')}
          <input name="quantity" type="number" min="0" step="0.001" value={form.quantity} onChange={onChange} placeholder="0" />
        </label>

        <label>
          {isWithdrawal ? t('journal.partyDestination') : t('common.customerSupplier')}
          <input name="party" value={form.party} onChange={onChange} placeholder={t('journal.partyPlaceholder')} />
        </label>

        <label>
          {t('journal.estimatedValueOptional')}
          <input name="estimatedValue" type="number" min="0" step="0.01" value={form.estimatedValue} onChange={onChange} placeholder="0" />
        </label>

        {!isWithdrawal && (
          <label>
            {t('journal.minimumStockThreshold')}
            <input name="minimumThreshold" type="number" min="0" step="0.001" value={form.minimumThreshold} onChange={onChange} placeholder="0" />
          </label>
        )}

        <label>
          {t('journal.driverNameOptional')}
          <input name="driverName" value={form.driverName} onChange={onChange} placeholder={t('journal.driverName')} />
        </label>

        <label className="warehouse-transaction-grid__wide">
          {isWithdrawal ? t('journal.withdrawalReason') : t('common.description')}
          <textarea name="description" value={form.description} onChange={onChange} placeholder={isWithdrawal ? t('journal.withdrawalReasonPlaceholder') : t('journal.descriptionPlaceholder')} />
        </label>
      </div>

      {selectedWarehouse && !isWithdrawal && (
        <div className={`journal-capacity-preview ${projectedUsagePercent >= 80 ? 'journal-capacity-preview--warning' : ''}`}>
          <span>{t('common.capacity')}: {selectedWarehouse.capacity || '0.000'} {selectedWarehouse.capacity_unit}</span>
          <span>{t('journal.usedCapacity')}: {selectedWarehouse.used_capacity || '0.000'} {selectedWarehouse.capacity_unit}</span>
          <span>{t('journal.availableCapacity')}: {selectedWarehouse.available_capacity || '0.000'} {selectedWarehouse.capacity_unit}</span>
          <span>{t('journal.projectedUsage')}: {projectedUsagePercent === null ? '-' : `${projectedUsagePercent.toFixed(2)}%`}</span>
        </div>
      )}

      {selectedStock && isWithdrawal && (
        <div className={`journal-capacity-preview ${withdrawalInvalid ? 'journal-capacity-preview--warning' : ''}`}>
          <span>{t('journal.availableStock')}: {selectedStock.quantity} {selectedStock.unit}</span>
          <span>{t('journal.remainingQuantity')}: {projectedQuantity === null ? '-' : projectedQuantity.toFixed(3)} {selectedStock.unit}</span>
        </div>
      )}

      <div className="warehouse-review-card" aria-live="polite">
        <strong>{t('journal.review')}</strong>
        <div>
          <span>{t('journal.warehouseOperation')}</span>
          <b>{isWithdrawal ? t('journal.withdrawStock') : t('journal.addStock')}</b>
        </div>
        <div>
          <span>{t('journal.selectWarehouse')}</span>
          <b>{selectedWarehouse?.warehouse_name || '-'}</b>
        </div>
        <div>
          <span>{t('common.product')}</span>
          <b>{form.product ? productLabel(form.product) : '-'}</b>
        </div>
        <div>
          <span>{isWithdrawal ? t('journal.currentQuantity') : t('journal.currentStock')}</span>
          <b>{selectedStock ? `${selectedStock.quantity} ${selectedStock.unit}` : '-'}</b>
        </div>
        <div>
          <span>{isWithdrawal ? t('journal.remainingQuantity') : t('journal.newStock')}</span>
          <b>{Number.isFinite(newStock) && form.quantity ? `${newStock.toFixed(3)} ${form.unit}` : '-'}</b>
        </div>
        <div>
          <span>{t('common.description')}</span>
          <b>{form.description || '-'}</b>
        </div>
      </div>

      <div className="warehouse-transaction-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
        <Button type="submit" disabled={isSaving || withdrawalInvalid}>{isSaving ? t('journal.saving') : saveLabel}</Button>
      </div>
    </form>
  );
}
