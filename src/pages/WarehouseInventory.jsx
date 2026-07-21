import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import PrintableWarehouseInventory from '../components/reports/PrintableWarehouseInventory.jsx';
import InventoryMovementHistory from '../components/warehouse/InventoryMovementHistory.jsx';
import StockForm from '../components/warehouse/StockForm.jsx';
import WarehouseDetails from '../components/warehouse/WarehouseDetails.jsx';
import WarehouseForm from '../components/warehouse/WarehouseForm.jsx';
import WithdrawStockForm from '../components/warehouse/WithdrawStockForm.jsx';
import { getAvailableCapacity, getProductCategory, getUnitOptions } from '../components/warehouse/warehouseUtils.js';
import { commodityProductLabels } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  addStock,
  createWarehouse,
  getProducts,
  getWarehouse,
  getWarehouseMovements,
  getWarehouses,
  withdrawStock,
} from '../services/inventoryApi.js';

const unitLabels = {
  Qintar: { en: 'Qintar', ar: 'قنطار' },
  KG: { en: 'KG', ar: 'كيلو' },
  Bag: { en: 'Bag', ar: 'جوال' },
  Bale: { en: 'Bale', ar: 'بالة' },
  Unit: { en: 'Unit', ar: 'وحدة' },
};

function createWarehouseForm() {
  return {
    warehouseName: '',
    location: '',
    productType: '',
    capacity: '',
    capacityUnit: '',
    managerName: '',
    guardName: '',
    notes: '',
  };
}

function createStockForm(warehouseId = '', product = '', unit = '') {
  return {
    warehouseId,
    product,
    category: '',
    driverName: '',
    quantity: '',
    unit,
    minimumThreshold: '0',
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

function storedAdminName() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user.username || user.email || 'Bayad Admin';
  } catch {
    return 'Bayad Admin';
  }
}

function formatApiError(error) {
  return String(error?.message || 'Unable to complete this request. Please try again.')
    .split('\n')
    .filter(Boolean);
}

function mapProduct(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name_en,
    name_en: row.name_en,
    name_ar: row.name_ar,
    category: row.category === 'supply' ? 'Supply' : 'Commodity',
    units: row.units || [],
  };
}

function mapWarehouse(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.warehouse_name,
    warehouseName: row.warehouse_name,
    location: row.location,
    capacity: Number(row.capacity),
    capacityUnit: row.capacity_unit,
    productType: row.primary_product?.name_en || '',
    primaryProductId: row.primary_product?.id,
    managerName: row.manager_name,
    guardName: row.guard_name,
    notes: row.notes || '',
    currentStock: Number(row.used_capacity || 0),
    usedCapacity: Number(row.used_capacity || 0),
    availableCapacity: Number(row.available_capacity || 0),
    usagePercent: Number(row.usage_percent || 0),
    status: row.status,
    storedProducts: (row.inventory_items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      category: item.product?.category === 'supply' ? 'Supply' : 'Commodity',
      quantity: Number(item.quantity),
      unit: item.unit,
      minimumThreshold: Number(item.minimum_threshold),
      status: item.status,
    })),
  };
}

function movementLabel(type) {
  const labels = {
    stock_in: 'Add Stock',
    manual_withdrawal: 'Withdraw Stock',
    shipment_out: 'Shipment Out',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    adjustment_in: 'Adjustment In',
    adjustment_out: 'Adjustment Out',
  };
  return labels[type] || type;
}

function mapMovement(row) {
  return {
    id: row.id,
    warehouseId: row.warehouse,
    warehouseName: row.warehouse_name,
    type: movementLabel(row.movement_type),
    product: row.product_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    date: row.date,
    time: row.time,
    adminName: row.administrator_name,
    driverName: row.driver_name || '',
    notes: row.notes || '',
  };
}

function productUnitRules(products) {
  return products.reduce((rules, product) => ({
    ...rules,
    [product.name]: product.units.map((unit) => ({
      value: unit.unit,
      label: unitLabels[unit.unit]?.en || unit.unit,
      arabicLabel: unitLabels[unit.unit]?.ar || unit.unit,
    })),
  }), {});
}

export default function WarehouseInventory() {
  const { t, isArabic } = useLanguage();
  const [productRows, setProductRows] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseForm, setWarehouseForm] = useState(createWarehouseForm());
  const [stockForm, setStockForm] = useState(createStockForm());
  const [withdrawForm, setWithdrawForm] = useState(createWithdrawForm(null));
  const [activeForm, setActiveForm] = useState(null);
  const [warehouseErrors, setWarehouseErrors] = useState([]);
  const [stockErrors, setStockErrors] = useState([]);
  const [stockWarning, setStockWarning] = useState('');
  const [withdrawErrors, setWithdrawErrors] = useState([]);
  const [movementHistory, setMovementHistory] = useState([]);
  const [filters, setFilters] = useState({ search: '', product: '', status: '' });
  const [movementFilters, setMovementFilters] = useState({ movement_type: '', date_from: '', date_to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMovementLoading, setIsMovementLoading] = useState(false);
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [isWithdrawingStock, setIsWithdrawingStock] = useState(false);
  const [apiError, setApiError] = useState('');
  const [adminName] = useState(storedAdminName);

  const unitRules = useMemo(() => productUnitRules(productRows), [productRows]);

  const selectedProductLabel = selectedWarehouse
    ? commodityProductLabels[selectedWarehouse.productType]?.[isArabic ? 'ar' : 'en'] || selectedWarehouse.productType
    : '';
  const selectedCapacityUnitLabel = selectedWarehouse
    ? (isArabic ? (unitLabels[selectedWarehouse.capacityUnit]?.ar || selectedWarehouse.capacityUnit) : selectedWarehouse.capacityUnit)
    : '';

  const loadProductsAndWarehouses = useCallback(async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const [productsData, warehousesData] = await Promise.all([
        getProducts({ active: 'true' }),
        getWarehouses(filters),
      ]);
      const mappedProducts = productsData.map(mapProduct);
      const mappedWarehouses = warehousesData.map(mapWarehouse);
      setProductRows(mappedProducts);
      setWarehouseList(mappedWarehouses);
      if (!selectedWarehouseId && mappedWarehouses[0]) {
        setSelectedWarehouseId(String(mappedWarehouses[0].id));
      }
      if (mappedProducts[0] && !warehouseForm.productType) {
        const firstUnit = mappedProducts[0].units[0]?.unit || '';
        setWarehouseForm((current) => ({ ...current, productType: mappedProducts[0].name, capacityUnit: firstUnit }));
      }
    } catch (error) {
      setApiError(error.message || t('warehouse.apiError'));
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedWarehouseId, t, warehouseForm.productType]);

  const loadWarehouseDetails = useCallback(async (warehouseId = selectedWarehouseId) => {
    if (!warehouseId) {
      setSelectedWarehouse(null);
      setMovementHistory([]);
      return;
    }
    setIsDetailLoading(true);
    setApiError('');
    try {
      const data = await getWarehouse(warehouseId);
      const mapped = mapWarehouse(data);
      setSelectedWarehouse(mapped);
      setWarehouseList((current) => current.map((warehouse) => (warehouse.id === mapped.id ? mapped : warehouse)));
      const firstUnit = getUnitOptions(unitRules, mapped.productType)[0]?.value || mapped.capacityUnit;
      setStockForm(createStockForm(mapped.id, mapped.productType, firstUnit));
      setWithdrawForm(createWithdrawForm(mapped));
    } catch (error) {
      setApiError(error.message || t('warehouse.apiError'));
    } finally {
      setIsDetailLoading(false);
    }
  }, [selectedWarehouseId, t, unitRules]);

  const loadMovements = useCallback(async (warehouseId = selectedWarehouseId) => {
    if (!warehouseId) return;
    setIsMovementLoading(true);
    try {
      const data = await getWarehouseMovements(warehouseId, movementFilters);
      setMovementHistory(data.map(mapMovement));
    } catch (error) {
      setApiError(error.message || t('warehouse.apiError'));
    } finally {
      setIsMovementLoading(false);
    }
  }, [movementFilters, selectedWarehouseId, t]);

  useEffect(() => {
    loadProductsAndWarehouses();
  }, [loadProductsAndWarehouses]);

  useEffect(() => {
    loadWarehouseDetails();
    loadMovements();
  }, [loadWarehouseDetails, loadMovements]);

  function productByName(name) {
    return productRows.find((product) => product.name === name);
  }

  function handleWarehouseChange(event) {
    const { name, value } = event.target;
    setWarehouseForm((current) => ({ ...current, [name]: value }));
  }

  function handleStockChange(event) {
    const { name, value } = event.target;
    setStockWarning('');
    if (name === 'warehouseId') return;
    setStockForm((current) => ({ ...current, [name]: value }));
  }

  function selectWarehouse(warehouseId) {
    setSelectedWarehouseId(warehouseId);
    setActiveForm(null);
  }

  function openWarehouseForm() {
    setWarehouseErrors([]);
    const firstProduct = productRows[0];
    setWarehouseForm({
      ...createWarehouseForm(),
      productType: firstProduct?.name || '',
      capacityUnit: firstProduct?.units?.[0]?.unit || '',
    });
    setActiveForm('warehouse');
  }

  function openStockForm() {
    if (!selectedWarehouse) return;
    setStockErrors([]);
    setStockWarning('');
    setStockForm(createStockForm(selectedWarehouse.id, selectedWarehouse.productType, selectedWarehouse.capacityUnit));
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

  async function reloadSelected(warehouseId = selectedWarehouseId) {
    await Promise.all([loadProductsAndWarehouses(), loadWarehouseDetails(warehouseId), loadMovements(warehouseId)]);
  }

  async function handleAddWarehouse(event) {
    event.preventDefault();
    setIsSavingWarehouse(true);
    setWarehouseErrors([]);
    try {
      const product = productByName(warehouseForm.productType);
      const created = await createWarehouse({
        warehouse_name: warehouseForm.warehouseName,
        location: warehouseForm.location,
        primary_product_id: product?.id,
        capacity: warehouseForm.capacity,
        capacity_unit: warehouseForm.capacityUnit,
        manager_name: warehouseForm.managerName,
        guard_name: warehouseForm.guardName,
        notes: warehouseForm.notes,
      });
      setSelectedWarehouseId(String(created.id));
      setActiveForm(null);
      await reloadSelected(created.id);
    } catch (error) {
      setWarehouseErrors(formatApiError(error));
    } finally {
      setIsSavingWarehouse(false);
    }
  }

  async function handleAddStock(event) {
    event.preventDefault();
    if (!selectedWarehouse) return;
    const quantity = Number(stockForm.quantity);
    if (quantity > 0) {
      const usageAfterSave = ((selectedWarehouse.currentStock + quantity) / Number(selectedWarehouse.capacity)) * 100;
      if (usageAfterSave >= 80 && usageAfterSave < 100 && !stockWarning) {
        setStockWarning(t('warehouse.confirmAlmostFull'));
        return;
      }
    }
    setIsAddingStock(true);
    setStockErrors([]);
    try {
      const product = productByName(stockForm.product);
      await addStock(selectedWarehouse.id, {
        product_id: product?.id,
        quantity: stockForm.quantity,
        unit: stockForm.unit,
        minimum_threshold: stockForm.minimumThreshold || '0',
        driver_name: stockForm.driverName,
        notes: stockForm.notes,
      });
      setActiveForm(null);
      setStockWarning('');
      await reloadSelected(selectedWarehouse.id);
    } catch (error) {
      setStockErrors(formatApiError(error));
    } finally {
      setIsAddingStock(false);
    }
  }

  function handleWithdrawChange(event) {
    const { name, value } = event.target;
    setWithdrawForm((current) => ({ ...current, [name]: value }));
  }

  async function handleWithdrawSubmit(event) {
    event.preventDefault();
    if (!selectedWarehouse) return;
    setIsWithdrawingStock(true);
    setWithdrawErrors([]);
    try {
      const product = productByName(withdrawForm.product);
      await withdrawStock(selectedWarehouse.id, {
        product_id: product?.id,
        quantity: withdrawForm.quantity,
        unit: withdrawForm.unit,
        driver_name: withdrawForm.driverName,
        notes: withdrawForm.notes,
      });
      setActiveForm(null);
      await reloadSelected(selectedWarehouse.id);
    } catch (error) {
      setWithdrawErrors(formatApiError(error));
    } finally {
      setIsWithdrawingStock(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="page-grid">
      <Card title={t('warehouse.overviewTitle')} subtitle={t('warehouse.overviewSubtitle')} className="warehouse-overview-card">
        <div className="workflow-toolbar workflow-toolbar--split warehouse-toolbar">
          <div className="journal-filter-group journal-filter-group--wide">
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t('warehouse.searchPlaceholder')} />
            <select value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))}>
              <option value="">{t('warehouse.allProducts')}</option>
              {productRows.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">{t('warehouse.allStatuses')}</option>
              {['Inactive', 'Available', 'Almost Full', 'Full', 'Archived'].map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
          </div>
          <div className="journal-date-search__actions">
            {selectedWarehouse && <Button variant="secondary" onClick={handlePrint}>{t('journal.printPdf')}</Button>}
            {activeForm !== 'warehouse' && <Button variant="secondary" onClick={openWarehouseForm}>{t('warehouse.actionAddNewWarehouse')}</Button>}
          </div>
        </div>

        {apiError && (
          <div className="form-error">
            <p>{apiError}</p>
            <Button type="button" variant="secondary" onClick={loadProductsAndWarehouses}>{t('journal.retry')}</Button>
          </div>
        )}

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

        {activeForm === 'warehouse' ? (
          <div className="warehouse-inline-form">
            <Card className="warehouse-action-form" title={t('warehouse.addWarehouseTitle')} subtitle={t('warehouse.addWarehouseSubtitle')}>
              <WarehouseForm
                form={warehouseForm}
                errors={warehouseErrors}
                products={productRows}
                unitRules={unitRules}
                isSaving={isSavingWarehouse}
                onChange={handleWarehouseChange}
                onSubmit={handleAddWarehouse}
                onCancel={closeActiveForm}
              />
            </Card>
          </div>
        ) : isLoading ? (
          <div className="warehouse-empty-state">{t('warehouse.loading')}</div>
        ) : !selectedWarehouse ? (
          <div className="warehouse-empty-state">{warehouseList.length === 0 ? t('warehouse.noWarehouses') : t('warehouse.selectWarehousePrompt')}</div>
        ) : (
          <>
            {isDetailLoading ? (
              <div className="warehouse-empty-state">{t('warehouse.loadingDetails')}</div>
            ) : (
              <>
                {selectedWarehouse.usagePercent >= 80 && selectedWarehouse.usagePercent < 100 && (
                  <div className="form-warning warehouse-alert">
                    {selectedWarehouse.warehouseName} {t('warehouse.almostFullAlert')}
                  </div>
                )}
                {selectedWarehouse.usagePercent >= 100 && (
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
                <div className="journal-table-toolbar journal-table-toolbar--filters">
                  <div className="journal-filter-group">
                    <select value={movementFilters.movement_type} onChange={(event) => setMovementFilters((current) => ({ ...current, movement_type: event.target.value }))}>
                      <option value="">{t('warehouse.allMovementTypes')}</option>
                      <option value="stock_in">{t('warehouse.movementStockIn')}</option>
                      <option value="manual_withdrawal">{t('warehouse.movementStockOut')}</option>
                    </select>
                    <input type="date" value={movementFilters.date_from} onChange={(event) => setMovementFilters((current) => ({ ...current, date_from: event.target.value }))} />
                    <input type="date" value={movementFilters.date_to} onChange={(event) => setMovementFilters((current) => ({ ...current, date_to: event.target.value }))} />
                  </div>
                </div>
                {isMovementLoading ? <div className="warehouse-empty-state">{t('warehouse.loadingMovements')}</div> : <InventoryMovementHistory movements={movementHistory} />}
              </>
            )}
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
            products={productRows}
            unitRules={unitRules}
            isSaving={isAddingStock}
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
            isSaving={isWithdrawingStock}
            onChange={handleWithdrawChange}
            onSubmit={handleWithdrawSubmit}
            onCancel={closeActiveForm}
          />
        </Card>
      )}

      <PrintableWarehouseInventory warehouse={selectedWarehouse} movements={movementHistory} adminName={adminName} />
    </div>
  );
}
