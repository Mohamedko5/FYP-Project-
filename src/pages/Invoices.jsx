import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { formatCurrency, invoices, products } from '../data/dummyData.js';
import { useCurrency } from '../i18n/CurrencyContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const invoiceStorageKey = 'bayadIssuedInvoices';
const orderStorageKey = 'bayadGeneratedOrders';
const shipmentStorageKey = 'bayadShipments';
const paymentStorageKey = 'bayadPaymentHistory';

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

function readStoredRows(key, fallback = []) {
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

function normalizeInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    orderNo: invoice.orderNo || '',
    customerName: invoice.customerName || invoice.personName || invoice.customer || '',
    phone: invoice.phone || '',
    product: invoice.product || invoice.productType || '',
    quantity: Number(invoice.quantity || 0),
    unit: invoice.unit || invoice.unitPackaging || 'Qintar',
    price: Number(invoice.price || 0),
    totalAmount: Number(invoice.totalAmount || 0),
    currency: invoice.currency || 'SDG',
    paymentStatus: invoice.paymentStatus === 'Pending' || invoice.paymentStatus === 'Partially Paid' ? 'Unpaid' : invoice.paymentStatus || 'Unpaid',
    status: invoice.status === 'Created' || invoice.status === 'Printed' ? 'Issued' : invoice.status || 'Issued',
    date: invoice.date,
    time: invoice.time,
    adminName: invoice.adminName || 'Admin',
    notes: invoice.notes || '',
  };
}

function seedInvoices() {
  return invoices.map(normalizeInvoice);
}

function shipmentIdFromInvoice(invoice) {
  return `SHP-${invoice.invoiceNo.replace(/[^0-9]/g, '').slice(-6) || Date.now()}`;
}

function productPrice(productName) {
  return Number(products.find((product) => product.name === productName)?.price || 0);
}

function formatInvoiceNumber(invoiceDate, currentInvoices) {
  const year = invoiceDate.slice(0, 4);
  return `INV-${year}-${String(currentInvoices.length + 1).padStart(4, '0')}`;
}

function createDraftFromOrder(order, currencyCode, currentInvoices) {
  const timestamp = getCurrentDateTime();
  const price = productPrice(order.product);
  return {
    id: '',
    invoiceNo: formatInvoiceNumber(timestamp.date, currentInvoices),
    orderNo: order.orderNo,
    customerName: order.customer,
    phone: order.phone || '',
    product: order.product,
    quantity: Number(order.quantity || 0),
    unit: order.unit,
    price,
    totalAmount: Number(order.totalAmount || Number(order.quantity || 0) * price),
    currency: currencyCode,
    paymentStatus: 'Unpaid',
    status: 'Issued',
    adminName: 'Admin',
    notes: order.notes || '',
  };
}

export default function Invoices() {
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoiceRows, setInvoiceRows] = useState(() => readStoredRows(invoiceStorageKey, seedInvoices()).map(normalizeInvoice));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [filter, setFilter] = useState('');
  const [activeInvoiceTab, setActiveInvoiceTab] = useState('unpaid');
  const [draftInvoice, setDraftInvoice] = useState(null);

  const selectedInvoice = invoiceRows.find((invoice) => String(invoice.id) === String(selectedInvoiceId));
  const productLabel = (value) => t(`invoices.productTypes.${value}`) || value;
  const unitLabel = (value) => t(`invoices.unitPackagingOptions.${value}`) || value;

  useEffect(() => {
    const order = location.state?.orderForInvoice;
    if (!order) return;

    const existingInvoice = invoiceRows.find((invoice) => invoice.orderNo === order.orderNo);
    if (existingInvoice) {
      setSelectedInvoiceId(existingInvoice.id);
    } else {
      setSelectedInvoiceId('');
      setDraftInvoice(createDraftFromOrder(order, currency, invoiceRows));
    }
    navigate('/invoices', { replace: true, state: null });
  }, [currency, invoiceRows, location.state, navigate]);

  const visibleInvoices = useMemo(() => {
    if (activeInvoiceTab === 'paid') return invoiceRows.filter((invoice) => invoice.paymentStatus === 'Paid');
    if (activeInvoiceTab === 'history') return invoiceRows;
    return invoiceRows.filter((invoice) => invoice.paymentStatus !== 'Paid' && invoice.status !== 'Cancelled');
  }, [activeInvoiceTab, invoiceRows]);

  const filteredInvoices = useMemo(() => {
    const search = filter.trim().toLowerCase();
    if (!search) return visibleInvoices;
    return visibleInvoices.filter((invoice) => `${invoice.invoiceNo} ${invoice.orderNo} ${invoice.customerName} ${invoice.product}`.toLowerCase().includes(search));
  }, [filter, visibleInvoices]);

  function updateInvoices(nextRows) {
    setInvoiceRows(nextRows);
    writeStoredRows(invoiceStorageKey, nextRows);
  }

  function updateStoredOrder(invoice, updates) {
    const currentOrders = readStoredRows(orderStorageKey, []);
    writeStoredRows(orderStorageKey, currentOrders.map((order) => (
      order.orderNo === invoice.orderNo ? { ...order, ...updates } : order
    )));
  }

  function updateDraft(event) {
    const { name, value } = event.target;
    setDraftInvoice((current) => {
      const next = { ...current, [name]: value };
      if (name === 'price' || name === 'quantity') {
        next.totalAmount = Number(next.quantity || 0) * Number(next.price || 0);
      }
      return next;
    });
  }

  function saveInvoice(event) {
    event.preventDefault();
    const timestamp = getCurrentDateTime();
    const invoice = {
      ...draftInvoice,
      id: Date.now(),
      quantity: Number(draftInvoice.quantity || 0),
      price: Number(draftInvoice.price || 0),
      totalAmount: Number(draftInvoice.totalAmount || 0),
      date: timestamp.date,
      time: timestamp.time,
      paymentStatus: 'Unpaid',
      status: 'Issued',
    };
    const nextRows = [invoice, ...invoiceRows];
    updateInvoices(nextRows);
    updateStoredOrder(invoice, {
      invoiceNo: invoice.invoiceNo,
      status: 'Invoiced',
      paymentStatus: 'Unpaid',
      totalAmount: invoice.totalAmount,
      shipmentStatus: 'Not Ready',
    });
    setDraftInvoice(null);
    setSelectedInvoiceId(invoice.id);
    setActiveInvoiceTab('unpaid');
  }

  function upsertReadyShipment(invoice) {
    const currentShipments = readStoredRows(shipmentStorageKey, []);
    if (currentShipments.some((shipment) => shipment.invoiceNo === invoice.invoiceNo)) return;
    const timestamp = getCurrentDateTime();
    const shipment = {
      id: Date.now(),
      shipmentId: shipmentIdFromInvoice(invoice),
      invoiceNo: invoice.invoiceNo,
      orderNo: invoice.orderNo,
      customer: invoice.customerName,
      product: invoice.product,
      requestedQuantity: invoice.quantity,
      unit: invoice.unit,
      paymentStatus: 'Paid',
      status: 'Ready for Shipment',
      warehouseName: '',
      actualQuantity: '',
      numberOfBags: '',
      totalWeight: '',
      averageBagWeight: '',
      driverName: '',
      notes: invoice.notes || '',
      date: timestamp.date,
      time: timestamp.time,
    };
    writeStoredRows(shipmentStorageKey, [shipment, ...currentShipments]);
  }

  function recordPayment(invoice) {
    const timestamp = getCurrentDateTime();
    const payments = readStoredRows(paymentStorageKey, []);
    writeStoredRows(paymentStorageKey, [
      {
        id: Date.now(),
        invoiceNo: invoice.invoiceNo,
        orderNo: invoice.orderNo,
        customer: invoice.customerName,
        amount: invoice.totalAmount,
        currency,
        date: timestamp.date,
        time: timestamp.time,
        type: 'Paid invoice for requested goods',
        notes: invoice.notes || '',
      },
      ...payments,
    ]);
  }

  function markAsPaid(invoice) {
    const timestamp = getCurrentDateTime();
    const paidInvoice = {
      ...invoice,
      paymentStatus: 'Paid',
      status: 'Paid',
      paidDate: timestamp.date,
      paidTime: timestamp.time,
    };
    const nextRows = invoiceRows.map((row) => (row.id === invoice.id ? paidInvoice : row));
    updateInvoices(nextRows);
    setSelectedInvoiceId(invoice.id);
    updateStoredOrder(invoice, {
      status: 'Paid',
      paymentStatus: 'Paid',
      shipmentStatus: 'Ready for Shipment',
      invoiceNo: invoice.invoiceNo,
    });
    recordPayment(paidInvoice);
    upsertReadyShipment(paidInvoice);
  }

  function cancelInvoice(invoice) {
    const timestamp = getCurrentDateTime();
    const nextRows = invoiceRows.map((row) => (
      row.id === invoice.id ? { ...row, status: 'Cancelled', statusUpdatedDate: timestamp.date, statusUpdatedTime: timestamp.time } : row
    ));
    updateInvoices(nextRows);
    updateStoredOrder(invoice, { status: 'Pending', paymentStatus: 'Unpaid', shipmentStatus: 'Not Ready', invoiceNo: '' });
  }

  function printInvoice(invoice) {
    setSelectedInvoiceId(invoice.id);
    window.setTimeout(() => window.print(), 100);
  }

  const columns = [
    { key: 'invoiceNo', label: t('common.invoiceNumber') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'customerName', label: t('common.customerName') },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paymentStatus', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => <Button variant="secondary" onClick={() => setSelectedInvoiceId(row.id)}>{t('view')}</Button>,
    },
  ];

  return (
    <div className="page-grid invoice-management-page">
      <Card title={t('invoices.listTitle')} subtitle={t('invoices.billWorkflowSubtitle')}>
        <div className="workflow-toolbar">
          <div>
            <h3>{t('invoices.managementTitle')}</h3>
            <p>{t('invoices.paymentRequiredSubtitle')}</p>
          </div>
          <label className="invoice-filter-grid__search">
            {t('invoices.search')}
            <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('invoices.searchPlaceholder')} />
          </label>
        </div>
        <div className="customer-module-tabs shipment-tabs">
          <button className={`customer-module-tabs__button ${activeInvoiceTab === 'unpaid' ? 'is-active' : ''}`} onClick={() => setActiveInvoiceTab('unpaid')}>{t('invoices.unpaidInvoices')}</button>
          <button className={`customer-module-tabs__button ${activeInvoiceTab === 'paid' ? 'is-active' : ''}`} onClick={() => setActiveInvoiceTab('paid')}>{t('invoices.paidInvoices')}</button>
          <button className={`customer-module-tabs__button ${activeInvoiceTab === 'history' ? 'is-active' : ''}`} onClick={() => setActiveInvoiceTab('history')}>{t('invoices.invoiceHistory')}</button>
        </div>

        {draftInvoice && (
          <form className="section-panel invoice-form" onSubmit={saveInvoice}>
            <div className="section-panel__header">
              <div>
                <h3>{t('invoices.createTitle')}</h3>
                <p>{t('invoices.formSubtitle')}</p>
              </div>
              <span className="muted-text">{draftInvoice.invoiceNo}</span>
            </div>
            <div className="form-grid">
              <label>{t('common.invoiceNumber')}<input value={draftInvoice.invoiceNo} readOnly /></label>
              <label>{t('common.orderNumber')}<input value={draftInvoice.orderNo} readOnly /></label>
              <label>{t('common.customerName')}<input value={draftInvoice.customerName} readOnly /></label>
              <label>{t('common.phone')}<input name="phone" value={draftInvoice.phone} onChange={updateDraft} /></label>
              <label>{t('common.product')}<input value={productLabel(draftInvoice.product)} readOnly /></label>
              <label>{t('common.quantity')}<input name="quantity" type="number" min="1" value={draftInvoice.quantity} onChange={updateDraft} /></label>
              <label>{t('common.unit')}<input value={unitLabel(draftInvoice.unit)} readOnly /></label>
              <label>{t('common.price')}<input name="price" type="number" min="0" value={draftInvoice.price} onChange={updateDraft} /></label>
              <label>{t('common.totalAmount')}<input value={draftInvoice.totalAmount} readOnly /></label>
              <label>{t('currency.label')}<input value={draftInvoice.currency} readOnly /></label>
              <label>{t('orders.paymentStatus')}<input value={t('status.Unpaid')} readOnly /></label>
              <label>{t('invoices.adminName')}<input name="adminName" value={draftInvoice.adminName} onChange={updateDraft} /></label>
              <label className="form-grid--wide">{t('invoices.notes')}<textarea name="notes" value={draftInvoice.notes} onChange={updateDraft} /></label>
            </div>
            <div className="workflow-actions">
              <Button type="submit">{t('invoices.saveInvoice')}</Button>
              <Button type="button" variant="secondary" onClick={() => setDraftInvoice(null)}>{t('cancel')}</Button>
            </div>
          </form>
        )}

        <Table columns={columns} rows={filteredInvoices} emptyMessage={t('invoices.noInvoices')} />
      </Card>

      {selectedInvoice && (
        <Card title={t('invoices.previewTitle')} subtitle={selectedInvoice.invoiceNo}>
          <div className="invoice-preview-actions no-print">
            <Button onClick={() => printInvoice(selectedInvoice)}>{t('reports.printPdf')}</Button>
            {selectedInvoice.paymentStatus !== 'Paid' && selectedInvoice.status !== 'Cancelled' && (
              <Button variant="secondary" onClick={() => markAsPaid(selectedInvoice)}>{t('invoices.markAsPaid')}</Button>
            )}
            {selectedInvoice.status !== 'Cancelled' && selectedInvoice.paymentStatus !== 'Paid' && (
              <Button variant="secondary" onClick={() => cancelInvoice(selectedInvoice)}>{t('cancel')}</Button>
            )}
            <Button variant="secondary" onClick={() => setSelectedInvoiceId('')}>{t('invoices.closePreview')}</Button>
          </div>

          <div className="invoice-print-page print-area">
            <article className="invoice-document">
              <header className="invoice-document__header">
                <div><strong>{t('companyName')}</strong><span>{t('invoices.systemName')}</span></div>
                <div className="invoice-document__meta"><span>{t('invoices.officialInvoice')}</span><strong>{selectedInvoice.invoiceNo}</strong></div>
              </header>

              <section className="invoice-document__section invoice-document__summary">
                <div><span>{t('common.orderNumber')}</span><strong>{selectedInvoice.orderNo || '-'}</strong></div>
                <div><span>{t('common.date')}</span><strong>{selectedInvoice.date}</strong></div>
                <div><span>{t('common.time')}</span><strong>{selectedInvoice.time}</strong></div>
                <div><span>{t('currency.label')}</span><strong>{selectedInvoice.currency || currency}</strong></div>
                <div><span>{t('orders.paymentStatus')}</span><StatusBadge status={selectedInvoice.paymentStatus} /></div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.personDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('common.customerName')}</span><strong>{selectedInvoice.customerName}</strong></div>
                  <div><span>{t('common.phone')}</span><strong>{selectedInvoice.phone || '-'}</strong></div>
                  <div><span>{t('invoices.adminName')}</span><strong>{selectedInvoice.adminName}</strong></div>
                  <div><span>{t('common.status')}</span><StatusBadge status={selectedInvoice.status} /></div>
                </div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.productDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('common.product')}</span><strong>{productLabel(selectedInvoice.product)}</strong></div>
                  <div><span>{t('common.quantity')}</span><strong>{selectedInvoice.quantity}</strong></div>
                  <div><span>{t('common.unit')}</span><strong>{unitLabel(selectedInvoice.unit)}</strong></div>
                  <div><span>{t('common.price')}</span><strong>{formatCurrency(selectedInvoice.price)}</strong></div>
                  <div><span>{t('common.totalAmount')}</span><strong>{formatCurrency(selectedInvoice.totalAmount)}</strong></div>
                  <div><span>{t('invoices.notes')}</span><strong>{selectedInvoice.notes || t('warehouse.noNotes')}</strong></div>
                </div>
              </section>

              <footer className="invoice-document__signatures">
                <div><span>{t('invoices.adminSignature')}</span><strong>{t('invoices.signatureLine')}</strong></div>
                <div><span>{t('invoices.customerSignature')}</span><strong>{t('invoices.signatureLine')}</strong></div>
              </footer>
            </article>
          </div>
        </Card>
      )}
    </div>
  );
}
