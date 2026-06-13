import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { formatCurrency, invoices, pendingCustomerRequests } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const invoiceStorageKey = 'bayadIssuedInvoices';
const orderStorageKey = 'bayadGeneratedOrders';
const productOptions = ['Corn', 'White Sesame', 'Red Sesame', 'Plastic', 'Sacks / Khaysh', 'Dabara', 'Other'];
const unitOptions = ['Qintar', 'Large Bag', 'Small Bag', 'kg', 'Bag / Jowal', 'Piece', 'Roll', 'Bundle', 'Bale', 'Other'];
const paymentStatuses = ['Pending', 'Partially Paid', 'Paid'];
const invoiceStatuses = ['Created', 'Printed', 'Completed', 'Cancelled'];

const initialFilters = {
  productType: '',
  status: '',
  date: '',
  search: '',
};

function readStoredRows(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(stored) && stored.length > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredRows(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function createEmptyForm() {
  return {
    sourceRequestId: '',
    orderSource: 'Admin Invoice',
    invoiceNo: '',
    customerName: '',
    phone: '',
    product: 'Corn',
    quantity: '',
    unit: 'Bag / Jowal',
    price: '',
    totalAmount: '',
    paymentStatus: 'Pending',
    notes: '',
    adminName: 'Admin',
  };
}

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

function formatInvoiceNumber(invoiceDate, currentInvoices) {
  const year = (invoiceDate || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const nextNumber = currentInvoices.length + 1;
  return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
}

function formatOrderNumber(currentOrders) {
  return `ORD-${String(currentOrders.length + 1).padStart(4, '0')}`;
}

function invoiceToOrder(invoice, currentOrders) {
  const existingOrder = currentOrders.find((order) => order.invoiceNo === invoice.invoiceNo);
  return {
    id: existingOrder?.id || Date.now(),
    orderNo: existingOrder?.orderNo || formatOrderNumber(currentOrders),
    invoiceNo: invoice.invoiceNo,
    customer: invoice.customerName,
    phone: invoice.phone,
    product: invoice.product,
    quantity: invoice.quantity,
    unit: invoice.unit,
    orderSource: invoice.orderSource,
    status: existingOrder?.status || 'Pending',
    paymentStatus: invoice.paymentStatus,
    shipmentStatus: existingOrder?.shipmentStatus || 'Pending',
    orderDate: invoice.date,
    orderTime: invoice.time,
    totalAmount: invoice.totalAmount,
    notes: invoice.notes || '',
  };
}

function upsertGeneratedOrder(invoice) {
  const currentOrders = readStoredRows(orderStorageKey, []);
  const nextOrder = invoiceToOrder(invoice, currentOrders);
  const nextOrders = currentOrders.some((order) => order.invoiceNo === invoice.invoiceNo)
    ? currentOrders.map((order) => (order.invoiceNo === invoice.invoiceNo ? { ...order, ...nextOrder } : order))
    : [nextOrder, ...currentOrders];

  writeStoredRows(orderStorageKey, nextOrders);
}

export default function Invoices() {
  const { t } = useLanguage();
  const [invoiceRows, setInvoiceRows] = useState(() => readStoredRows(invoiceStorageKey, invoices));
  const [requestRows, setRequestRows] = useState(pendingCustomerRequests);
  const [filters, setFilters] = useState(initialFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [errors, setErrors] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const productLabel = (value) => t(`invoices.productTypes.${value}`) || value;
  const unitLabel = (value) => t(`invoices.unitPackagingOptions.${value}`) || value;
  const sourceLabel = (value) => t(`orders.sources.${value}`) || value;

  const filteredInvoices = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return invoiceRows.filter((invoice) => {
      const matchesProduct = !filters.productType || invoice.product === filters.productType || invoice.productType === filters.productType;
      const matchesStatus = !filters.status || invoice.status === filters.status;
      const matchesDate = !filters.date || invoice.date === filters.date;
      const searchableText = `${invoice.invoiceNo} ${invoice.customerName || invoice.personName} ${invoice.product || invoice.productType}`.toLowerCase();
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);

      return matchesProduct && matchesStatus && matchesDate && matchesSearch;
    });
  }, [filters, invoiceRows]);

  function normalizeInvoice(invoice) {
    return {
      ...invoice,
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customerName || invoice.personName || invoice.customer,
      product: invoice.product || invoice.productType,
      unit: invoice.unit || invoice.unitPackaging,
      price: Number(invoice.price || 0),
      quantity: Number(invoice.quantity || 0),
      totalAmount: Number(invoice.totalAmount || 0),
      paymentStatus: invoice.paymentStatus || 'Pending',
      orderSource: invoice.orderSource || 'Admin Invoice',
      status: invoice.status || 'Created',
    };
  }

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'quantity' || name === 'price') {
        const quantity = Number(name === 'quantity' ? value : next.quantity);
        const price = Number(name === 'price' ? value : next.price);
        next.totalAmount = quantity > 0 && price >= 0 ? quantity * price : '';
      }
      return next;
    });
  }

  function openCreateForm() {
    setEditingInvoiceId(null);
    setSelectedInvoice(null);
    setErrors([]);
    setForm(createEmptyForm());
    setShowForm(true);
  }

  function openRequestInvoiceForm(request) {
    const nextForm = createEmptyForm();
    setEditingInvoiceId(null);
    setSelectedInvoice(null);
    setErrors([]);
    setForm({
      ...nextForm,
      sourceRequestId: request.requestId,
      orderSource: 'Mobile App Request',
      customerName: request.customerName,
      phone: request.phone,
      product: request.product,
      quantity: request.quantity,
      unit: request.unit,
      price: request.price,
      totalAmount: Number(request.quantity) * Number(request.price),
      notes: request.notes,
    });
    setShowForm(true);
  }

  function openEditForm(invoice) {
    const normalizedInvoice = normalizeInvoice(invoice);
    setEditingInvoiceId(invoice.id);
    setSelectedInvoice(null);
    setErrors([]);
    setForm({
      sourceRequestId: normalizedInvoice.sourceRequestId || '',
      orderSource: normalizedInvoice.orderSource,
      invoiceNo: normalizedInvoice.invoiceNo,
      customerName: normalizedInvoice.customerName,
      phone: normalizedInvoice.phone || '',
      product: normalizedInvoice.product,
      quantity: normalizedInvoice.quantity,
      unit: normalizedInvoice.unit,
      price: normalizedInvoice.price,
      totalAmount: normalizedInvoice.totalAmount,
      paymentStatus: normalizedInvoice.paymentStatus,
      notes: normalizedInvoice.notes || '',
      adminName: normalizedInvoice.adminName || 'Admin',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingInvoiceId(null);
    setErrors([]);
    setForm(createEmptyForm());
  }

  function validateForm() {
    const nextErrors = [];

    if (!form.customerName.trim() || !form.product || !form.unit || !form.adminName.trim()) {
      nextErrors.push(t('invoices.requiredFieldsError'));
    }

    if (Number(form.quantity) <= 0) nextErrors.push(t('invoices.quantityPositiveError'));
    if (Number(form.price) < 0) nextErrors.push(t('invoices.pricePositiveError'));

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function saveInvoice(event) {
    event.preventDefault();
    if (!validateForm()) return;

    let savedInvoice;
    const timestamp = getCurrentDateTime();
    const baseInvoice = {
      ...form,
      date: timestamp.date,
      time: timestamp.time,
      invoiceNo: form.invoiceNo || formatInvoiceNumber(timestamp.date, invoiceRows),
      quantity: Number(form.quantity),
      price: Number(form.price || 0),
      totalAmount: Number(form.totalAmount || Number(form.quantity) * Number(form.price || 0)),
      status: 'Created',
    };

    const nextRows = editingInvoiceId
      ? invoiceRows.map((invoice) => {
          if (invoice.id !== editingInvoiceId) return invoice;
          savedInvoice = { ...normalizeInvoice(invoice), ...baseInvoice };
          return savedInvoice;
        })
      : [{ id: Date.now(), ...baseInvoice }, ...invoiceRows];

    if (!editingInvoiceId) savedInvoice = nextRows[0];

    setInvoiceRows(nextRows);
    writeStoredRows(invoiceStorageKey, nextRows);
    upsertGeneratedOrder(savedInvoice);
    setSelectedInvoice(savedInvoice);

    if (savedInvoice.sourceRequestId) {
      setRequestRows((current) => current.map((request) => (
        request.requestId === savedInvoice.sourceRequestId ? { ...request, status: 'Invoice Issued' } : request
      )));
    }

    closeForm();
  }

  function cancelInvoice(invoiceId) {
    const nextRows = invoiceRows.map((invoice) => (
      invoice.id === invoiceId ? { ...invoice, status: 'Cancelled', statusUpdatedDate: getCurrentDateTime().date, statusUpdatedTime: getCurrentDateTime().time } : invoice
    ));
    setInvoiceRows(nextRows);
    writeStoredRows(invoiceStorageKey, nextRows);
    setSelectedInvoice((current) => (
      current?.id === invoiceId ? { ...current, status: 'Cancelled', statusUpdatedDate: getCurrentDateTime().date, statusUpdatedTime: getCurrentDateTime().time } : current
    ));
  }

  function printInvoice(invoice) {
    const timestamp = getCurrentDateTime();
    const printableInvoice = invoice.status === 'Created' ? { ...invoice, status: 'Printed', statusUpdatedDate: timestamp.date, statusUpdatedTime: timestamp.time } : invoice;
    const nextRows = invoiceRows.map((row) => (
      row.id === invoice.id && row.status === 'Created' ? printableInvoice : row
    ));
    setInvoiceRows(nextRows);
    writeStoredRows(invoiceStorageKey, nextRows);
    setSelectedInvoice(printableInvoice);
    window.setTimeout(() => window.print(), 100);
  }

  const requestColumns = [
    { key: 'requestId', label: t('invoices.requestId') },
    { key: 'customerName', label: t('common.customerName') },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'requestDate', label: t('invoices.requestDate') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        row.status === 'Invoice Issued'
          ? <StatusBadge status="Invoice Issued" />
          : <Button variant="secondary" onClick={() => openRequestInvoiceForm(row)}>{t('invoices.createInvoice')}</Button>
      ),
    },
  ];

  const columns = [
    { key: 'invoiceNo', label: t('common.invoiceNumber') },
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'customerName', label: t('common.customerName'), render: (row) => normalizeInvoice(row).customerName },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(normalizeInvoice(row).product) },
    { key: 'quantity', label: t('common.quantity'), render: (row) => normalizeInvoice(row).quantity },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(normalizeInvoice(row).unit) },
    { key: 'price', label: t('common.price'), render: (row) => formatCurrency(normalizeInvoice(row).price) },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(normalizeInvoice(row).totalAmount) },
    { key: 'paymentStatus', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={normalizeInvoice(row).paymentStatus} /> },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          <Tooltip content={t('invoices.viewTooltip')}>
            <button className="link-button" type="button" onClick={() => setSelectedInvoice(normalizeInvoice(row))}>{t('view')}</button>
          </Tooltip>
          <Tooltip content={t('tooltips.edit')}>
            <button className="link-button" type="button" onClick={() => openEditForm(row)}>{t('edit')}</button>
          </Tooltip>
          <Tooltip content={t('invoices.printTooltip')}>
            <button className="link-button" type="button" onClick={() => printInvoice(row)}>{t('invoices.print')}</button>
          </Tooltip>
          <Tooltip content={t('invoices.cancelTooltip')}>
            <button className="link-button link-button--danger" type="button" onClick={() => cancelInvoice(row.id)}>{t('cancel')}</button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const selected = selectedInvoice ? normalizeInvoice(selectedInvoice) : null;

  return (
    <div className="page-grid invoice-management-page">
      <Card title={t('invoices.pendingRequestsTitle')} subtitle={t('invoices.pendingRequestsSubtitle')}>
        <Table columns={requestColumns} rows={requestRows} emptyMessage={t('invoices.noRequests')} />
      </Card>

      <Card title={t('invoices.listTitle')} subtitle={t('invoices.listSubtitle')}>
        <div className="workflow-toolbar">
          <div>
            <h3>{t('invoices.managementTitle')}</h3>
            <p>{t('invoices.managementSubtitle')}</p>
          </div>
          <Button onClick={openCreateForm} tooltip={t('invoices.createTooltip')}>
            {t('invoices.createNewInvoice')}
          </Button>
        </div>

        <div className="report-filter-grid invoice-filter-grid">
          <label>{t('invoices.productType')}<select name="productType" value={filters.productType} onChange={updateFilter}><option value="">{t('invoices.allProducts')}</option>{productOptions.map((product) => <option key={product} value={product}>{productLabel(product)}</option>)}</select></label>
          <label>{t('common.status')}<select name="status" value={filters.status} onChange={updateFilter}><option value="">{t('invoices.allStatuses')}</option>{invoiceStatuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label>
          <label>{t('common.date')}<input name="date" type="date" value={filters.date} onChange={updateFilter} /></label>
          <label className="invoice-filter-grid__search">{t('invoices.search')}<input name="search" type="search" value={filters.search} onChange={updateFilter} placeholder={t('invoices.searchPlaceholder')} /></label>
        </div>

        {showForm && (
          <form className="section-panel invoice-form" onSubmit={saveInvoice}>
            <div className="section-panel__header">
              <div>
                <h3>{editingInvoiceId ? t('invoices.editTitle') : t('invoices.createTitle')}</h3>
                <p>{form.sourceRequestId ? t('invoices.mobileRequestInvoiceSubtitle') : t('invoices.formSubtitle')}</p>
              </div>
              <span className="muted-text">{form.invoiceNo || t('invoices.invoiceNumberGenerated')}</span>
            </div>

            {errors.length > 0 && <div className="form-error">{errors.map((error) => <p key={error}>{error}</p>)}</div>}

            <div className="form-grid">
              <label>{t('common.invoiceNumber')}<input name="invoiceNo" value={form.invoiceNo || t('invoices.autoGenerated')} readOnly /></label>
              <label>{t('common.customerName')}<input name="customerName" value={form.customerName} onChange={updateForm} placeholder={t('common.customerName')} /></label>
              <label>{t('common.phone')}<input name="phone" value={form.phone} onChange={updateForm} placeholder={t('common.phone')} /></label>
              <label>{t('common.product')}<select name="product" value={form.product} onChange={updateForm}>{productOptions.map((product) => <option key={product} value={product}>{productLabel(product)}</option>)}</select></label>
              <label>{t('common.quantity')}<input name="quantity" type="number" min="1" value={form.quantity} onChange={updateForm} placeholder="0" /></label>
              <label>{t('common.unit')}<select name="unit" value={form.unit} onChange={updateForm}>{unitOptions.map((unit) => <option key={unit} value={unit}>{unitLabel(unit)}</option>)}</select></label>
              <label>{t('common.price')}<input name="price" type="number" min="0" value={form.price} onChange={updateForm} placeholder="0" /></label>
              <label>{t('common.totalAmount')}<input name="totalAmount" type="number" min="0" value={form.totalAmount} onChange={updateForm} placeholder="0" /></label>
              <label>{t('orders.paymentStatus')}<select name="paymentStatus" value={form.paymentStatus} onChange={updateForm}>{paymentStatuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label>
              <label>{t('invoices.adminName')}<input name="adminName" value={form.adminName} onChange={updateForm} placeholder={t('invoices.adminNamePlaceholder')} /></label>
              <label className="form-grid--wide">{t('invoices.notes')}<textarea name="notes" value={form.notes} onChange={updateForm} placeholder={t('invoices.notesPlaceholder')} /></label>
            </div>

            <div className="workflow-actions">
              <Button type="submit" tooltip={t('tooltips.saveTransaction')}>{editingInvoiceId ? t('invoices.updateInvoice') : t('invoices.issueInvoice')}</Button>
              <Button variant="secondary" onClick={closeForm} tooltip={t('tooltips.cancel')}>{t('cancel')}</Button>
            </div>
          </form>
        )}

        <Table columns={columns} rows={filteredInvoices} emptyMessage={t('invoices.noInvoices')} />
      </Card>

      {selected && (
        <Card title={t('invoices.previewTitle')} subtitle={t('invoices.previewSubtitle')}>
          <div className="invoice-preview-actions no-print">
            <Button onClick={() => printInvoice(selected)} tooltip={t('invoices.printTooltip')}>{t('invoices.printInvoice')}</Button>
            <Button variant="secondary" onClick={() => setSelectedInvoice(null)} tooltip={t('tooltips.cancel')}>{t('invoices.closePreview')}</Button>
          </div>

          <div className="invoice-print-page">
            <article className="invoice-document">
              <header className="invoice-document__header">
                <div><strong>{t('companyName')}</strong><span>{t('invoices.systemName')}</span></div>
                <div className="invoice-document__meta"><span>{t('invoices.officialInvoice')}</span><strong>{selected.invoiceNo}</strong></div>
              </header>

              <section className="invoice-document__section invoice-document__summary">
                <div><span>{t('common.date')}</span><strong>{selected.date}</strong></div>
                <div><span>{t('common.time')}</span><strong>{selected.time}</strong></div>
                <div><span>{t('orders.orderSource')}</span><strong>{sourceLabel(selected.orderSource)}</strong></div>
                <div><span>{t('orders.paymentStatus')}</span><StatusBadge status={selected.paymentStatus} /></div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.personDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('common.customerName')}</span><strong>{selected.customerName}</strong></div>
                  <div><span>{t('common.phone')}</span><strong>{selected.phone || '-'}</strong></div>
                  <div><span>{t('invoices.adminName')}</span><strong>{selected.adminName}</strong></div>
                  <div><span>{t('common.status')}</span><StatusBadge status={selected.status} /></div>
                </div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.productDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('common.product')}</span><strong>{productLabel(selected.product)}</strong></div>
                  <div><span>{t('common.quantity')}</span><strong>{selected.quantity}</strong></div>
                  <div><span>{t('common.unit')}</span><strong>{unitLabel(selected.unit)}</strong></div>
                  <div><span>{t('common.price')}</span><strong>{formatCurrency(selected.price)}</strong></div>
                  <div><span>{t('common.totalAmount')}</span><strong>{formatCurrency(selected.totalAmount)}</strong></div>
                  <div><span>{t('invoices.notes')}</span><strong>{selected.notes || t('warehouse.noNotes')}</strong></div>
                </div>
              </section>

              <footer className="invoice-document__signatures">
                <div><span>{t('invoices.adminSignature')}</span><strong>{t('invoices.signatureLine')}</strong></div>
                <div><span>{t('invoices.companyStamp')}</span><strong>{t('invoices.signatureLine')}</strong></div>
                <div><span>{t('invoices.personSignature')}</span><strong>{t('invoices.signatureLine')}</strong></div>
              </footer>
            </article>
          </div>
        </Card>
      )}
    </div>
  );
}
