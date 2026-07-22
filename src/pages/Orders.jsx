import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PrintableOrder from '../components/reports/PrintableOrder.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getCustomers } from '../services/customersApi.js';
import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrderSummary,
  getOrders,
  markOrderReceived,
  updateOrder,
} from '../services/ordersApi.js';
import { getProductOptions } from '../services/productsApi.js';

const tabStatuses = {
  active: 'pending,received,invoiced',
  ready: 'ready_for_shipment,processing',
  completed: 'completed',
  cancelled: 'cancelled',
};

const statusOptions = ['pending', 'received', 'invoiced', 'ready_for_shipment', 'processing', 'completed', 'cancelled'];

function emptyItem() {
  return { product_id: '', product_unit_id: '', quantity: '', unit_price: '', notes: '', price_override_reason: '' };
}

function emptyForm() {
  return {
    customer_id: '',
    customer_reference: '',
    customer_notes: '',
    internal_notes: '',
    discount_amount: '',
    items: [emptyItem()],
  };
}

function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function readRole() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user?.profile?.role || user?.role || 'admin';
  } catch {
    return 'admin';
  }
}

export default function Orders() {
  const { t, isArabic } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', customer: '', product: '', date: '' });
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const role = readRole();
  const isAdmin = role === 'admin';
  const addOrderButtonRef = useRef(null);
  const editOrderButtonRef = useRef(null);
  const cancelOrderButtonRef = useRef(null);

  const selectedPrintOrder = selectedOrder;
  const orderFormDirty = showForm && JSON.stringify(form) !== JSON.stringify(emptyForm());
  const cancelDirty = Boolean(cancelDialog) && Boolean(cancelReason.trim());

  const loadOrders = useCallback(async (nextFilters = filters, tab = activeTab) => {
    setLoading(true);
    setErrors([]);
    try {
      const statusFilter = nextFilters.status || tabStatuses[tab];
      const [orderData, summaryData] = await Promise.all([
        getOrders({ ...nextFilters, status: statusFilter, ordering: '-created_at', page_size: 100 }),
        getOrderSummary(),
      ]);
      setOrders(unwrap(orderData));
      setSummary(summaryData);
    } catch (error) {
      setErrors([error.message || t('orders.apiError')]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, t]);

  const loadSelectors = useCallback(async () => {
    try {
      const [customerData, productData] = await Promise.all([
        getCustomers({ is_active: true, page_size: 100 }),
        getProductOptions(),
      ]);
      setCustomers(unwrap(customerData));
      setProducts(unwrap(productData));
    } catch (error) {
      setErrors([error.message || t('orders.selectorError')]);
    }
  }, [t]);

  useEffect(() => {
    loadOrders();
    loadSelectors();
  }, []);

  const formPreview = useMemo(() => {
    const subtotal = form.items.reduce((total, item) => total + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
    const discount = Number(form.discount_amount || 0);
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  }, [form]);

  function productName(product) {
    return isArabic ? (product.name_ar || product.name_en) : product.name_en;
  }

  function itemProduct(item) {
    return products.find((product) => String(product.id) === String(item.product_id));
  }

  function itemUnit(item) {
    return itemProduct(item)?.units?.find((unit) => String(unit.id) === String(item.product_unit_id));
  }

  function updateFilter(event) {
    const next = { ...filters, [event.target.name]: event.target.value };
    setFilters(next);
    loadOrders(next);
  }

  function switchTab(tab) {
    setActiveTab(tab);
    const next = { ...filters, status: '' };
    setFilters(next);
    loadOrders(next, tab);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find((row) => String(row.id) === String(value));
          const defaultUnit = product?.units?.find((unit) => unit.is_default) || product?.units?.[0];
          next.product_unit_id = defaultUnit?.id || '';
          next.unit_price = defaultUnit?.selling_price || '';
        }
        if (field === 'product_unit_id') {
          const unit = products.flatMap((product) => product.units || []).find((row) => String(row.id) === String(value));
          next.unit_price = unit?.selling_price || next.unit_price;
        }
        return next;
      }),
    }));
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  }

  function removeItem(index) {
    setForm((current) => {
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, items: items.length ? items : [emptyItem()] };
    });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setErrors([]);
    setShowForm(true);
  }

  function openEditForm(order) {
    setEditingId(order.id);
    setForm({
      customer_id: order.customer?.id || '',
      customer_reference: order.customer_reference || '',
      customer_notes: order.customer_notes || '',
      internal_notes: order.internal_notes || '',
      discount_amount: order.discount_amount || '',
      items: order.items?.map((item) => ({
        product_id: item.product?.id || '',
        product_unit_id: item.product_unit || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || '',
        price_override_reason: item.price_override_reason || '',
      })) || [emptyItem()],
    });
    setSelectedOrder(order);
    setErrors([]);
    setShowForm(true);
  }

  async function loadDetail(orderId) {
    setErrors([]);
    try {
      setSelectedOrder(await getOrder(orderId));
    } catch (error) {
      setErrors([error.message || t('orders.detailError')]);
    }
  }

  async function loadAndEdit(orderId) {
    setErrors([]);
    try {
      const order = await getOrder(orderId);
      setSelectedOrder(order);
      openEditForm(order);
    } catch (error) {
      setErrors([error.message || t('orders.detailError')]);
    }
  }

  function validateForm() {
    const nextErrors = [];
    if (!form.customer_id) nextErrors.push(t('orders.customerRequired'));
    if (!form.items.length || form.items.some((item) => !item.product_id || !item.product_unit_id || Number(item.quantity) <= 0)) {
      nextErrors.push(t('orders.itemRequired'));
    }
    const keys = form.items.map((item) => `${item.product_id}:${item.product_unit_id}`);
    if (new Set(keys).size !== keys.length) nextErrors.push(t('orders.duplicateItem'));
    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function saveOrder(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    setErrors([]);
    try {
      const payload = {
        ...form,
        discount_amount: form.discount_amount || '0',
        items: form.items.map((item) => ({
          ...item,
          unit_price: item.unit_price === '' ? undefined : item.unit_price,
        })),
      };
      const saved = editingId ? await updateOrder(editingId, payload) : await createOrder(payload);
      setShowForm(false);
      setEditingId(null);
      setSelectedOrder(saved);
      await loadOrders();
    } catch (error) {
      setErrors(String(error.message || t('orders.saveError')).split('\n'));
    } finally {
      setSaving(false);
    }
  }

  async function receiveOrder(order) {
    setErrors([]);
    try {
      const updated = await markOrderReceived(order.id);
      setSelectedOrder(updated);
      await loadOrders();
    } catch (error) {
      setErrors([error.message || t('orders.receiveError')]);
    }
  }

  function cancelSelectedOrder(order) {
    setCancelDialog(order);
    setCancelReason('');
    setErrors([]);
  }

  async function confirmCancelOrder(event) {
    event.preventDefault();
    if (!cancelDialog || !cancelReason.trim()) {
      setErrors([t('orders.cancellationReason')]);
      return;
    }
    setCancellingId(cancelDialog.id);
    setErrors([]);
    try {
      const updated = await cancelOrder(cancelDialog.id, cancelReason);
      setSelectedOrder(updated);
      setCancelDialog(null);
      setCancelReason('');
      await loadOrders();
    } catch (error) {
      setErrors([error.message || t('orders.cancelError')]);
    } finally {
      setCancellingId(null);
    }
  }

  function createInvoice(orderId) {
    navigate('/invoices', { state: { orderId } });
  }

  function printOrder(order) {
    if (!selectedOrder || selectedOrder.id !== order.id) {
      loadDetail(order.id).then(() => window.setTimeout(() => window.print(), 100));
    } else {
      window.print();
    }
  }

  const columns = [
    { key: 'order_number', label: t('orders.orderNumber') },
    { key: 'customer', label: t('common.customerName'), render: (row) => row.customer?.name || '-' },
    { key: 'product_summary', label: t('orders.productSummary') },
    { key: 'item_count', label: t('orders.itemCount') },
    { key: 'total_amount', label: t('common.totalAmount'), render: (row) => money(row.total_amount, row.currency) },
    { key: 'created_date', label: t('common.date') },
    { key: 'created_time', label: t('common.time') },
    { key: 'stock_availability_status', label: t('orders.stockAvailability'), render: (row) => <StatusBadge status={row.stock_availability_status} /> },
    { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={t(`orders.statusLabels.${row.status}`)} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group order-action-group">
          <Button variant="secondary" onClick={() => loadDetail(row.id)}>{t('view')}</Button>
          {row.can_edit && <Button variant="secondary" onClick={() => loadAndEdit(row.id)} ref={editOrderButtonRef}>{t('edit')}</Button>}
          {row.status === 'pending' && <Button variant="secondary" onClick={() => receiveOrder(row)}>{t('orders.markReceived')}</Button>}
          <Button variant="secondary" disabled={!row.can_create_invoice} onClick={() => createInvoice(row.id)}>{t('invoices.createInvoice')}</Button>
          {isAdmin && row.can_cancel && <Button variant="secondary" onClick={() => cancelSelectedOrder(row)} ref={cancelOrderButtonRef}>{cancellingId === row.id ? t('orders.cancelling') : t('orders.cancelOrder')}</Button>}
          <Button variant="secondary" onClick={() => printOrder(row)}>{t('reports.printPdf')}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid workflow-page orders-page">
      <PrintableOrder order={selectedPrintOrder} />
      <Card title={t('orders.listTitle')} subtitle={t('orders.customerOrderSubtitle')}>
        <div className="order-summary-grid">
          <div><span>{t('orders.totalOrders')}</span><strong>{summary?.total_orders ?? 0}</strong></div>
          <div><span>{t('orders.received')}</span><strong>{summary?.received_orders ?? 0}</strong></div>
          <div><span>{t('orders.readyProcessing')}</span><strong>{(summary?.ready_for_shipment_orders ?? 0) + (summary?.processing_orders ?? 0)}</strong></div>
          <div><span>{t('orders.stockShortages')}</span><strong>{summary?.orders_with_stock_shortage ?? 0}</strong></div>
        </div>

        <div className="customer-module-tabs shipment-tabs">
          <button className={`customer-module-tabs__button ${activeTab === 'active' ? 'is-active' : ''}`} onClick={() => switchTab('active')}>{t('orders.activeOrders')}</button>
          <button className={`customer-module-tabs__button ${activeTab === 'ready' ? 'is-active' : ''}`} onClick={() => switchTab('ready')}>{t('orders.readyProcessing')}</button>
          <button className={`customer-module-tabs__button ${activeTab === 'completed' ? 'is-active' : ''}`} onClick={() => switchTab('completed')}>{t('orders.completedOrders')}</button>
          <button className={`customer-module-tabs__button ${activeTab === 'cancelled' ? 'is-active' : ''}`} onClick={() => switchTab('cancelled')}>{t('orders.cancelled')}</button>
        </div>

        <div className="workflow-toolbar orders-toolbar">
          <input name="search" value={filters.search} onChange={updateFilter} placeholder={t('orders.searchPlaceholder')} />
          <select name="status" value={filters.status} onChange={updateFilter}>
            <option value="">{t('orders.allStatuses')}</option>
            {statusOptions.map((value) => <option key={value} value={value}>{t(`orders.statusLabels.${value}`)}</option>)}
          </select>
          <select name="customer" value={filters.customer} onChange={updateFilter}>
            <option value="">{t('orders.allCustomers')}</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <select name="product" value={filters.product} onChange={updateFilter}>
            <option value="">{t('orders.allProducts')}</option>
            {products.map((product) => <option key={product.id} value={product.id}>{productName(product)}</option>)}
          </select>
          <input name="date" type="date" value={filters.date} onChange={updateFilter} />
          <Button onClick={openAddForm} ref={addOrderButtonRef}>{t('orders.addOrder')}</Button>
          <Button variant="secondary" onClick={() => window.print()}>{t('reports.printPdf')}</Button>
        </div>

        {errors.length > 0 && (
          <div className="form-error">
            {errors.map((error) => <p key={error}>{error}</p>)}
            <Button variant="secondary" onClick={() => loadOrders()}>{t('retry')}</Button>
          </div>
        )}

        <AppWindow
          id="orders-order-form"
          title={editingId ? t('orders.editOrder') : t('orders.addOrder')}
          description={t('orders.formSubtitle')}
          isOpen={showForm}
          isDirty={orderFormDirty}
          isSubmitting={saving}
          defaultSize="xlarge"
          openerRef={editingId ? editOrderButtonRef : addOrderButtonRef}
          onClose={() => setShowForm(false)}
        >
          <form className="section-panel order-form" onSubmit={saveOrder}>
            <div className="section-panel__header">
              <div>
                <h3>{editingId ? t('orders.editOrder') : t('orders.addOrder')}</h3>
                <p>{t('orders.formSubtitle')}</p>
              </div>
            </div>

            <div className="form-grid">
              <label>{t('common.customerName')}<select name="customer_id" value={form.customer_id} onChange={updateForm}><option value="">{t('orders.selectCustomer')}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} - {customer.name}</option>)}</select></label>
              <label>{t('orders.customerReference')}<input name="customer_reference" value={form.customer_reference} onChange={updateForm} /></label>
              <label>{t('orders.discount')}<input name="discount_amount" type="number" min="0" step="0.01" value={form.discount_amount} onChange={updateForm} /></label>
              <label className="form-grid--wide">{t('orders.customerNotes')}<textarea name="customer_notes" value={form.customer_notes} onChange={updateForm} /></label>
              <label className="form-grid--wide">{t('orders.internalNotes')}<textarea name="internal_notes" value={form.internal_notes} onChange={updateForm} /></label>
            </div>

            <div className="order-items-editor">
              <div className="section-panel__header">
                <div>
                  <h3>{t('orders.orderItems')}</h3>
                  <p>{t('orders.stockRecheckMessage')}</p>
                </div>
                <Button variant="secondary" onClick={addItem}>{t('orders.addItem')}</Button>
              </div>
              {form.items.map((item, index) => {
                const product = itemProduct(item);
                const unit = itemUnit(item);
                const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                return (
                  <div className="order-item-row" key={index}>
                    <select value={item.product_id} onChange={(event) => updateItem(index, 'product_id', event.target.value)}>
                      <option value="">{t('common.product')}</option>
                      {products.map((row) => <option key={row.id} value={row.id}>{productName(row)}</option>)}
                    </select>
                    <select value={item.product_unit_id} onChange={(event) => updateItem(index, 'product_unit_id', event.target.value)}>
                      <option value="">{t('common.unit')}</option>
                      {(product?.units || []).map((row) => <option key={row.id} value={row.id}>{row.unit}</option>)}
                    </select>
                    <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} placeholder={t('common.quantity')} />
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, 'unit_price', event.target.value)} placeholder={t('orders.unitPrice')} />
                    <input readOnly value={money(lineTotal)} aria-label={t('orders.lineTotal')} />
                    <input value={item.price_override_reason} onChange={(event) => updateItem(index, 'price_override_reason', event.target.value)} placeholder={t('orders.priceOverrideReason')} />
                    <input value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} placeholder={t('common.note')} />
                    <button className="product-action-button product-action-button--delete" type="button" onClick={() => removeItem(index)}>{t('orders.removeItem')}</button>
                    <small>{unit?.minimum_selling_price ? `${t('orders.minimumPrice')}: ${money(unit.minimum_selling_price)}` : t('orders.defaultPriceFromProduct')}</small>
                  </div>
                );
              })}
            </div>

            <div className="order-total-preview">
              <div><span>{t('orders.subtotal')}</span><strong>{money(formPreview.subtotal)}</strong></div>
              <div><span>{t('orders.discount')}</span><strong>{money(formPreview.discount)}</strong></div>
              <div><span>{t('common.totalAmount')}</span><strong>{money(formPreview.total)}</strong></div>
            </div>

            <div className="workflow-actions">
              <Button type="submit" disabled={saving}>{saving ? t('orders.saving') : t('orders.saveOrder')}</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </AppWindow>

        {loading ? <p className="muted-text">{t('orders.loading')}</p> : <Table columns={columns} rows={orders} emptyMessage={t('orders.noOrders')} />}
      </Card>

      {selectedOrder && (
        <Card title={selectedOrder.order_number} subtitle={t('orders.detailSubtitle')}>
          <div className="detail-panel">
            <div><span>{t('common.customerName')}</span><strong>{selectedOrder.customer?.name}</strong></div>
            <div><span>{t('customers.customerCode')}</span><strong>{selectedOrder.customer?.code}</strong></div>
            <div><span>{t('orders.orderStatus')}</span><StatusBadge status={t(`orders.statusLabels.${selectedOrder.status}`)} /></div>
            <div><span>{t('orders.stockAvailability')}</span><StatusBadge status={selectedOrder.stock_availability_status} /></div>
            <div><span>{t('orders.subtotal')}</span><strong>{money(selectedOrder.subtotal, selectedOrder.currency)}</strong></div>
            <div><span>{t('orders.discount')}</span><strong>{money(selectedOrder.discount_amount, selectedOrder.currency)}</strong></div>
            <div><span>{t('common.totalAmount')}</span><strong>{money(selectedOrder.total_amount, selectedOrder.currency)}</strong></div>
            <div><span>{t('orders.administrator')}</span><strong>{selectedOrder.administrator_name || '-'}</strong></div>
          </div>

          <Table
            columns={[
              { key: 'product_name_en_snapshot', label: t('common.product'), render: (row) => isArabic ? row.product_name_ar_snapshot : row.product_name_en_snapshot },
              { key: 'quantity', label: t('common.quantity') },
              { key: 'unit_snapshot', label: t('common.unit') },
              { key: 'unit_price', label: t('orders.unitPrice'), render: (row) => money(row.unit_price, selectedOrder.currency) },
              { key: 'line_total', label: t('orders.lineTotal'), render: (row) => money(row.line_total, selectedOrder.currency) },
              { key: 'availability', label: t('orders.stockAvailability'), render: (row) => `${t(`orders.availabilityLabels.${row.availability?.availability_status}`)} (${row.availability?.available_quantity})` },
            ]}
            rows={selectedOrder.items || []}
            emptyMessage={t('orders.noItems')}
          />

          <div className="note-grid">
            <div><strong>{t('orders.customerNotes')}</strong><p>{selectedOrder.customer_notes || '-'}</p></div>
            <div><strong>{t('orders.internalNotes')}</strong><p>{selectedOrder.internal_notes || '-'}</p></div>
            <div><strong>{t('orders.workflowInformation')}</strong><p>{t('orders.workflowNote')}</p></div>
          </div>

          <div className="workflow-actions">
            {selectedOrder.can_edit && <Button variant="secondary" onClick={() => openEditForm(selectedOrder)} ref={editOrderButtonRef}>{t('edit')}</Button>}
            {selectedOrder.status === 'pending' && <Button variant="secondary" onClick={() => receiveOrder(selectedOrder)}>{t('orders.markReceived')}</Button>}
            <Button variant="secondary" disabled={!selectedOrder.can_create_invoice} onClick={() => createInvoice(selectedOrder.id)}>{t('invoices.createInvoice')}</Button>
            {isAdmin && selectedOrder.can_cancel && <Button variant="secondary" onClick={() => cancelSelectedOrder(selectedOrder)} ref={cancelOrderButtonRef}>{t('orders.cancelOrder')}</Button>}
            <Button onClick={() => window.print()}>{t('reports.printPdf')}</Button>
            <Button variant="secondary" onClick={() => setSelectedOrder(null)}>{t('customers.closeSection')}</Button>
          </div>
        </Card>
      )}

      <AppWindow
        id="order-cancel"
        title={t('orders.cancelOrder')}
        description={t('orders.cancellationReason')}
        isOpen={Boolean(cancelDialog)}
        isDirty={cancelDirty}
        isSubmitting={Boolean(cancellingId)}
        defaultSize="medium"
        openerRef={cancelOrderButtonRef}
        onClose={() => {
          setCancelDialog(null);
          setCancelReason('');
        }}
      >
        {cancelDialog && (
          <form className="section-panel" onSubmit={confirmCancelOrder}>
            <div className="form-grid form-grid--single">
              <label>
                {t('orders.cancellationReason')}
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required />
              </label>
            </div>
            <div className="workflow-actions">
              <Button type="submit" disabled={Boolean(cancellingId)}>{cancellingId ? t('orders.cancelling') : t('orders.cancelOrder')}</Button>
              <Button type="button" variant="secondary" onClick={() => setCancelDialog(null)} disabled={Boolean(cancellingId)}>{t('cancel')}</Button>
            </div>
          </form>
        )}
      </AppWindow>
    </div>
  );
}
