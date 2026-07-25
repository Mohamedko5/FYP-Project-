import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import ModalPortal from '../components/ui/ModalPortal.jsx';
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
    isActive: row.is_active,
    isDeleted: row.is_deleted,
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

function WarehouseBackConfirmationDialog({ onCancel, onConfirm, isArabic }) {
  return (
    <ModalPortal>
      <div className="confirmation-overlay" role="presentation">
        <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="warehouse-back-confirm-title">
          <h3 id="warehouse-back-confirm-title">{isArabic ? 'تغييرات غير محفوظة' : 'Unsaved Changes'}</h3>
          <p>{isArabic ? 'لديك تغييرات غير محفوظة. هل تريد الرجوع إلى قائمة المخازن وتجاهلها؟' : 'You have unsaved changes. Return to the Warehouse list and discard them?'}</p>
          <div className="confirmation-dialog__actions">
            <Button type="button" variant="secondary" onClick={onCancel}>{isArabic ? 'متابعة التعديل' : 'Continue Editing'}</Button>
            <Button type="button" onClick={onConfirm}>{isArabic ? 'تجاهل والرجوع' : 'Discard and Return'}</Button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

export default function WarehouseInventory() {
  const { t, isArabic } = useLanguage();
  const warehouseText = {
    selectWarehouse: isArabic ? 'اختر المخزن' : t('warehouse.selectWarehouse'),
    selectWarehousePrompt: isArabic ? 'اختر مخزناً لعرض تفاصيله والمخزون الموجود فيه.' : t('warehouse.selectWarehousePrompt'),
    noWarehouseSelected: isArabic ? 'لم يتم اختيار مخزن' : t('warehouse.noWarehouseSelected'),
    backToWarehouses: isArabic ? 'الرجوع إلى المخازن' : t('warehouse.backToWarehouses'),
  };
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
  const [movementFilters, setMovementFilters] = useState({ movement_type: '', date_from: '', date_to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMovementLoading, setIsMovementLoading] = useState(false);
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [isWithdrawingStock, setIsWithdrawingStock] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);
  const [adminName] = useState(storedAdminName);
  const warehouseSelectorRef = useRef(null);
  const addWarehouseButtonRef = useRef(null);
  const addStockButtonRef = useRef(null);
  const withdrawStockButtonRef = useRef(null);

  const unitRules = useMemo(() => productUnitRules(productRows), [productRows]);

  const selectedProductLabel = selectedWarehouse
    ? commodityProductLabels[selectedWarehouse.productType]?.[isArabic ? 'ar' : 'en'] || selectedWarehouse.productType
    : '';
  const selectedCapacityUnitLabel = selectedWarehouse
    ? (isArabic ? (unitLabels[selectedWarehouse.capacityUnit]?.ar || selectedWarehouse.capacityUnit) : selectedWarehouse.capacityUnit)
    : '';
  const warehouseFormDirty = activeForm === 'warehouse' && JSON.stringify(warehouseForm) !== JSON.stringify(createWarehouseForm());
  const stockFormDirty = activeForm === 'stock' && JSON.stringify(stockForm) !== JSON.stringify(createStockForm(selectedWarehouse?.id || '', selectedWarehouse?.productType || '', selectedWarehouse?.capacityUnit || ''));
  const withdrawFormDirty = activeForm === 'withdraw' && JSON.stringify(withdrawForm) !== JSON.stringify(createWithdrawForm(selectedWarehouse));
  const hasDirtyWarehouseForm = warehouseFormDirty || stockFormDirty || withdrawFormDirty;

  const loadProductsAndWarehouses = useCallback(async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const [productsData, warehousesData] = await Promise.all([
        getProducts({ active: 'true' }),
        getWarehouses(),
      ]);
      const mappedProducts = productsData.map(mapProduct);
      const mappedWarehouses = warehousesData
        .map(mapWarehouse)
        .filter((warehouse) => !warehouse.isDeleted && warehouse.isActive !== false);
      setProductRows(mappedProducts);
      setWarehouseList(mappedWarehouses);
      if (mappedProducts[0] && !warehouseForm.productType) {
        const firstUnit = mappedProducts[0].units[0]?.unit || '';
        setWarehouseForm((current) => ({ ...current, productType: mappedProducts[0].name, capacityUnit: firstUnit }));
      }
    } catch (error) {
      setApiError(error.message || t('warehouse.apiError'));
    } finally {
      setIsLoading(false);
    }
  }, [t, warehouseForm.productType]);

  const loadWarehouseDetails = useCallback(async (warehouseId = selectedWarehouseId) => {
    if (!warehouseId) {
      setSelectedWarehouse(null);
      setMovementHistory([]);
      setIsDetailLoading(false);
      return;
    }
    setIsDetailLoading(true);
    setSelectedWarehouse(null);
    setMovementHistory([]);
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
    if (!warehouseId) {
      setMovementHistory([]);
      setIsMovementLoading(false);
      return;
    }
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
    setSelectedWarehouse(null);
    setMovementHistory([]);
    setMovementFilters({ movement_type: '', date_from: '', date_to: '' });
    setApiError('');
    setSelectedWarehouseId(warehouseId);
    setActiveForm(null);
  }

  function finishBackToWarehouses() {
    setShowBackConfirmation(false);
    setSelectedWarehouseId('');
    setSelectedWarehouse(null);
    setMovementHistory([]);
    setMovementFilters({ movement_type: '', date_from: '', date_to: '' });
    setActiveForm(null);
    setWarehouseErrors([]);
    setStockErrors([]);
    setStockWarning('');
    setWithdrawErrors([]);
    setApiError('');
    setStockForm(createStockForm());
    setWithdrawForm(createWithdrawForm(null));
    window.setTimeout(() => warehouseSelectorRef.current?.focus(), 0);
  }

  function handleBackToWarehouses() {
    if (hasDirtyWarehouseForm) {
      setShowBackConfirmation(true);
      return;
    }
    finishBackToWarehouses();
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
          <div className="journal-date-search__actions">
            {selectedWarehouse && <Button variant="secondary" onClick={handlePrint}>{t('journal.printPdf')}</Button>}
            {activeForm !== 'warehouse' && <Button variant="secondary" onClick={openWarehouseForm} ref={addWarehouseButtonRef}>{t('warehouse.actionAddNewWarehouse')}</Button>}
          </div>
        </div>

        {apiError && (
          <div className="form-error">
            <p>{apiError}</p>
            <Button type="button" variant="secondary" onClick={loadProductsAndWarehouses}>{t('journal.retry')}</Button>
          </div>
        )}

        <div className="warehouse-overview-header section-header">
          <label>
            {warehouseText.selectWarehouse}
            <select
              ref={warehouseSelectorRef}
              value={selectedWarehouseId}
              onChange={(event) => selectWarehouse(event.target.value)}
              aria-label={warehouseText.selectWarehouse}
            >
              <option value="">{warehouseText.selectWarehouse}</option>
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

        {isLoading ? (
          <div className="warehouse-empty-state">{t('warehouse.loading')}</div>
        ) : !selectedWarehouse ? (
          <section className="warehouse-selection-empty" aria-labelledby="warehouse-empty-title">
            <div className="warehouse-selection-empty__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M8 19 24 9l16 10v19H8V19Z" />
                <path d="M15 38V23h18v15M19 28h10M19 33h10" />
              </svg>
            </div>
            <div>
              <h3 id="warehouse-empty-title">{warehouseList.length === 0 ? t('warehouse.noWarehouses') : warehouseText.noWarehouseSelected}</h3>
              <p>{warehouseList.length === 0 ? t('warehouse.noWarehouses') : warehouseText.selectWarehousePrompt}</p>
            </div>
          </section>
        ) : (
          <>
            {isDetailLoading ? (
              <div className="warehouse-empty-state">{t('warehouse.loadingDetails')}</div>
            ) : (
              <>
                <div className="warehouse-selection-actions">
                  <Button type="button" variant="secondary" onClick={handleBackToWarehouses} tooltip={warehouseText.backToWarehouses}>
                    <span aria-hidden="true" className="warehouse-back-icon">{isArabic ? '→' : '←'}</span>
                    {warehouseText.backToWarehouses}
                  </Button>
                </div>
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
                      <Button onClick={openStockForm} ref={addStockButtonRef}>{t('warehouse.actionAddStock')}</Button>
                      <Button variant="secondary" onClick={openWithdrawForm} ref={withdrawStockButtonRef}>{t('warehouse.actionWithdrawStock')}</Button>
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

      <AppWindow
        id="warehouse-add"
        title={t('warehouse.addWarehouseTitle')}
        description={t('warehouse.addWarehouseSubtitle')}
        isOpen={activeForm === 'warehouse'}
        isDirty={warehouseFormDirty}
        isSubmitting={isSavingWarehouse}
        defaultSize="large"
        openerRef={addWarehouseButtonRef}
        onClose={closeActiveForm}
      >
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
      </AppWindow>

      <AppWindow
        id="warehouse-stock-transaction"
        title={activeForm === 'withdraw' ? t('warehouse.withdrawStockTitle') : t('warehouse.addStockTitle')}
        description={activeForm === 'withdraw' ? t('warehouse.withdrawStockSubtitle') : t('warehouse.addStockSubtitle')}
        isOpen={activeForm === 'stock' || activeForm === 'withdraw'}
        isDirty={activeForm === 'withdraw' ? withdrawFormDirty : stockFormDirty}
        isSubmitting={isAddingStock || isWithdrawingStock}
        defaultSize="large"
        openerRef={activeForm === 'withdraw' ? withdrawStockButtonRef : addStockButtonRef}
        onClose={closeActiveForm}
      >
        {activeForm === 'withdraw' ? (
          <WithdrawStockForm
            form={withdrawForm}
            errors={withdrawErrors}
            warehouse={selectedWarehouse}
            isSaving={isWithdrawingStock}
            onChange={handleWithdrawChange}
            onSubmit={handleWithdrawSubmit}
            onCancel={closeActiveForm}
          />
        ) : (
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
        )}
      </AppWindow>

      <PrintableWarehouseInventory warehouse={selectedWarehouse} movements={movementHistory} adminName={adminName} />
      {showBackConfirmation && (
        <WarehouseBackConfirmationDialog
          isArabic={isArabic}
          onCancel={() => setShowBackConfirmation(false)}
          onConfirm={finishBackToWarehouses}
        />
      )}
    </div>
  );
}
