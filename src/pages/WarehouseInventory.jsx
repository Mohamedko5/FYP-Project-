import { useMemo, useState } from 'react';
import Card from '../components/ui/Card.jsx';
import StockForm from '../components/warehouse/StockForm.jsx';
import StockMovementForm from '../components/warehouse/StockMovementForm.jsx';
import WarehouseCard from '../components/warehouse/WarehouseCard.jsx';
import WarehouseDetails from '../components/warehouse/WarehouseDetails.jsx';
import WarehouseForm from '../components/warehouse/WarehouseForm.jsx';
import {
  getAvailableCapacity,
  getProductCategory,
  getUnitOptions,
  getUsagePercent,
} from '../components/warehouse/warehouseUtils.js';
import { commodityProductLabels, commodityUnits, products, warehouseUnitOptionsByProduct, warehouses } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const today = new Date().toISOString().slice(0, 10);

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
    quantity: '',
    unit: 'Qintar',
    date: today,
    notes: '',
  };
}

function createMovementForm(warehouseId = '', toWarehouseId = '') {
  return {
    movementType: 'Stock In',
    fromWarehouseId: warehouseId,
    toWarehouseId,
    product: 'White Sesame',
    quantity: '',
    unit: 'Qintar',
    date: today,
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
  const firstWarehouseId = warehouses[0]?.id || '';
  const secondWarehouseId = warehouses[1]?.id || firstWarehouseId;
  const [warehouseList, setWarehouseList] = useState(warehouses);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(firstWarehouseId);
  const [warehouseForm, setWarehouseForm] = useState(createWarehouseForm());
  const [stockForm, setStockForm] = useState(createStockForm(firstWarehouseId));
  const [movementForm, setMovementForm] = useState(createMovementForm(firstWarehouseId, secondWarehouseId));
  const [warehouseErrors, setWarehouseErrors] = useState([]);
  const [stockErrors, setStockErrors] = useState([]);
  const [stockWarning, setStockWarning] = useState('');
  const [movementErrors, setMovementErrors] = useState([]);
  const [movementMessage, setMovementMessage] = useState('');

  const selectedWarehouse = useMemo(
    () => warehouseList.find((warehouse) => String(warehouse.id) === String(selectedWarehouseId)),
    [warehouseList, selectedWarehouseId]
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

  function handleMovementChange(event) {
    const { name, value } = event.target;
    setMovementMessage('');
    setMovementForm((current) => ({ ...current, [name]: value }));
  }

  function selectWarehouse(warehouseId) {
    const nextWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(warehouseId));
    setSelectedWarehouseId(warehouseId);
    setStockForm(createStockFormForWarehouse(nextWarehouse, warehouseId));
    setMovementForm((current) => ({ ...current, fromWarehouseId: warehouseId }));
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
    selectWarehouse(newWarehouse.id);
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

  function handleAddStock(event) {
    event.preventDefault();
    const errors = [];
    const targetWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(stockForm.warehouseId));
    const quantity = Number(stockForm.quantity);

    if (!targetWarehouse) errors.push(t('warehouse.selectWarehouseError'));
    if (!stockForm.product) errors.push(t('warehouse.productRequired'));
    if (!stockForm.unit) errors.push(t('warehouse.unitRequired'));
    if (!stockForm.date) errors.push(t('warehouse.dateRequired'));
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
    setStockErrors([]);
    setStockWarning('');
    setStockForm(createStockForm(stockForm.warehouseId));
  }

  function handleMovementSubmit(event) {
    event.preventDefault();
    const errors = [];
    const quantity = Number(movementForm.quantity);
    const fromWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(movementForm.fromWarehouseId));
    const toWarehouse = warehouseList.find((warehouse) => String(warehouse.id) === String(movementForm.toWarehouseId));
    const stockItem = {
      product: movementForm.product,
      category: getProductCategory(products, movementForm.product),
      quantity,
      unit: movementForm.unit,
    };

    if (!fromWarehouse) errors.push(t('warehouse.selectWarehouseError'));
    if (!movementForm.product) errors.push(t('warehouse.productRequired'));
    if (!movementForm.unit) errors.push(t('warehouse.unitRequired'));
    if (!movementForm.date) errors.push(t('warehouse.dateRequired'));
    if (!movementForm.quantity || quantity <= 0) errors.push(t('warehouse.quantityPositive'));

    if (movementForm.movementType === 'Transfer') {
      if (!toWarehouse) errors.push(t('warehouse.destinationRequired'));
      if (movementForm.fromWarehouseId === movementForm.toWarehouseId) errors.push(t('warehouse.differentWarehouseRequired'));
    }

    if (['Stock Out', 'Transfer'].includes(movementForm.movementType) && fromWarehouse && !hasEnoughStock(fromWarehouse, movementForm.product, movementForm.unit, quantity)) {
      errors.push(t('warehouse.notEnoughStock'));
    }

    if (['Stock In', 'Transfer'].includes(movementForm.movementType)) {
      const receivingWarehouse = movementForm.movementType === 'Transfer' ? toWarehouse : fromWarehouse;
      if (receivingWarehouse && quantity > getAvailableCapacity(receivingWarehouse)) {
        errors.push(`${t('warehouse.quantityExceedsWarehouse')} ${receivingWarehouse.warehouseName}.`);
      }
    }

    if (errors.length > 0) {
      setMovementErrors(errors);
      return;
    }

    if (movementForm.movementType === 'Stock In') {
      saveStockToWarehouse(movementForm.fromWarehouseId, stockItem);
    }

    if (movementForm.movementType === 'Stock Out') {
      removeStockFromWarehouse(movementForm.fromWarehouseId, stockItem);
    }

    if (movementForm.movementType === 'Transfer') {
      removeStockFromWarehouse(movementForm.fromWarehouseId, stockItem);
      saveStockToWarehouse(movementForm.toWarehouseId, stockItem);
    }

    setMovementErrors([]);
    setMovementMessage(t('warehouse.stockMovementSuccess'));
    setMovementForm(createMovementForm(movementForm.fromWarehouseId, movementForm.toWarehouseId));
  }

  const selectedUsage = selectedWarehouse ? getUsagePercent(selectedWarehouse) : 0;
  const selectedUnitOptions = selectedWarehouse ? getUnitOptions(warehouseUnitOptionsByProduct, selectedWarehouse.productType) : [];
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
      <Card title={t('warehouse.addWarehouseTitle')} subtitle={t('warehouse.addWarehouseSubtitle')}>
        <WarehouseForm
          form={warehouseForm}
          errors={warehouseErrors}
          products={products}
          unitRules={warehouseUnitOptionsByProduct}
          onChange={handleWarehouseChange}
          onSubmit={handleAddWarehouse}
        />
      </Card>

      <Card title={t('warehouse.warehouseContainersTitle')} subtitle={t('warehouse.warehouseContainersSubtitle')}>
        <div className="warehouse-card-grid">
          {warehouseList.map((warehouse) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              isSelected={String(selectedWarehouseId) === String(warehouse.id)}
              onSelect={selectWarehouse}
            />
          ))}
        </div>
      </Card>

      <Card title={t('warehouse.warehouseDetailsTitle')} subtitle={t('warehouse.warehouseDetailsSubtitle')}>
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
        <WarehouseDetails warehouse={selectedWarehouse} />
      </Card>

      <div className="two-column">
        <Card title={t('warehouse.addStockTitle')} subtitle={t('warehouse.addStockSubtitle')}>
          {selectedWarehouse && selectedUnitOptions.length > 0 && (
            <p className="warehouse-helper">
              {t('warehouse.selectedWarehouseStores')} {selectedProductLabel}. {t('warehouse.capacityUnit')}: {selectedCapacityUnitLabel}.
            </p>
          )}
          <StockForm
            form={stockForm}
            errors={stockErrors}
            warning={stockWarning}
            warehouses={warehouseList}
            products={products}
            unitRules={warehouseUnitOptionsByProduct}
            onChange={handleStockChange}
            onSubmit={handleAddStock}
          />
        </Card>

        <Card title={t('warehouse.stockMovementTitle')} subtitle={t('warehouse.stockMovementSubtitle')}>
          {movementMessage && <div className="form-success">{movementMessage}</div>}
          <StockMovementForm
            form={movementForm}
            errors={movementErrors}
            warehouses={warehouseList}
            products={products}
            unitRules={warehouseUnitOptionsByProduct}
            onChange={handleMovementChange}
            onSubmit={handleMovementSubmit}
          />
        </Card>
      </div>
    </div>
  );
}
