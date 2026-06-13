import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import InventoryMovementHistory from '../components/warehouse/InventoryMovementHistory.jsx';
import StockForm from '../components/warehouse/StockForm.jsx';
import WarehouseDetails from '../components/warehouse/WarehouseDetails.jsx';
import WarehouseForm from '../components/warehouse/WarehouseForm.jsx';
import WithdrawStockForm from '../components/warehouse/WithdrawStockForm.jsx';
import {
  getAvailableCapacity,
  getProductCategory,
  getUnitOptions,
  getUsagePercent,
} from '../components/warehouse/warehouseUtils.js';
import {
  commodityProductLabels,
  commodityUnits,
  inventoryMovementHistory,
  products,
  warehouseUnitOptionsByProduct,
  warehouses,
} from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function createWarehouseForm() {
  return {
    warehouseName: '',
    location: '',
    productType: 'White Sesame',
    capacity: '',
    capacityUnit: 'Qintar',
    managerName: '',
    guardName: '',
    notes: '',
  };
}

function createStockForm(warehouseId = '') {
  return {
    warehouseId,
    product: 'White Sesame',
    category: 'Commodity',
    driverName: '',
    quantity: '',
    unit: 'Qintar',
    notes: '',
  };
}

function createWithdrawForm(warehouse) {
  const firstStock = warehouse?.storedProducts?.[0];
  return {
    warehouseId: warehouse?.id || '',
    product: firstStock?.productName || '',
    category: firstStock?.category || '',
    driverName: '',
    quantity: '',
    unit: firstStock?.unit || '',
    notes: '',
  };
}

function createStockFormForWarehouse(warehouse, fallbackWarehouseId = '') {
  if (!warehouse) return createStockForm(fallbackWarehouseId);
  const firstUnit = getUnitOptions(warehouseUnitOptionsByProduct, warehouse.productType)[0]?.value || '';

  return {
    ...createStockForm(warehouse.id),
    product: warehouse.productType,
    category: getProductCategory(products, warehouse.productType),
    unit: firstUnit,
  };
}

function updateStoredProduct(items, stockItem, operation = 'add') {
  const quantity = Number(stockItem.quantity);
  const existingItem = items.find(
    (item) => item.productName === stockItem.product && item.unit === stockItem.unit
  );

  if (existingItem) {
    return items.map((item) => {
      if (item.id !== existingItem.id) return item;
      const nextQuantity = operation === 'add'
        ? Number(item.quantity) + quantity
        : Number(item.quantity) - quantity;
      return { ...item, quantity: Math.max(nextQuantity, 0) };
    }).filter((item) => Number(item.quantity) > 0);
  }

  if (operation === 'remove') return items;

  return [
    ...items,
    {
      id: Date.now(),
      productName: stockItem.product,
      category: stockItem.category,
      quantity,
      unit: stockItem.unit,
      minimumThreshold: 50,
    },
  ];
}

function hasEnoughStock(warehouse, product, unit, quantity) {
  const stockItem = warehouse.storedProducts.find((item) => item.productName === product && item.unit === unit);
  return Number(stockItem?.quantity || 0) >= Number(quantity);
}

export default function WarehouseInventory() {
  const { t, isArabic } = useLanguage();
  const [warehouseList, setWarehouseList] = useState(warehouses);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [warehouseForm, setWarehouseForm] = useState(createWarehouseForm());
  const [stockForm, setStockForm] = useState(createStockForm(''));
  const [withdrawForm, setWithdrawForm] = useState(createWithdrawForm(null));
  const [activeForm, setActiveForm] = useState(null);
  const [warehouseErrors, setWarehouseErrors] = useState([]);
  const [stockErrors, setStockErrors] = useState([]);
  const [stockWarning, setStockWarning] = useState('');
  const [withdrawErrors, setWithdrawErrors] = useState([]);
  const [movementHistory, setMovementHistory] = useState(inventoryMovementHistory);

  const selectedWarehouse = useMemo(
    () => warehouseList.find((warehouse) => String(warehouse.id) === String(selectedWarehouseId)),
    [warehouseList, selectedWarehouseId]
  );
  const selectedMovementHistory = useMemo(
    () => movementHistory.filter((movement) => String(movement.warehouseId) === String(selectedWarehouseId)),
    [movementHistory, selectedWarehouseId]
  );

  function handleWarehouseChange(event) {
    const { name, value } = event.target;
    setWarehouseForm((current) => ({ ...current, [name]: value }));
  }

  function handleStockChange(event) {
    const { name, value } = event.target;
    setStockWarning('');

    if (name === 'warehouseId') {
      const nextWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(value));
      setStockForm(createStockFormForWarehouse(nextWarehouse, value));
      return;
    }

    setStockForm((current) => ({ ...current, [name]: value }));
  }

  function selectWarehouse(warehouseId) {
    const nextWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(warehouseId));
    setSelectedWarehouseId(warehouseId);
    setStockForm(createStockFormForWarehouse(nextWarehouse, warehouseId));
    setWithdrawForm(createWithdrawForm(nextWarehouse));
    setActiveForm(null);
  }

  function openWarehouseForm() {
    setWarehouseErrors([]);
    setWarehouseForm(createWarehouseForm());
    setActiveForm('warehouse');
  }

  function openStockForm() {
    if (!selectedWarehouse) return;
    setStockErrors([]);
    setStockWarning('');
    setStockForm(createStockFormForWarehouse(selectedWarehouse, selectedWarehouseId));
    setActiveForm('stock');
  }

  function openWithdrawForm() {
    if (!selectedWarehouse) return;
    setWithdrawErrors([]);
    setWithdrawForm(createWithdrawForm(selectedWarehouse));
    setActiveForm('withdraw');
  }

  function closeActiveForm() {
    setActiveForm(null);
    setWarehouseErrors([]);
    setStockErrors([]);
    setStockWarning('');
    setWithdrawErrors([]);
  }

  function handleAddWarehouse(event) {
    event.preventDefault();
    const errors = [];

    if (!warehouseForm.warehouseName.trim()) errors.push(t('warehouse.warehouseRequired'));
    if (!warehouseForm.location.trim()) errors.push(t('warehouse.locationRequired'));
    if (!warehouseForm.managerName.trim()) errors.push(t('warehouse.managerRequired'));
    if (!warehouseForm.guardName.trim()) errors.push(t('warehouse.guardRequired'));
    if (!warehouseForm.capacity || Number(warehouseForm.capacity) <= 0) errors.push(t('warehouse.capacityPositive'));

    if (errors.length > 0) {
      setWarehouseErrors(errors);
      return;
    }

    const newWarehouse = {
      id: Date.now(),
      name: warehouseForm.warehouseName,
      warehouseName: warehouseForm.warehouseName,
      location: warehouseForm.location,
      capacity: Number(warehouseForm.capacity),
      capacityUnit: warehouseForm.capacityUnit,
      productType: warehouseForm.productType,
      managerName: warehouseForm.managerName,
      guardName: warehouseForm.guardName,
      notes: warehouseForm.notes || t('warehouse.noNotes'),
      currentStock: 0,
      status: 'Available',
      storedProducts: [],
    };

    setWarehouseList((current) => [...current, newWarehouse]);
    setWarehouseForm(createWarehouseForm());
    setWarehouseErrors([]);
    setSelectedWarehouseId(newWarehouse.id);
    setStockForm(createStockFormForWarehouse(newWarehouse, newWarehouse.id));
    setWithdrawForm(createWithdrawForm(newWarehouse));
    setActiveForm(null);
  }

  function saveStockToWarehouse(warehouseId, stockItem) {
    setWarehouseList((current) => current.map((warehouse) => {
      if (String(warehouse.id) !== String(warehouseId)) return warehouse;
      const storedProducts = updateStoredProduct(warehouse.storedProducts, stockItem, 'add');
      return {
        ...warehouse,
        storedProducts,
        currentStock: storedProducts.reduce((sum, item) => sum + Number(item.quantity), 0),
      };
    }));
  }

  function removeStockFromWarehouse(warehouseId, stockItem) {
    setWarehouseList((current) => current.map((warehouse) => {
      if (String(warehouse.id) !== String(warehouseId)) return warehouse;
      const storedProducts = updateStoredProduct(warehouse.storedProducts, stockItem, 'remove');
      return {
        ...warehouse,
        storedProducts,
        currentStock: storedProducts.reduce((sum, item) => sum + Number(item.quantity), 0),
      };
    }));
  }

  function recordMovement(type, warehouse, form) {
    const timestamp = getCurrentDateTime();
    setMovementHistory((current) => [
      {
        id: Date.now(),
        warehouseId: warehouse.id,
        warehouseName: warehouse.warehouseName,
        type,
        product: form.product,
        quantity: Number(form.quantity),
        unit: form.unit,
        date: timestamp.date,
        time: timestamp.time,
        adminName: t('admin'),
        driverName: form.driverName || '',
        notes: form.notes || t('warehouse.noNotes'),
      },
      ...current,
    ]);
  }

  function handleAddStock(event) {
    event.preventDefault();
    const errors = [];
    const targetWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(stockForm.warehouseId));
    const quantity = Number(stockForm.quantity);

    if (!targetWarehouse) errors.push(t('warehouse.selectWarehouseError'));
    if (!stockForm.product) errors.push(t('warehouse.productRequired'));
    if (!stockForm.unit) errors.push(t('warehouse.unitRequired'));
    if (!stockForm.quantity || quantity <= 0) errors.push(t('warehouse.quantityPositive'));

    if (targetWarehouse && quantity > getAvailableCapacity(targetWarehouse)) {
      errors.push(`${t('warehouse.quantityExceedsCapacity')} ${getAvailableCapacity(targetWarehouse).toLocaleString()} ${targetWarehouse.capacityUnit}.`);
    }

    if (errors.length > 0) {
      setStockErrors(errors);
      return;
    }

    const usageAfterSave = ((targetWarehouse.currentStock + quantity) / Number(targetWarehouse.capacity)) * 100;
    if (usageAfterSave >= 80 && usageAfterSave < 100 && !stockWarning) {
      setStockWarning(t('warehouse.confirmAlmostFull'));
      return;
    }

    saveStockToWarehouse(stockForm.warehouseId, stockForm);
    recordMovement('Add Stock', targetWarehouse, stockForm);
    setStockErrors([]);
    setStockWarning('');
    setStockForm(createStockForm(stockForm.warehouseId));
    setActiveForm(null);
  }

  function handleWithdrawChange(event) {
    const { name, value } = event.target;
    setWithdrawForm((current) => ({ ...current, [name]: value }));
  }

  function handleWithdrawSubmit(event) {
    event.preventDefault();
    const errors = [];
    const quantity = Number(withdrawForm.quantity);
    const fromWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(withdrawForm.warehouseId));
    const stockItem = {
      product: withdrawForm.product,
      category: getProductCategory(products, withdrawForm.product),
      quantity,
      unit: withdrawForm.unit,
    };

    if (!fromWarehouse) errors.push(t('warehouse.selectWarehouseError'));
    if (!withdrawForm.product) errors.push(t('warehouse.productRequired'));
    if (!withdrawForm.unit) errors.push(t('warehouse.unitRequired'));
    if (!withdrawForm.quantity || quantity <= 0) errors.push(t('warehouse.quantityPositive'));
    if (fromWarehouse && !hasEnoughStock(fromWarehouse, withdrawForm.product, withdrawForm.unit, quantity)) {
      errors.push(t('warehouse.notEnoughStock'));
    }

    if (errors.length > 0) {
      setWithdrawErrors(errors);
      return;
    }

    removeStockFromWarehouse(withdrawForm.warehouseId, stockItem);
    recordMovement('Withdraw Stock', fromWarehouse, withdrawForm);
    setWithdrawErrors([]);
    setWithdrawForm(createWithdrawForm(fromWarehouse));
    setActiveForm(null);
  }

  const selectedUsage = selectedWarehouse ? getUsagePercent(selectedWarehouse) : 0;
  const selectedProductLabel = selectedWarehouse
    ? commodityProductLabels[selectedWarehouse.productType]?.[isArabic ? 'ar' : 'en'] || selectedWarehouse.productType
    : '';
  const selectedCapacityUnit = selectedWarehouse
    ? commodityUnits.find((unit) => unit.value === selectedWarehouse.capacityUnit)
    : null;
  const selectedCapacityUnitLabel = selectedWarehouse
    ? (isArabic ? (selectedCapacityUnit?.arabicLabel || selectedWarehouse.capacityUnit) : selectedWarehouse.capacityUnit)
    : '';

  return (
    <div className="page-grid">
      <Card title={t('warehouse.overviewTitle')} subtitle={t('warehouse.overviewSubtitle')} className="warehouse-overview-card">
        <div className="warehouse-overview-header">
          <label>
            {t('warehouse.selectWarehouse')}
            <select value={selectedWarehouseId} onChange={(event) => selectWarehouse(event.target.value)}>
              <option value="">{t('warehouse.selectWarehousePlaceholder')}</option>
              {warehouseList.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouseName} - {warehouse.location}
                </option>
              ))}
            </select>
          </label>
          {selectedWarehouse && (
            <p className="warehouse-helper">
              {t('warehouse.selectedWarehouseStores')} {selectedProductLabel}. {t('warehouse.capacityUnit')}: {selectedCapacityUnitLabel}.
            </p>
          )}
        </div>

        <div className="warehouse-add-new-section warehouse-add-new-section--top">
          {activeForm !== 'warehouse' && (
            <Button variant="secondary" onClick={openWarehouseForm}>{t('warehouse.actionAddNewWarehouse')}</Button>
          )}
        </div>

        {activeForm === 'warehouse' ? (
          <div className="warehouse-inline-form">
            <Card className="warehouse-action-form" title={t('warehouse.addWarehouseTitle')} subtitle={t('warehouse.addWarehouseSubtitle')}>
              <WarehouseForm
                form={warehouseForm}
                errors={warehouseErrors}
                products={products}
                unitRules={warehouseUnitOptionsByProduct}
                onChange={handleWarehouseChange}
                onSubmit={handleAddWarehouse}
                onCancel={closeActiveForm}
              />
            </Card>
          </div>
        ) : !selectedWarehouse ? (
          <div className="warehouse-empty-state">{t('warehouse.selectWarehousePrompt')}</div>
        ) : (
          <>
            {selectedWarehouse && selectedUsage >= 80 && selectedUsage < 100 && (
              <div className="form-warning warehouse-alert">
                {selectedWarehouse.warehouseName} {t('warehouse.almostFullAlert')}
              </div>
            )}
            {selectedWarehouse && selectedUsage >= 100 && (
              <div className="form-error warehouse-alert">
                <p>{selectedWarehouse.warehouseName} {t('warehouse.fullAlert')}</p>
              </div>
            )}
            <WarehouseDetails
              warehouse={selectedWarehouse}
              actionSlot={(
                <>
                  <Button onClick={openStockForm}>{t('warehouse.actionAddStock')}</Button>
                  <Button variant="secondary" onClick={openWithdrawForm}>{t('warehouse.actionWithdrawStock')}</Button>
                </>
              )}
            />
            <InventoryMovementHistory movements={selectedMovementHistory} />
          </>
        )}
      </Card>

      {activeForm === 'stock' && (
        <Card className="warehouse-action-form" title={t('warehouse.addStockTitle')} subtitle={t('warehouse.addStockSubtitle')}>
          <StockForm
            form={stockForm}
            errors={stockErrors}
            warning={stockWarning}
            warehouses={selectedWarehouse ? [selectedWarehouse] : []}
            products={products}
            unitRules={warehouseUnitOptionsByProduct}
            onChange={handleStockChange}
            onSubmit={handleAddStock}
            onCancel={closeActiveForm}
          />
        </Card>
      )}

      {activeForm === 'withdraw' && (
        <Card className="warehouse-action-form" title={t('warehouse.withdrawStockTitle')} subtitle={t('warehouse.withdrawStockSubtitle')}>
          <WithdrawStockForm
            form={withdrawForm}
            errors={withdrawErrors}
            warehouse={selectedWarehouse}
            onChange={handleWithdrawChange}
            onSubmit={handleWithdrawSubmit}
            onCancel={closeActiveForm}
          />
        </Card>
      )}
    </div>
  );
}
