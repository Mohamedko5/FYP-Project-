import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConfirmationDialog,
  DetailSection,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  ModulePageHeader,
  RecordMeta,
  ResponsiveDataList,
  StatGrid,
  SummaryCard,
} from '../components/ui/ModuleInterface.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getStocks } from '../services/inventoryApi.js';
import { getReportOptions } from '../services/reportsApi.js';
import {
  cancelShipment,
  completeShipment,
  getShipmentSummary,
  getShipments,
  startShipmentProcessing,
} from '../services/shipmentsApi.js';

const tabFilters = { ready: 'ready_for_shipment', processing: 'processing', completed: 'completed', history: '' };

const copy = {
  en: {
    title: 'Weighing & Shipment',
    description: 'Prepare paid invoices for shipment, record weighing data, then complete shipment to deduct inventory.',
    ready: 'Ready for Shipment',
    processing: 'Processing',
    completed: 'Completed',
    history: 'History',
    shortage: 'Stock Shortage Alerts',
    completedToday: 'Completed',
    active: 'Active Shipments',
    clear: 'Clear Filters',
    search: 'Search shipment, order, invoice, customer',
    references: 'References',
    workflow: 'Workflow Status',
    transport: 'Transportation',
    items: 'Shipment Items',
    start: 'Start Processing',
    stepTransport: 'Step 1: Transport Information',
    stepItems: 'Step 2: Warehouse and Item Information',
    stepReview: 'Step 3: Review',
    noDeduct: 'Inventory will not be deducted at this stage.',
    complete: 'Complete Shipment',
    completeWarning: 'Completing this Shipment will deduct Inventory. This action cannot be repeated.',
    cancelShipment: 'Cancel Shipment',
    reason: 'Cancellation reason',
    noShipments: 'No shipments found.',
    paidInvoices: 'Paid invoices',
    completedShipments: 'Completed shipments',
    inventoryStockRecords: 'From inventory stock records',
    allCustomers: 'All customers',
    allWarehouses: 'All warehouses',
    allProducts: 'All products',
    tabStatus: 'Tab status',
    cancelled: 'Cancelled',
    saving: 'Saving...',
    vehicle: 'Vehicle',
    startedAt: 'Started At',
    completedAt: 'Completed At',
    availableStock: 'Available Stock',
    stockStatus: 'Stock Status',
    sufficient: 'Sufficient',
    shortageStatus: 'Shortage',
    selectWarehouse: 'Select warehouse',
  },
  ar: {
    title: 'الوزن والشحن',
    description: 'تجهيز الفواتير المدفوعة للشحن وتسجيل بيانات الوزن ثم إكمال الشحن لخصم المخزون.',
    ready: 'جاهزة للشحن',
    processing: 'قيد التنفيذ',
    completed: 'مكتملة',
    history: 'السجل',
    shortage: 'تنبيهات نقص المخزون',
    completedToday: 'مكتملة',
    active: 'الشحنات النشطة',
    clear: 'مسح الفلاتر',
    search: 'بحث بالشحنة أو الطلب أو الفاتورة أو العميل',
    references: 'المراجع',
    workflow: 'حالة سير العمل',
    transport: 'النقل',
    items: 'عناصر الشحنة',
    start: 'بدء المعالجة',
    stepTransport: 'الخطوة 1: معلومات النقل',
    stepItems: 'الخطوة 2: المخزن والعناصر',
    stepReview: 'الخطوة 3: المراجعة',
    noDeduct: 'لن يتم خصم المخزون في هذه المرحلة.',
    complete: 'إكمال الشحنة',
    completeWarning: 'إكمال هذه الشحنة سيخصم المخزون. لا يمكن تكرار هذا الإجراء.',
    cancelShipment: 'إلغاء الشحنة',
    reason: 'سبب الإلغاء',
    noShipments: 'لا توجد شحنات.',
    paidInvoices: 'فواتير مدفوعة',
    completedShipments: 'شحنات مكتملة',
    inventoryStockRecords: 'من سجلات مخزون المستودعات',
    allCustomers: 'كل العملاء',
    allWarehouses: 'كل المخازن',
    allProducts: 'كل المنتجات',
    tabStatus: 'حالة التبويب',
    cancelled: 'ملغاة',
    saving: 'جارٍ الحفظ...',
    vehicle: 'المركبة',
    startedAt: 'بدأت في',
    completedAt: 'اكتملت في',
    availableStock: 'المخزون المتاح',
    stockStatus: 'حالة المخزون',
    sufficient: 'كافٍ',
    shortageStatus: 'نقص',
    selectWarehouse: 'اختر المخزن',
  },
};

function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function statusText(value, isArabic = false) {
  const labels = {
    en: { ready_for_shipment: 'Ready for Shipment', processing: 'Processing', completed: 'Completed', cancelled: 'Cancelled' },
    ar: { ready_for_shipment: 'جاهزة للشحن', processing: 'قيد التنفيذ', completed: 'مكتملة', cancelled: 'ملغاة' },
  };
  return labels[isArabic ? 'ar' : 'en'][value] || value || '-';
}

function qty(value, unit = '') {
  const formatted = Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function emptyShipmentForm(shipment) {
  return {
    driver_name: shipment.driver_name || '',
    vehicle_number: shipment.vehicle_number || '',
    notes: shipment.notes || '',
    items: (shipment.items || []).map((item) => ({
      id: item.id,
      warehouse_id: item.warehouse || '',
      actual_quantity: item.actual_quantity || item.requested_quantity || '',
      number_of_bags: item.number_of_bags || '',
      total_weight_kg: item.total_weight_kg || '',
      notes: item.notes || '',
    })),
  };
}

function stockFor(stocks, item, warehouseId) {
  return stocks.find((stock) => String(stock.product_id) === String(item.product) && String(stock.warehouse) === String(warehouseId) && stock.unit === item.unit_snapshot);
}

export default function WeighingShipment() {
  const { t, isArabic } = useLanguage();
  const label = copy[isArabic ? 'ar' : 'en'];
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ customers: [], products: [], warehouses: [] });
  const [stocks, setStocks] = useState([]);
  const [activeTab, setActiveTab] = useState('ready');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [form, setForm] = useState(null);
  const [completeDialog, setCompleteDialog] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [filters, setFilters] = useState({ search: '', customer: '', warehouse: '', product: '', status: '', date: '' });
  const [errors, setErrors] = useState([]);
  const [dialogErrors, setDialogErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const processingButtonRef = useRef(null);
  const completeButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const processingDirty = Boolean(form) && selectedShipment && JSON.stringify(form) !== JSON.stringify(emptyShipmentForm(selectedShipment));
  const cancelDirty = Boolean(cancelDialog) && Boolean(cancelReason.trim());

  const loadShipments = useCallback(async (nextFilters = filters, tab = activeTab) => {
    setLoading(true);
    setErrors([]);
    try {
      const status = nextFilters.status || tabFilters[tab];
      const [shipmentData, summaryData] = await Promise.all([
        getShipments({ ...nextFilters, status, page_size: 100 }),
        getShipmentSummary(),
      ]);
      setShipments(unwrap(shipmentData));
      setSummary(summaryData);
    } catch (error) {
      setErrors(String(error.message || 'Unable to load shipments.').split('\n'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    loadShipments();
    getReportOptions().then((data) => setOptions(data?.results || { customers: [], products: [], warehouses: [] })).catch(() => {});
    getStocks({ page_size: 500 }).then((data) => setStocks(unwrap(data))).catch(() => setStocks([]));
  }, []);

  const visibleRows = useMemo(() => activeTab === 'history' ? shipments.filter((shipment) => ['processing', 'completed', 'cancelled'].includes(shipment.status)) : shipments, [activeTab, shipments]);

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedShipment(null);
    setForm(null);
    loadShipments(filters, tab);
  }

  function updateFilter(event) {
    const next = { ...filters, [event.target.name]: event.target.value };
    setFilters(next);
    loadShipments(next);
  }

  function clearFilters() {
    const next = { search: '', customer: '', warehouse: '', product: '', status: '', date: '' };
    setFilters(next);
    loadShipments(next);
  }

  function openProcessingForm(shipment) {
    setSelectedShipment(shipment);
    setForm(emptyShipmentForm(shipment));
    setErrors([]);
  }

  function updateHeader(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  async function saveProcessing(event) {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const updated = await startShipmentProcessing(selectedShipment.id, form);
      setSelectedShipment(updated);
      setForm(null);
      setActiveTab('processing');
      await loadShipments(filters, 'processing');
    } catch (error) {
      setErrors(String(error.message || 'Unable to start shipment processing.').split('\n'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmComplete() {
    setSaving(true);
    setDialogErrors([]);
    try {
      const updated = await completeShipment(completeDialog.id);
      setSelectedShipment(updated);
      setCompleteDialog(null);
      setActiveTab('completed');
      await loadShipments(filters, 'completed');
      getStocks({ page_size: 500 }).then((data) => setStocks(unwrap(data))).catch(() => {});
    } catch (error) {
      setDialogErrors(String(error.message || 'Unable to complete shipment.').split('\n'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!cancelReason.trim()) {
      setDialogErrors([label.reason]);
      return;
    }
    setSaving(true);
    setDialogErrors([]);
    try {
      const updated = await cancelShipment(cancelDialog.id, cancelReason);
      setSelectedShipment(updated);
      setCancelDialog(null);
      setCancelReason('');
      await loadShipments();
    } catch (error) {
      setDialogErrors(String(error.message || 'Unable to cancel shipment.').split('\n'));
    } finally {
      setSaving(false);
    }
  }

  function printShipment(shipment) {
    setSelectedShipment(shipment);
    window.setTimeout(() => window.print(), 100);
  }

  const stockShortages = stocks.filter((stock) => Number(stock.quantity || 0) <= Number(stock.minimum_threshold || 0) && Number(stock.quantity || 0) > 0).length;
  const activeCount = (summary?.ready_count || 0) + (summary?.processing_count || 0);
  const tabs = [
    ['ready', `${label.ready} (${summary?.ready_count ?? 0})`],
    ['processing', `${label.processing} (${summary?.processing_count ?? 0})`],
    ['completed', `${label.completed} (${summary?.completed_count ?? 0})`],
    ['history', `${label.history} (${(summary?.processing_count || 0) + (summary?.completed_count || 0) + (summary?.cancelled_count || 0)})`],
  ];

  const columns = [
    { key: 'shipment_number', label: t('shipments.shipmentId') },
    { key: 'order_number', label: t('common.orderNumber') },
    { key: 'invoice_number', label: t('common.invoiceNumber') },
    { key: 'customer_name', label: t('common.customerName') },
    { key: 'product_summary', label: t('common.product') },
    { key: 'item_count', label: 'Items', render: (row) => row.items?.length || 0 },
    { key: 'driver_name', label: t('warehouse.driverName'), render: (row) => row.driver_name || '-' },
    { key: 'status', label: t('shipments.shipmentStatus'), render: (row) => <StatusBadge status={statusText(row.status, isArabic)} /> },
    { key: 'created_date', label: t('common.date') },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          <Button variant="secondary" onClick={() => setSelectedShipment(row)}>{t('view')}</Button>
          {row.status === 'ready_for_shipment' && <Button variant="secondary" onClick={() => openProcessingForm(row)} ref={processingButtonRef}>{label.start}</Button>}
          {row.status === 'processing' && <Button onClick={() => setCompleteDialog(row)} ref={completeButtonRef}>{label.complete}</Button>}
          <Button variant="secondary" onClick={() => printShipment(row)}>{t('reports.printPdf')}</Button>
          {row.status !== 'completed' && row.status !== 'cancelled' && <Button variant="secondary" onClick={() => { setCancelDialog(row); setDialogErrors([]); }} ref={cancelButtonRef}>{t('cancel')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="module-page shipment-page">
      <ModulePageHeader
        title={label.title}
        description={label.description}
        meta={`${label.active}: ${activeCount}`}
        actions={selectedShipment && <Button variant="secondary" onClick={() => printShipment(selectedShipment)}>{t('reports.printPdf')}</Button>}
      />

      <StatGrid>
        <SummaryCard label={label.ready} value={summary?.ready_count ?? 0} note={label.paidInvoices} />
        <SummaryCard label={label.processing} value={summary?.processing_count ?? 0} note={label.noDeduct} tone="warning" />
        <SummaryCard label={label.completedToday} value={summary?.completed_count ?? 0} note={label.completedShipments} tone="good" />
        <SummaryCard label={label.shortage} value={stockShortages} note={label.inventoryStockRecords} tone={stockShortages ? 'warning' : 'good'} />
      </StatGrid>

      <Card className="module-card-flat">
        <div className="module-tabs" role="tablist" aria-label="Shipment status">
          {tabs.map(([tab, text]) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => switchTab(tab)}>{text}</button>)}
        </div>
        <FilterToolbar actions={<Button variant="secondary" onClick={clearFilters}>{label.clear}</Button>}>
          <label><span>{t('common.description')}</span><input name="search" value={filters.search} onChange={updateFilter} placeholder={label.search} /></label>
          <label><span>{t('common.customer')}</span><select name="customer" value={filters.customer} onChange={updateFilter}><option value="">{label.allCustomers}</option>{options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label><span>{t('warehouse.warehouse')}</span><select name="warehouse" value={filters.warehouse} onChange={updateFilter}><option value="">{label.allWarehouses}</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_name}</option>)}</select></label>
          <label><span>{t('common.product')}</span><select name="product" value={filters.product} onChange={updateFilter}><option value="">{label.allProducts}</option>{options.products.map((product) => <option key={product.id} value={product.id}>{isArabic ? product.name_ar : product.name_en}</option>)}</select></label>
          <label><span>{t('common.status')}</span><select name="status" value={filters.status} onChange={updateFilter}><option value="">{label.tabStatus}</option><option value="ready_for_shipment">{label.ready}</option><option value="processing">{label.processing}</option><option value="completed">{label.completed}</option><option value="cancelled">{label.cancelled}</option></select></label>
          <label><span>{t('common.date')}</span><input name="date" type="date" value={filters.date} onChange={updateFilter} /></label>
        </FilterToolbar>
        <ErrorState errors={errors} onRetry={() => loadShipments()} retryLabel={t('retry')} />
        {saving && <LoadingState message={label.saving} />}
        {loading ? <LoadingState message={t('orders.loading')} /> : (
          <>
            <div className="module-desktop-table"><Table columns={columns} rows={visibleRows} emptyMessage={label.noShipments} /></div>
            <ResponsiveDataList rows={visibleRows} emptyTitle={label.noShipments} renderCard={(row) => (
              <article className="module-record-card" key={row.id}>
                <div><strong>{row.shipment_number}</strong><StatusBadge status={statusText(row.status, isArabic)} /></div>
                <p>{row.customer_name}</p>
                <span>{row.product_summary || '-'} / {row.created_date}</span>
                <Button variant="secondary" onClick={() => setSelectedShipment(row)}>{t('view')}</Button>
              </article>
            )} />
          </>
        )}
      </Card>

      {selectedShipment && (
        <Card title={selectedShipment.shipment_number} subtitle={`${selectedShipment.order_number} / ${selectedShipment.invoice_number}`}>
          <DetailSection title={label.references}>
            <RecordMeta items={[
              { label: t('shipments.shipmentId'), value: selectedShipment.shipment_number },
              { label: t('common.orderNumber'), value: selectedShipment.order_number },
              { label: t('common.invoiceNumber'), value: selectedShipment.invoice_number },
              { label: t('common.customerName'), value: selectedShipment.customer_name },
            ]} />
          </DetailSection>
          <DetailSection title={label.workflow}>
            <div className={`shipment-stepper shipment-stepper--${selectedShipment.status}`}>
              {['ready_for_shipment', 'processing', 'completed'].map((step) => <span key={step} className={selectedShipment.status === step || (step === 'ready_for_shipment' && selectedShipment.status !== 'cancelled') ? 'is-active' : ''}>{statusText(step, isArabic)}</span>)}
              {selectedShipment.status === 'cancelled' && <StatusBadge status={label.cancelled} />}
            </div>
          </DetailSection>
          <DetailSection title={label.transport}>
            <RecordMeta items={[
              { label: t('warehouse.driverName'), value: selectedShipment.driver_name || '-' },
              { label: label.vehicle, value: selectedShipment.vehicle_number || '-' },
              { label: label.startedAt, value: selectedShipment.started_at ? new Date(selectedShipment.started_at).toLocaleString() : '-' },
              { label: label.completedAt, value: selectedShipment.completed_at ? new Date(selectedShipment.completed_at).toLocaleString() : '-' },
            ]} />
          </DetailSection>
          <DetailSection title={label.items}>
            <div className="shipment-item-card-grid">
              {(selectedShipment.items || []).map((item) => {
                const stock = stockFor(stocks, item, item.warehouse);
                const sufficient = !item.actual_quantity || !stock || Number(stock.quantity) >= Number(item.actual_quantity);
                return (
                  <article className="shipment-item-card" key={item.id}>
                    <div><strong>{isArabic ? item.product_name_ar_snapshot : item.product_name_en_snapshot}</strong><StatusBadge status={sufficient ? 'Available' : 'Low Stock'} /></div>
                    <RecordMeta items={[
                      { label: t('shipments.requestedQuantity'), value: qty(item.requested_quantity, item.unit_snapshot) },
                      { label: t('warehouse.warehouse'), value: item.warehouse_name || '-' },
                      { label: label.availableStock, value: stock ? qty(stock.quantity, stock.unit) : '-' },
                      { label: t('shipments.actualQuantity'), value: item.actual_quantity ? qty(item.actual_quantity, item.unit_snapshot) : '-' },
                      { label: t('shipments.numberOfBags'), value: item.number_of_bags || '-' },
                      { label: t('shipments.totalWeight'), value: item.total_weight_kg ? qty(item.total_weight_kg, 'kg') : '-' },
                      { label: t('shipments.averageBagWeight'), value: item.average_bag_weight_kg ? qty(item.average_bag_weight_kg, 'kg') : '-' },
                    ]} />
                  </article>
                );
              })}
            </div>
          </DetailSection>
        </Card>
      )}

      <AppWindow
        id="shipment-processing"
        title={label.start}
        description={selectedShipment?.shipment_number}
        isOpen={Boolean(selectedShipment && form)}
        isDirty={processingDirty}
        isSubmitting={saving}
        defaultSize="xlarge"
        openerRef={processingButtonRef}
        onClose={() => setForm(null)}
      >
        {selectedShipment && form && (
          <form className="shipment-processing-form" onSubmit={saveProcessing}>
            <DetailSection title={label.stepTransport}>
              <div className="form-grid">
                <label>{t('warehouse.driverName')}<input name="driver_name" value={form.driver_name} onChange={updateHeader} required /></label>
                <label>{label.vehicle}<input name="vehicle_number" value={form.vehicle_number} onChange={updateHeader} /></label>
                <label className="form-grid__wide">{t('warehouse.notes')}<textarea name="notes" value={form.notes} onChange={updateHeader} /></label>
              </div>
            </DetailSection>
            <DetailSection title={label.stepItems}>
              <div className="shipment-item-card-grid">
                {form.items.map((item, index) => {
                  const source = selectedShipment.items[index];
                  const selectedStock = stockFor(stocks, source, item.warehouse_id);
                  const bags = Number(item.number_of_bags || 0);
                  const totalWeight = Number(item.total_weight_kg || 0);
                  const average = bags > 0 && totalWeight > 0 ? (totalWeight / bags).toFixed(3) : '-';
                  const sufficient = selectedStock && Number(selectedStock.quantity) >= Number(item.actual_quantity || 0);
                  return (
                    <article className="shipment-item-card" key={item.id}>
                      <div><strong>{isArabic ? source.product_name_ar_snapshot : source.product_name_en_snapshot}</strong><span>{qty(source.requested_quantity, source.unit_snapshot)}</span></div>
                      <div className="form-grid">
                        <label>{t('warehouse.warehouse')}<select value={item.warehouse_id} onChange={(event) => updateItem(index, 'warehouse_id', event.target.value)} required><option value="">{t('warehouse.selectWarehousePlaceholder')}</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_name}</option>)}</select></label>
                        <label>{label.availableStock}<input value={selectedStock ? qty(selectedStock.quantity, selectedStock.unit) : '-'} readOnly /></label>
                        <label>{t('shipments.actualQuantity')}<input type="number" min="0.001" step="0.001" value={item.actual_quantity} onChange={(event) => updateItem(index, 'actual_quantity', event.target.value)} required /></label>
                        <label>{t('common.unit')}<input value={source.unit_snapshot} readOnly /></label>
                        <label>{t('shipments.numberOfBags')}<input type="number" min="1" step="1" value={item.number_of_bags} onChange={(event) => updateItem(index, 'number_of_bags', event.target.value)} /></label>
                        <label>{t('shipments.totalWeight')}<input type="number" min="0.001" step="0.001" value={item.total_weight_kg} onChange={(event) => updateItem(index, 'total_weight_kg', event.target.value)} /></label>
                        <label>{t('shipments.averageBagWeight')}<input value={average} readOnly /></label>
                        <label>{label.stockStatus}<input value={selectedStock ? (sufficient ? label.sufficient : label.shortageStatus) : label.selectWarehouse} readOnly /></label>
                        <label className="form-grid__wide">{t('warehouse.notes')}<input value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} /></label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </DetailSection>
            <DetailSection title={label.stepReview}>
              <p className="module-warning-note">{label.noDeduct}</p>
            </DetailSection>
            <div className="form-grid__actions form-grid__actions--split">
              <Button type="submit" disabled={saving}>{t('shipments.saveProcessing')}</Button>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>{t('cancel')}</Button>
            </div>
          </form>
        )}
      </AppWindow>

      <AppWindow
        id="shipment-complete"
        title={label.complete}
        description={label.completeWarning}
        isOpen={Boolean(completeDialog)}
        isDirty={false}
        isSubmitting={saving}
        defaultSize="medium"
        openerRef={completeButtonRef}
        onClose={() => setCompleteDialog(null)}
      >
        {completeDialog && (
        <section className="section-panel">
          <RecordMeta items={[
            { label: t('shipments.shipmentId'), value: completeDialog.shipment_number },
            { label: t('common.customerName'), value: completeDialog.customer_name },
            { label: t('warehouse.driverName'), value: completeDialog.driver_name || '-' },
          ]} />
          <div className="module-dialog-list">
            {(completeDialog.items || []).map((item) => <p key={item.id}>{isArabic ? item.product_name_ar_snapshot : item.product_name_en_snapshot}: {qty(item.actual_quantity, item.unit_snapshot)} / {item.warehouse_name}</p>)}
          </div>
          <ErrorState errors={dialogErrors} />
          <div className="workflow-actions">
            <Button type="button" onClick={confirmComplete} disabled={saving}>{saving ? label.saving : label.complete}</Button>
            <Button type="button" variant="secondary" onClick={() => setCompleteDialog(null)} disabled={saving}>{t('cancel')}</Button>
          </div>
        </section>
        )}
      </AppWindow>

      <AppWindow
        id="shipment-cancel"
        title={label.cancelShipment}
        isOpen={Boolean(cancelDialog)}
        isDirty={cancelDirty}
        isSubmitting={saving}
        defaultSize="medium"
        openerRef={cancelButtonRef}
        onClose={() => setCancelDialog(null)}
      >
        {cancelDialog && (
        <form className="section-panel" onSubmit={(event) => { event.preventDefault(); confirmCancel(); }}>
          <RecordMeta items={[{ label: t('shipments.shipmentId'), value: cancelDialog.shipment_number }, { label: t('common.customerName'), value: cancelDialog.customer_name }]} />
          <label className="module-dialog-field">{label.reason}<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required /></label>
          <ErrorState errors={dialogErrors} />
          <div className="workflow-actions">
            <Button type="submit" disabled={saving}>{saving ? label.saving : label.cancelShipment}</Button>
            <Button type="button" variant="secondary" onClick={() => setCancelDialog(null)} disabled={saving}>{t('cancel')}</Button>
          </div>
        </form>
        )}
      </AppWindow>

      {selectedShipment && (
        <section className="print-area">
          <div className="print-report" dir={isArabic ? 'rtl' : 'ltr'}>
            <header className="print-report__header"><h1>{t('companyName')}</h1><p>Bayad ERP</p><h2>{selectedShipment.shipment_number}</h2></header>
            <div className="print-report__meta"><div><span>{t('common.orderNumber')}</span><strong>{selectedShipment.order_number}</strong></div><div><span>{t('common.invoiceNumber')}</span><strong>{selectedShipment.invoice_number}</strong></div><div><span>{t('common.customerName')}</span><strong>{selectedShipment.customer_name}</strong></div></div>
            <table className="print-table"><thead><tr><th>{t('common.product')}</th><th>{t('shipments.requestedQuantity')}</th><th>{t('shipments.actualQuantity')}</th><th>{t('warehouse.warehouse')}</th><th>{t('shipments.numberOfBags')}</th><th>{t('shipments.totalWeight')}</th></tr></thead><tbody>{(selectedShipment.items || []).map((item) => <tr key={item.id}><td>{isArabic ? item.product_name_ar_snapshot : item.product_name_en_snapshot}</td><td>{qty(item.requested_quantity, item.unit_snapshot)}</td><td>{qty(item.actual_quantity, item.unit_snapshot)}</td><td>{item.warehouse_name || '-'}</td><td>{item.number_of_bags || '-'}</td><td>{item.total_weight_kg ? qty(item.total_weight_kg, 'kg') : '-'}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}
