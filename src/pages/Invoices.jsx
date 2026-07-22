import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { getCustomers } from '../services/customersApi.js';
import {
  cancelInvoice,
  createInvoiceFromOrder,
  getInvoiceSummary,
  getInvoices,
  markInvoicePaid,
} from '../services/invoicesApi.js';

const tabFilters = {
  unpaid: { payment_status: 'unpaid' },
  paid: { payment_status: 'paid' },
  history: {},
};

const copy = {
  en: {
    title: 'Invoices',
    description: 'Review order invoices, receive payments, and prepare paid orders for shipment.',
    total: 'Total Invoices',
    unpaid: 'Unpaid',
    paid: 'Paid',
    outstanding: 'Outstanding Value',
    paidValue: 'Paid Value',
    paymentBreakdown: 'Payment Breakdown',
    search: 'Search invoice, order, customer, product',
    allCustomers: 'All customers',
    allMethods: 'All payment methods',
    clear: 'Clear Filters',
    details: 'Invoice Details',
    invoiceInfo: 'Invoice Information',
    customer: 'Customer',
    items: 'Invoice Items',
    totals: 'Totals',
    payment: 'Payment Information',
    notes: 'Notes',
    markPaid: 'Mark as Paid',
    confirmPayment: 'Confirm Payment',
    paymentWarning: 'This will mark the invoice as paid, update the customer account, add Daily Journal income, and make the order ready for shipment.',
    cancelInvoice: 'Cancel Invoice',
    cancelWarning: 'A financial audit reversal will be created. This action requires a reason.',
    reason: 'Cancellation reason',
    noInvoices: 'No invoices found.',
    history: 'History',
    allStatuses: 'All statuses',
    cash: 'Cash',
    online: 'Online',
    saving: 'Saving...',
    code: 'Code',
    reference: 'Reference',
    receivedAt: 'Received At',
    receivedBy: 'Received By',
    paymentReference: 'Payment Reference',
  },
  ar: {
    title: 'الفواتير',
    description: 'مراجعة فواتير الطلبات واستلام المدفوعات وتجهيز الطلبات المدفوعة للشحن.',
    total: 'إجمالي الفواتير',
    unpaid: 'غير مدفوعة',
    paid: 'مدفوعة',
    outstanding: 'القيمة المستحقة',
    paidValue: 'القيمة المدفوعة',
    paymentBreakdown: 'تفصيل المدفوعات',
    search: 'بحث بالفاتورة أو الطلب أو العميل أو المنتج',
    allCustomers: 'كل العملاء',
    allMethods: 'كل طرق الدفع',
    clear: 'مسح الفلاتر',
    details: 'تفاصيل الفاتورة',
    invoiceInfo: 'معلومات الفاتورة',
    customer: 'العميل',
    items: 'عناصر الفاتورة',
    totals: 'الإجماليات',
    payment: 'معلومات الدفع',
    notes: 'ملاحظات',
    markPaid: 'تأكيد الدفع',
    confirmPayment: 'تأكيد الدفع',
    paymentWarning: 'سيتم تعليم الفاتورة كمدفوعة وتحديث حساب العميل وإضافة دخل في اليومية وتجهيز الطلب للشحن.',
    cancelInvoice: 'إلغاء الفاتورة',
    cancelWarning: 'سيتم إنشاء قيد تدقيق مالي عكسي، ويجب إدخال سبب الإلغاء.',
    reason: 'سبب الإلغاء',
    noInvoices: 'لا توجد فواتير.',
    history: 'السجل',
    allStatuses: 'كل الحالات',
    cash: 'نقداً',
    online: 'إلكتروني',
    saving: 'جارٍ الحفظ...',
    code: 'الرمز',
    reference: 'المرجع',
    receivedAt: 'تاريخ الاستلام',
    receivedBy: 'استلم بواسطة',
    paymentReference: 'مرجع الدفع',
  },
};

function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusText(value, isArabic = false) {
  const labels = {
    en: { issued: 'Issued', paid: 'Paid', cancelled: 'Cancelled', unpaid: 'Unpaid', cash: 'Cash', online: 'Online' },
    ar: { issued: 'صادرة', paid: 'مدفوعة', cancelled: 'ملغاة', unpaid: 'غير مدفوعة', cash: 'نقداً', online: 'إلكتروني' },
  };
  return labels[isArabic ? 'ar' : 'en'][value] || value || '-';
}

function readRole() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user?.profile?.role || user?.role || 'admin';
  } catch {
    return 'admin';
  }
}

export default function Invoices() {
  const { t, isArabic } = useLanguage();
  const label = copy[isArabic ? 'ar' : 'en'];
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('unpaid');
  const [filters, setFilters] = useState({ search: '', customer: '', payment_method: '', date_from: '', date_to: '' });
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ payment_method: 'cash', payment_reference: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [dialogErrors, setDialogErrors] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const processedOrderRef = useRef(null);
  const paymentButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const role = readRole();
  const isAdmin = role === 'admin';
  const paymentDirty = Boolean(paymentDialog) && JSON.stringify(paymentForm) !== JSON.stringify({ payment_method: 'cash', payment_reference: '' });
  const cancelDirty = Boolean(cancelDialog) && Boolean(cancelReason.trim());

  const loadInvoices = useCallback(async (nextFilters = filters, tab = activeTab) => {
    setLoading(true);
    setErrors([]);
    try {
      const [invoiceData, summaryData] = await Promise.all([
        getInvoices({ ...tabFilters[tab], ...nextFilters, ordering: '-issued_at', page_size: 100 }),
        getInvoiceSummary(),
      ]);
      setRows(unwrap(invoiceData));
      setSummary(summaryData);
    } catch (error) {
      setErrors(String(error.message || 'Unable to load invoices.').split('\n'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    loadInvoices();
    getCustomers({ is_active: true, page_size: 100 }).then((data) => setCustomers(unwrap(data))).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    const orderId = location.state?.orderId;
    if (!orderId) return;
    if (processedOrderRef.current === orderId) return;
    processedOrderRef.current = orderId;
    setSaving(true);
    setErrors([]);
    createInvoiceFromOrder(orderId)
      .then((invoice) => {
        setSelectedInvoice(invoice);
        setActiveTab('unpaid');
        loadInvoices(filters, 'unpaid');
      })
      .catch((error) => setErrors(String(error.message || 'Unable to create invoice.').split('\n')))
      .finally(() => setSaving(false));
    navigate('/invoices', { replace: true, state: null });
  }, [filters, loadInvoices, location.state, navigate]);

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedInvoice(null);
    loadInvoices(filters, tab);
  }

  function updateFilter(event) {
    const next = { ...filters, [event.target.name]: event.target.value };
    setFilters(next);
    loadInvoices(next);
  }

  function clearFilters() {
    const next = { search: '', customer: '', payment_method: '', date_from: '', date_to: '' };
    setFilters(next);
    loadInvoices(next);
  }

  function openPaymentDialog(invoice) {
    setPaymentDialog(invoice);
    setPaymentForm({ payment_method: 'cash', payment_reference: '' });
    setDialogErrors([]);
  }

  async function confirmPayment() {
    setSaving(true);
    setDialogErrors([]);
    try {
      const paid = await markInvoicePaid(paymentDialog.id, paymentForm);
      setSelectedInvoice(paid);
      setPaymentDialog(null);
      setActiveTab('paid');
      await loadInvoices(filters, 'paid');
    } catch (error) {
      setDialogErrors(String(error.message || 'Unable to confirm payment.').split('\n'));
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
      const cancelled = await cancelInvoice(cancelDialog.id, cancelReason);
      setSelectedInvoice(cancelled);
      setCancelDialog(null);
      setCancelReason('');
      await loadInvoices();
    } catch (error) {
      setDialogErrors(String(error.message || 'Unable to cancel invoice.').split('\n'));
    } finally {
      setSaving(false);
    }
  }

  function printInvoice(invoice) {
    setSelectedInvoice(invoice);
    window.setTimeout(() => window.print(), 100);
  }

  const columns = [
    { key: 'invoice_number', label: t('common.invoiceNumber') },
    { key: 'order_number', label: t('common.orderNumber') },
    { key: 'customer_name', label: t('common.customerName') },
    { key: 'product_summary', label: t('common.product') },
    { key: 'total_amount', label: t('common.totalAmount'), render: (row) => money(row.total_amount, row.currency) },
    { key: 'payment_status', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={statusText(row.payment_status, isArabic)} /> },
    { key: 'payment_method', label: t('common.method'), render: (row) => statusText(row.payment?.payment_method, isArabic) },
    { key: 'issued_date', label: t('common.date') },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          <Button variant="secondary" onClick={() => setSelectedInvoice(row)}>{t('view')}</Button>
          {row.payment_status === 'unpaid' && row.status !== 'cancelled' && <Button variant="secondary" onClick={() => openPaymentDialog(row)} ref={paymentButtonRef}>{label.markPaid}</Button>}
          <Button variant="secondary" onClick={() => printInvoice(row)}>{t('reports.printPdf')}</Button>
          {isAdmin && row.payment_status === 'unpaid' && row.status !== 'cancelled' && <Button variant="secondary" onClick={() => { setCancelDialog(row); setDialogErrors([]); }} ref={cancelButtonRef}>{t('cancel')}</Button>}
        </div>
      ),
    },
  ];

  const tabs = [
    ['unpaid', `${label.unpaid} (${summary?.unpaid_invoices ?? 0})`],
    ['paid', `${label.paid} (${summary?.paid_invoices ?? 0})`],
    ['history', `${label.history} (${summary?.total_invoices ?? 0})`],
  ];

  const paymentInfo = selectedInvoice?.payment;
  const selectedRows = selectedInvoice?.items || [];

  return (
    <div className="module-page invoice-management-page">
      <ModulePageHeader
        title={label.title}
        description={label.description}
        meta={`${label.total}: ${summary?.total_invoices ?? 0}`}
        actions={selectedInvoice && <Button variant="secondary" onClick={() => printInvoice(selectedInvoice)}>{t('reports.printPdf')}</Button>}
      />

      <StatGrid>
        <SummaryCard label={label.total} value={summary?.total_invoices ?? 0} note={label.allStatuses} />
        <SummaryCard label={label.unpaid} value={summary?.unpaid_invoices ?? 0} note={money(summary?.total_outstanding_value)} tone="warning" />
        <SummaryCard label={label.paid} value={summary?.paid_invoices ?? 0} note={money(summary?.total_paid_value)} tone="good" />
        <SummaryCard label={label.outstanding} value={money(summary?.total_outstanding_value)} note={label.paymentBreakdown} />
      </StatGrid>

      <Card title={label.paymentBreakdown} subtitle={`${label.paidValue}: ${money(summary?.total_paid_value)}`}>
        <div className="module-mini-breakdown">
          <span>{label.cash}: <strong>{money(summary?.cash_payments)}</strong></span>
          <span>{label.online}: <strong>{money(summary?.online_payments)}</strong></span>
        </div>
      </Card>

      <Card className="module-card-flat">
        <div className="module-tabs" role="tablist" aria-label="Invoice status">
          {tabs.map(([tab, text]) => (
            <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => switchTab(tab)}>
              {text}
            </button>
          ))}
        </div>
        <FilterToolbar
          actions={(
            <>
              <Button variant="secondary" onClick={clearFilters}>{label.clear}</Button>
              <Button variant="secondary" onClick={() => window.print()}>{t('reports.printPdf')}</Button>
            </>
          )}
        >
          <label><span>{t('common.description')}</span><input name="search" value={filters.search} onChange={updateFilter} placeholder={label.search} /></label>
          <label><span>{t('common.customer')}</span><select name="customer" value={filters.customer} onChange={updateFilter}><option value="">{label.allCustomers}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label><span>{t('common.method')}</span><select name="payment_method" value={filters.payment_method} onChange={updateFilter}><option value="">{label.allMethods}</option><option value="cash">{label.cash}</option><option value="online">{label.online}</option></select></label>
          <label><span>{t('reports.fromDate')}</span><input name="date_from" type="date" value={filters.date_from} onChange={updateFilter} /></label>
          <label><span>{t('reports.toDate')}</span><input name="date_to" type="date" value={filters.date_to} onChange={updateFilter} /></label>
        </FilterToolbar>
        <ErrorState errors={errors} onRetry={() => loadInvoices()} retryLabel={t('retry')} />
        {saving && <LoadingState message={label.saving} />}
        {loading ? <LoadingState message={t('orders.loading')} /> : (
          <>
            <div className="module-desktop-table"><Table columns={columns} rows={rows} emptyMessage={label.noInvoices} /></div>
            <ResponsiveDataList
              rows={rows}
              emptyTitle={label.noInvoices}
              renderCard={(row) => (
                <article className="module-record-card" key={row.id}>
                  <div><strong>{row.invoice_number}</strong><StatusBadge status={statusText(row.payment_status, isArabic)} /></div>
                  <p>{row.customer_name}</p>
                  <span>{money(row.total_amount, row.currency)} / {row.issued_date}</span>
                  <Button variant="secondary" onClick={() => setSelectedInvoice(row)}>{t('view')}</Button>
                </article>
              )}
            />
          </>
        )}
      </Card>

      {selectedInvoice && (
        <Card title={label.details} subtitle={selectedInvoice.invoice_number}>
          <DetailSection title={label.invoiceInfo}>
            <RecordMeta items={[
              { label: t('common.invoiceNumber'), value: selectedInvoice.invoice_number },
              { label: t('common.orderNumber'), value: selectedInvoice.order_number },
              { label: t('common.date'), value: `${selectedInvoice.issued_date} ${selectedInvoice.issued_time}` },
              { label: t('invoices.adminName'), value: selectedInvoice.issued_by_name || '-' },
              { label: t('common.status'), value: <StatusBadge status={statusText(selectedInvoice.status, isArabic)} /> },
            ]} />
          </DetailSection>
          <DetailSection title={label.customer}>
            <RecordMeta items={[
              { label: label.code, value: selectedInvoice.customer_code },
              { label: t('common.customerName'), value: selectedInvoice.customer_name },
              { label: t('common.phone'), value: selectedInvoice.customer_phone || '-' },
              { label: t('common.location'), value: '-' },
            ]} />
          </DetailSection>
          <DetailSection title={label.items}>
            <Table
              columns={[
                { key: 'product_name_en_snapshot', label: t('common.product'), render: (row) => isArabic ? row.product_name_ar_snapshot : row.product_name_en_snapshot },
                { key: 'quantity', label: t('common.quantity') },
                { key: 'unit_snapshot', label: t('common.unit') },
                { key: 'unit_price', label: t('common.price'), render: (row) => money(row.unit_price, selectedInvoice.currency) },
                { key: 'line_total', label: t('orders.lineTotal'), render: (row) => money(row.line_total, selectedInvoice.currency) },
              ]}
              rows={selectedRows}
            />
          </DetailSection>
          <DetailSection title={label.totals}>
            <RecordMeta items={[
              { label: t('orders.subtotal'), value: money(selectedInvoice.subtotal, selectedInvoice.currency) },
              { label: t('orders.discount'), value: money(selectedInvoice.discount_amount, selectedInvoice.currency) },
              { label: t('common.totalAmount'), value: money(selectedInvoice.total_amount, selectedInvoice.currency) },
            ]} />
          </DetailSection>
          <DetailSection title={label.payment}>
            <RecordMeta items={selectedInvoice.payment_status === 'paid' ? [
              { label: t('orders.paymentStatus'), value: <StatusBadge status="Paid" /> },
              { label: t('common.method'), value: statusText(paymentInfo?.payment_method, isArabic) },
              { label: label.reference, value: paymentInfo?.payment_reference || '-' },
              { label: label.receivedAt, value: paymentInfo?.received_at ? new Date(paymentInfo.received_at).toLocaleString() : '-' },
              { label: label.receivedBy, value: paymentInfo?.received_by_name || '-' },
            ] : [
              { label: t('orders.paymentStatus'), value: <StatusBadge status="Unpaid" /> },
              { label: label.outstanding, value: money(selectedInvoice.outstanding_amount, selectedInvoice.currency) },
              { label: label.markPaid, value: <Button onClick={() => openPaymentDialog(selectedInvoice)} ref={paymentButtonRef}>{label.markPaid}</Button> },
            ]} />
          </DetailSection>
          {selectedInvoice.notes && <DetailSection title={label.notes}><p className="module-notes">{selectedInvoice.notes}</p></DetailSection>}
        </Card>
      )}

      <AppWindow
        id="invoice-payment"
        title={label.confirmPayment}
        description={label.paymentWarning}
        isOpen={Boolean(paymentDialog)}
        isDirty={paymentDirty}
        isSubmitting={saving}
        defaultSize="medium"
        openerRef={paymentButtonRef}
        onClose={() => setPaymentDialog(null)}
      >
        {paymentDialog && (
        <form className="section-panel" onSubmit={(event) => { event.preventDefault(); confirmPayment(); }}>
          <RecordMeta items={[
            { label: t('common.invoiceNumber'), value: paymentDialog.invoice_number },
            { label: t('common.customerName'), value: paymentDialog.customer_name },
            { label: t('common.totalAmount'), value: money(paymentDialog.total_amount, paymentDialog.currency) },
          ]} />
          <div className="form-grid">
            <label>{t('common.method')}<select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value }))}><option value="cash">{label.cash}</option><option value="online">{label.online}</option></select></label>
            <label>{label.paymentReference}<input value={paymentForm.payment_reference} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_reference: event.target.value }))} /></label>
          </div>
          <ErrorState errors={dialogErrors} />
          <div className="workflow-actions">
            <Button type="submit" disabled={saving}>{saving ? label.saving : label.confirmPayment}</Button>
            <Button type="button" variant="secondary" onClick={() => setPaymentDialog(null)} disabled={saving}>{t('cancel')}</Button>
          </div>
        </form>
        )}
      </AppWindow>

      <AppWindow
        id="invoice-cancel"
        title={label.cancelInvoice}
        description={label.cancelWarning}
        isOpen={Boolean(cancelDialog)}
        isDirty={cancelDirty}
        isSubmitting={saving}
        defaultSize="medium"
        openerRef={cancelButtonRef}
        onClose={() => setCancelDialog(null)}
      >
        {cancelDialog && (
        <form className="section-panel" onSubmit={(event) => { event.preventDefault(); confirmCancel(); }}>
          <RecordMeta items={[
            { label: t('common.invoiceNumber'), value: cancelDialog.invoice_number },
            { label: t('common.customerName'), value: cancelDialog.customer_name },
          ]} />
          <label className="module-dialog-field">{label.reason}<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required /></label>
          <ErrorState errors={dialogErrors} />
          <div className="workflow-actions">
            <Button type="submit" disabled={saving}>{saving ? label.saving : label.cancelInvoice}</Button>
            <Button type="button" variant="secondary" onClick={() => setCancelDialog(null)} disabled={saving}>{t('cancel')}</Button>
          </div>
        </form>
        )}
      </AppWindow>

      {selectedInvoice && (
        <div className="invoice-print-page print-area">
          <article className="invoice-document" dir={isArabic ? 'rtl' : 'ltr'}>
            <header className="invoice-document__header">
              <div><strong>{t('companyName')}</strong><span>{t('invoices.systemName')}</span></div>
              <div className="invoice-document__meta"><span>{t('invoices.officialInvoice')}</span><strong>{selectedInvoice.invoice_number}</strong></div>
            </header>
            <section className="invoice-document__section invoice-document__summary">
              <div><span>{t('common.orderNumber')}</span><strong>{selectedInvoice.order_number}</strong></div>
              <div><span>{t('common.date')}</span><strong>{selectedInvoice.issued_date}</strong></div>
              <div><span>{t('common.time')}</span><strong>{selectedInvoice.issued_time}</strong></div>
              <div><span>{t('common.status')}</span><strong>{statusText(selectedInvoice.payment_status, isArabic)}</strong></div>
              <div><span>{t('common.totalAmount')}</span><strong>{money(selectedInvoice.total_amount, selectedInvoice.currency)}</strong></div>
            </section>
            <section className="invoice-document__section">
              <h3>{label.items}</h3>
              <table className="print-table">
                <thead><tr><th>{t('common.product')}</th><th>{t('common.quantity')}</th><th>{t('common.unit')}</th><th>{t('common.price')}</th><th>{t('orders.lineTotal')}</th></tr></thead>
                <tbody>{selectedRows.map((row) => <tr key={row.id}><td>{isArabic ? row.product_name_ar_snapshot : row.product_name_en_snapshot}</td><td>{row.quantity}</td><td>{row.unit_snapshot}</td><td>{money(row.unit_price, selectedInvoice.currency)}</td><td>{money(row.line_total, selectedInvoice.currency)}</td></tr>)}</tbody>
              </table>
            </section>
          </article>
        </div>
      )}
    </div>
  );
}
