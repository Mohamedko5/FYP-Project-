import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  ModulePageHeader,
  StatGrid,
  SummaryCard,
} from '../components/ui/ModuleInterface.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { useCurrency } from '../i18n/CurrencyContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getReport, getReportOptions } from '../services/reportsApi.js';

const reportTypes = [
  { id: 'daily-journal', icon: 'J', title: 'Daily Journal', text: 'Cash income, expenses, opening, and closing balances.' },
  { id: 'inventory', icon: 'I', title: 'Inventory', text: 'Warehouse stock grouped by product and unit.' },
  { id: 'customer-accounts', icon: 'C', title: 'Customer Accounts', text: 'Customer debts, credits, invoices, and balances.' },
  { id: 'workers', icon: 'W', title: 'Workers', text: 'Worker records, paid wages, and unpaid wages.' },
  { id: 'orders', icon: 'O', title: 'Orders', text: 'Order values, statuses, invoice links, and shipment links.' },
  { id: 'invoices', icon: 'V', title: 'Invoices', text: 'Issued, paid, unpaid, and cancelled invoices.' },
  { id: 'shipments', icon: 'S', title: 'Shipments', text: 'Shipment statuses, warehouses, quantities, and weights.' },
  { id: 'financial-summary', icon: 'F', title: 'Financial Summary', text: 'Cash, invoices, customer balances, and worker wage totals.' },
];

const reportTypesAr = [
  { id: 'daily-journal', icon: 'J', title: 'اليومية', text: 'الإيرادات والمصروفات والرصيد الافتتاحي والختامي.' },
  { id: 'inventory', icon: 'I', title: 'المخزون', text: 'مخزون المخازن مجمع حسب المنتج والوحدة.' },
  { id: 'customer-accounts', icon: 'C', title: 'حسابات العملاء', text: 'ديون العملاء والمدفوعات والفواتير والأرصدة.' },
  { id: 'workers', icon: 'W', title: 'العمال', text: 'سجلات العمل والأجور المدفوعة وغير المدفوعة.' },
  { id: 'orders', icon: 'O', title: 'الطلبات', text: 'قيم الطلبات وحالاتها وروابط الفواتير والشحن.' },
  { id: 'invoices', icon: 'V', title: 'الفواتير', text: 'الفواتير الصادرة والمدفوعة وغير المدفوعة والملغاة.' },
  { id: 'shipments', icon: 'S', title: 'الشحنات', text: 'حالات الشحن والمخازن والكميات والأوزان.' },
  { id: 'financial-summary', icon: 'F', title: 'الملخص المالي', text: 'النقد والفواتير وأرصدة العملاء وأجور العمال.' },
];

const relevantFilters = {
  'daily-journal': ['date_from', 'date_to', 'payment_method', 'transaction_type'],
  inventory: ['warehouse', 'product', 'unit'],
  'customer-accounts': ['customer'],
  workers: ['worker'],
  orders: ['date_from', 'date_to', 'customer', 'product', 'order_status'],
  invoices: ['date_from', 'date_to', 'customer', 'product', 'payment_status', 'payment_method'],
  shipments: ['date_from', 'date_to', 'customer', 'product', 'warehouse', 'shipment_status'],
  'financial-summary': ['date_from', 'date_to'],
};

const copy = {
  en: {
    title: 'Reports',
    description: 'Choose one report, apply filters, generate results, then print a clean report.',
    choose: 'Choose Report',
    filters: 'Filters',
    generate: 'Generate Report',
    clear: 'Clear Filters',
    results: 'Report Results',
    activeFilters: 'Active Filters',
    noReport: 'Select a report to begin.',
    noData: 'No report data found.',
    selected: 'Selected',
    generatedAt: 'Generated At',
    currency: 'Currency',
    administrator: 'Administrator',
    summary: 'Summary',
    reportTable: 'Report Table',
    noRecords: 'No records found.',
    worker: 'Worker',
    cash: 'Cash',
    online: 'Online',
    unpaid: 'Unpaid',
    paid: 'Paid',
    income: 'Income',
    expense: 'Expense',
    pending: 'Pending',
    received: 'Received',
    invoiced: 'Invoiced',
    readyForShipment: 'Ready for Shipment',
    processing: 'Processing',
    completed: 'Completed',
    cancelled: 'Cancelled',
    dateRangeError: 'Date From cannot be after Date To.',
    loadError: 'Unable to load report.',
    code: 'Code',
    debits: 'Debits',
    payments: 'Payments',
    outstanding: 'Outstanding',
    records: 'Records',
    paidWages: 'Paid Wages',
    unpaidWages: 'Unpaid Wages',
  },
  ar: {
    title: 'التقارير',
    description: 'اختر تقريرا واحدا ثم حدد الفلاتر واعرض النتائج واطبع تقريرا نظيفا.',
    choose: 'اختر التقرير',
    filters: 'الفلاتر',
    generate: 'عرض التقرير',
    clear: 'مسح الفلاتر',
    results: 'نتائج التقرير',
    activeFilters: 'الفلاتر النشطة',
    noReport: 'اختر تقريرا للبدء.',
    noData: 'لا توجد بيانات للتقرير.',
    selected: 'المحدد',
    generatedAt: 'تاريخ الإنشاء',
    currency: 'العملة',
    administrator: 'المسؤول',
    summary: 'الملخص',
    reportTable: 'جدول التقرير',
    noRecords: 'لا توجد سجلات.',
    worker: 'العامل',
    cash: 'نقداً',
    online: 'إلكتروني',
    unpaid: 'غير مدفوع',
    paid: 'مدفوع',
    income: 'إيراد',
    expense: 'مصروف',
    pending: 'معلق',
    received: 'مستلم',
    invoiced: 'مفوتر',
    readyForShipment: 'جاهز للشحن',
    processing: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    dateRangeError: 'تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.',
    loadError: 'تعذر تحميل التقرير.',
    code: 'الرمز',
    debits: 'المديونيات',
    payments: 'المدفوعات',
    outstanding: 'المستحق',
    records: 'السجلات',
    paidWages: 'الأجور المدفوعة',
    unpaidWages: 'الأجور غير المدفوعة',
  },
};

function statusText(value, isArabic = false) {
  const labels = {
    en: {
      paid: 'Paid',
      unpaid: 'Unpaid',
      issued: 'Issued',
      cancelled: 'Cancelled',
      pending: 'Pending',
      received: 'Received',
      invoiced: 'Invoiced',
      ready_for_shipment: 'Ready for Shipment',
      processing: 'Processing',
      completed: 'Completed',
      income: 'Income',
      expense: 'Expense',
      cash: 'Cash',
      online: 'Online',
      Low: 'Low Stock',
      Good: 'Good',
      Full: 'Full',
      'Almost Full': 'Almost Full',
    },
    ar: {
      paid: 'مدفوع',
      unpaid: 'غير مدفوع',
      issued: 'صادر',
      cancelled: 'ملغى',
      pending: 'معلق',
      received: 'مستلم',
      invoiced: 'مفوتر',
      ready_for_shipment: 'جاهز للشحن',
      processing: 'قيد التنفيذ',
      completed: 'مكتمل',
      income: 'إيراد',
      expense: 'مصروف',
      cash: 'نقداً',
      online: 'إلكتروني',
      Low: 'منخفض المخزون',
      Good: 'جيد',
      Full: 'ممتلئ',
      'Almost Full': 'شبه ممتلئ',
    },
  };
  return labels[isArabic ? 'ar' : 'en'][value] || value || '-';
}

function formatLabel(key, isArabic = false) {
  const arLabels = {
    date_from: 'من تاريخ',
    date_to: 'إلى تاريخ',
    customer: 'العميل',
    product: 'المنتج',
    warehouse: 'المخزن',
    worker: 'العامل',
    payment_method: 'طريقة الدفع',
    payment_status: 'حالة الدفع',
    transaction_type: 'نوع المعاملة',
    order_status: 'حالة الطلب',
    shipment_status: 'حالة الشحنة',
    unit: 'الوحدة',
    opening_balance: 'الرصيد الافتتاحي',
    total_income: 'إجمالي الإيرادات',
    total_expenses: 'إجمالي المصروفات',
    closing_balance: 'الرصيد الختامي',
  };
  if (isArabic && arLabels[key]) return arLabels[key];
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenSummary(value, prefix = '', isArabic = false) {
  return Object.entries(value || {}).flatMap(([key, item]) => {
    if (Array.isArray(item)) return [{ label: `${prefix}${formatLabel(key, isArabic)}`, value: isArabic ? `${item.length} مجموعة` : `${item.length} groups` }];
    if (item && typeof item === 'object') return flattenSummary(item, `${prefix}${formatLabel(key, isArabic)} / `, isArabic);
    return [{ label: `${prefix}${formatLabel(key, isArabic)}`, value: item ?? '-' }];
  });
}

function defaultFilters() {
  return {
    date_from: '',
    date_to: '',
    customer: '',
    product: '',
    warehouse: '',
    worker: '',
    payment_method: '',
    payment_status: '',
    transaction_type: '',
    order_status: '',
    shipment_status: '',
    unit: '',
  };
}

function PrintableReport({ columns, companyName, currency, filters, generatedAt, isArabic, label, report, rows, summary }) {
  if (!report) return null;
  const summaryRows = flattenSummary(summary, '', isArabic);
  const activeFilters = Object.entries(filters).filter(([, value]) => value);
  return (
    <section className="print-area" aria-label="Printable report">
      <div className="print-report" dir={isArabic ? 'rtl' : 'ltr'}>
        <header className="print-report__header">
          <h1>{companyName}</h1>
          <p>{isArabic ? 'نظام التجارة الزراعية المتكامل مع التتبع المالي' : 'Integrated Agricultural Trading System Incorporating Financial Tracking'}</p>
          <h2>{report.title}</h2>
        </header>
        <div className="print-report__meta">
          <div><span>{label.generatedAt}</span><strong>{generatedAt || new Date().toLocaleString()}</strong></div>
          <div><span>{label.currency}</span><strong>{currency}</strong></div>
          <div><span>{label.administrator}</span><strong>{isArabic ? 'المسؤول' : 'Admin'}</strong></div>
        </div>
        {activeFilters.length > 0 && <section className="print-report__section"><h3>{label.activeFilters}</h3><p>{activeFilters.map(([key, value]) => `${formatLabel(key, isArabic)}: ${value}`).join(' / ')}</p></section>}
        {summaryRows.length > 0 && (
          <section className="print-report__section">
            <h3>{label.summary}</h3>
            <div className="print-report__summary">
              {summaryRows.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
            </div>
          </section>
        )}
        <section className="print-report__section">
          <h3>{label.reportTable}</h3>
          <table className="print-table">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={columns.length}>{label.noRecords}</td></tr> : rows.map((row) => (
                <tr key={row.id || row.label || JSON.stringify(row)}>{columns.map((column) => <td key={column.key}>{column.printRender ? column.printRender(row) : row[column.key] ?? '-'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

export default function Reports() {
  const { t, isArabic } = useLanguage();
  const { currency } = useCurrency();
  const label = copy[isArabic ? 'ar' : 'en'];
  const reportTypeOptions = isArabic ? reportTypesAr : reportTypes;
  const [selectedReportId, setSelectedReportId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [options, setOptions] = useState({ customers: [], products: [], warehouses: [], workers: [] });
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getReportOptions().then((data) => setOptions(data?.results || { customers: [], products: [], warehouses: [], workers: [] })).catch(() => {});
  }, []);

  const selectedReport = reportTypeOptions.find((report) => report.id === selectedReportId);
  const activeFilterKeys = relevantFilters[selectedReportId] || [];
  const rows = reportData?.results || [];
  const summary = reportData?.summary || {};

  const columnsByReport = useMemo(() => ({
    'daily-journal': [
      { key: 'date', label: t('common.date') },
      { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={statusText(row.type, isArabic)} />, printRender: (row) => statusText(row.type, isArabic) },
      { key: 'payment_method', label: t('common.method'), render: (row) => statusText(row.payment_method, isArabic), printRender: (row) => statusText(row.payment_method, isArabic) },
      { key: 'party', label: t('common.customerSupplier') },
      { key: 'amount', label: t('common.amount') },
      { key: 'description', label: t('common.description') },
    ],
    inventory: [
      { key: 'product_code', label: label.code },
      { key: 'product_name', label: t('common.product') },
      { key: 'warehouse_name', label: t('warehouse.warehouse') },
      { key: 'quantity', label: t('common.quantity') },
      { key: 'unit', label: t('common.unit') },
      { key: 'stock_status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.stock_status, isArabic)} />, printRender: (row) => statusText(row.stock_status, isArabic) },
    ],
    'customer-accounts': [
      { key: 'customer_code', label: label.code },
      { key: 'customer_name', label: t('common.customerName') },
      { key: 'cash_balance', label: t('customers.cashBalance') },
      { key: 'cash_status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.cash_status, isArabic)} />, printRender: (row) => statusText(row.cash_status, isArabic) },
      { key: 'total_debits', label: label.debits },
      { key: 'total_payments_received', label: label.payments },
      { key: 'outstanding_invoice_value', label: label.outstanding },
    ],
    workers: [
      { key: 'worker_code', label: label.code },
      { key: 'worker_name', label: label.worker },
      { key: 'worker_type', label: t('common.type') },
      { key: 'total_work_records', label: label.records },
      { key: 'paid_wages', label: label.paidWages },
      { key: 'unpaid_wages', label: label.unpaidWages },
    ],
    orders: [
      { key: 'order_number', label: t('common.orderNumber') },
      { key: 'customer', label: t('common.customerName') },
      { key: 'product_summary', label: t('common.product') },
      { key: 'total', label: t('common.totalAmount') },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.status, isArabic)} />, printRender: (row) => statusText(row.status, isArabic) },
      { key: 'linked_invoice', label: t('common.invoiceNumber') },
      { key: 'linked_shipment', label: t('shipments.shipmentId') },
    ],
    invoices: [
      { key: 'invoice_number', label: t('common.invoiceNumber') },
      { key: 'order_number', label: t('common.orderNumber') },
      { key: 'customer', label: t('common.customerName') },
      { key: 'total', label: t('common.totalAmount') },
      { key: 'payment_status', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={statusText(row.payment_status, isArabic)} />, printRender: (row) => statusText(row.payment_status, isArabic) },
      { key: 'payment_method', label: t('common.method'), render: (row) => statusText(row.payment_method, isArabic), printRender: (row) => statusText(row.payment_method, isArabic) },
      { key: 'outstanding_amount', label: label.outstanding },
    ],
    shipments: [
      { key: 'shipment_number', label: t('shipments.shipmentId') },
      { key: 'order_number', label: t('common.orderNumber') },
      { key: 'invoice_number', label: t('common.invoiceNumber') },
      { key: 'customer', label: t('common.customerName') },
      { key: 'product', label: t('common.product') },
      { key: 'warehouse', label: t('warehouse.warehouse') },
      { key: 'actual_quantity', label: t('shipments.actualQuantity') },
      { key: 'unit', label: t('common.unit') },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.status, isArabic)} />, printRender: (row) => statusText(row.status, isArabic) },
    ],
    'financial-summary': [
      { key: 'label', label: t('reports.report') },
      { key: 'value', label: t('common.mainValue') },
    ],
  }), [isArabic, label, t]);

  const tableRows = selectedReportId === 'financial-summary' ? flattenSummary(summary, '', isArabic).map((item, index) => ({ id: index, ...item })) : rows;
  const columns = columnsByReport[selectedReportId] || [];
  const summaryCards = summaryHighlights(selectedReportId, summary, isArabic);
  const activeFilters = Object.entries(appliedFilters).filter(([key, value]) => activeFilterKeys.includes(key) && value);

  function selectReport(reportId) {
    setSelectedReportId(reportId);
    setReportData(null);
    setErrors([]);
    setFilters(defaultFilters());
    setAppliedFilters(defaultFilters());
  }

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function clearFilters() {
    setFilters(defaultFilters());
    setAppliedFilters(defaultFilters());
  }

  const loadReport = useCallback(async () => {
    if (!selectedReportId) return;
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      setErrors([label.dateRangeError]);
      return;
    }
    setLoading(true);
    setErrors([]);
    const scopedFilters = Object.fromEntries(Object.entries(filters).filter(([key, value]) => activeFilterKeys.includes(key) && value));
    try {
      setReportData(await getReport(selectedReportId, scopedFilters));
      setAppliedFilters({ ...filters });
    } catch (error) {
      setErrors(String(error.message || label.loadError).split('\n'));
    } finally {
      setLoading(false);
    }
  }, [activeFilterKeys, filters, selectedReportId]);

  function renderFilter(key) {
    const commonProps = { name: key, value: filters[key], onChange: updateFilter };
    if (key === 'date_from') return <label key={key}>{t('reports.fromDate')}<input type="date" {...commonProps} /></label>;
    if (key === 'date_to') return <label key={key}>{t('reports.toDate')}<input type="date" {...commonProps} min={filters.date_from || undefined} /></label>;
    if (key === 'customer') return <label key={key}>{t('common.customer')}<select {...commonProps}><option value="">{t('reports.all')}</option>{options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>;
    if (key === 'product') return <label key={key}>{t('common.product')}<select {...commonProps}><option value="">{t('reports.all')}</option>{options.products.map((product) => <option key={product.id} value={product.id}>{isArabic ? product.name_ar : product.name_en}</option>)}</select></label>;
    if (key === 'warehouse') return <label key={key}>{t('warehouse.warehouse')}<select {...commonProps}><option value="">{t('reports.all')}</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_name}</option>)}</select></label>;
    if (key === 'worker') return <label key={key}>{label.worker}<select {...commonProps}><option value="">{t('reports.all')}</option>{options.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>;
    if (key === 'payment_method') return <label key={key}>{t('common.method')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="cash">{label.cash}</option><option value="online">{label.online}</option></select></label>;
    if (key === 'payment_status') return <label key={key}>{t('orders.paymentStatus')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="unpaid">{label.unpaid}</option><option value="paid">{label.paid}</option></select></label>;
    if (key === 'transaction_type') return <label key={key}>{t('common.type')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="income">{label.income}</option><option value="expense">{label.expense}</option></select></label>;
    if (key === 'unit') return <label key={key}>{t('common.unit')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="Qintar">Qintar</option><option value="KG">KG</option><option value="Bag">Bag</option><option value="Bale">Bale</option><option value="Unit">Unit</option></select></label>;
    if (key === 'order_status') return <label key={key}>{t('common.status')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="pending">{label.pending}</option><option value="received">{label.received}</option><option value="invoiced">{label.invoiced}</option><option value="ready_for_shipment">{label.readyForShipment}</option><option value="processing">{label.processing}</option><option value="completed">{label.completed}</option><option value="cancelled">{label.cancelled}</option></select></label>;
    if (key === 'shipment_status') return <label key={key}>{t('shipments.shipmentStatus')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="ready_for_shipment">{label.readyForShipment}</option><option value="processing">{label.processing}</option><option value="completed">{label.completed}</option><option value="cancelled">{label.cancelled}</option></select></label>;
    return null;
  }

  return (
    <div className="module-page reports-page">
      <ModulePageHeader
        title={label.title}
        description={selectedReport ? `${label.description} ${label.selected}: ${selectedReport.title}` : label.description}
        actions={reportData && <Button variant="secondary" onClick={() => window.print()}>{t('reports.printPdf')}</Button>}
      />

      <Card title={label.choose} subtitle={label.noReport}>
        <div className="report-selector-grid">
          {reportTypeOptions.map((report) => (
            <button key={report.id} type="button" className={`report-selector-card ${selectedReportId === report.id ? 'is-active' : ''}`} onClick={() => selectReport(report.id)}>
              <span>{report.icon}</span>
              <strong>{report.title}</strong>
              <small>{report.text}</small>
            </button>
          ))}
        </div>
      </Card>

      {selectedReport && (
        <Card title={label.filters} subtitle={selectedReport.text}>
          <FilterToolbar actions={<><Button onClick={loadReport} disabled={loading}>{label.generate}</Button><Button variant="secondary" onClick={clearFilters}>{label.clear}</Button></>}>
            {activeFilterKeys.map(renderFilter)}
          </FilterToolbar>
          {activeFilters.length > 0 && (
            <div className="module-active-filters" aria-label={label.activeFilters}>
              <strong>{label.activeFilters}</strong>
              {activeFilters.map(([key, value]) => <span key={key}>{formatLabel(key, isArabic)}: {value}</span>)}
            </div>
          )}
        </Card>
      )}

      {selectedReport && (
        <Card title={label.results} subtitle={reportData?.generated_at || selectedReport.title}>
          <ErrorState errors={errors} onRetry={loadReport} retryLabel={t('retry')} />
          {loading && <LoadingState message={t('orders.loading')} />}
          {!loading && !reportData && <EmptyState title={label.generate} description={label.noReport} />}
          {!loading && reportData && (
            <>
              {summaryCards.length > 0 && (
                <StatGrid>
                  {summaryCards.map((item) => <SummaryCard key={item.label} label={item.label} value={item.value} note={item.note} tone={item.tone} />)}
                </StatGrid>
              )}
              {tableRows.length === 0 ? <EmptyState title={label.noData} /> : <Table columns={columns} rows={tableRows} />}
            </>
          )}
          <PrintableReport columns={columns} companyName={t('companyName')} currency={currency} filters={appliedFilters} generatedAt={reportData?.generated_at} isArabic={isArabic} label={label} report={selectedReport} rows={tableRows} summary={summary} />
        </Card>
      )}
    </div>
  );
}

function summaryHighlights(reportId, summary, isArabic = false) {
  const labels = isArabic ? {
    openingBalance: 'الرصيد الافتتاحي',
    income: 'الإيرادات',
    expenses: 'المصروفات',
    closingBalance: 'الرصيد الختامي',
    totalCustomers: 'إجمالي العملاء',
    totalWorkers: 'إجمالي العمال',
    activeValue: 'قيمة الطلبات النشطة',
    paid: 'مدفوعة',
    unpaid: 'غير مدفوعة',
    paidValue: 'القيمة المدفوعة',
    outstandingValue: 'القيمة المستحقة',
  } : {
    openingBalance: 'Opening Balance',
    income: 'Income',
    expenses: 'Expenses',
    closingBalance: 'Closing Balance',
    totalCustomers: 'Total Customers',
    totalWorkers: 'Total Workers',
    activeValue: 'Active Value',
    paid: 'Paid',
    unpaid: 'Unpaid',
    paidValue: 'Paid Value',
    outstandingValue: 'Outstanding Value',
  };
  if (reportId === 'daily-journal') {
    return [
      { label: labels.openingBalance, value: summary.opening_balance },
      { label: labels.income, value: summary.total_income, tone: 'good' },
      { label: labels.expenses, value: summary.total_expenses, tone: 'warning' },
      { label: labels.closingBalance, value: summary.closing_balance },
    ];
  }
  if (reportId === 'inventory') {
    return (summary.groups || []).slice(0, 4).map((group) => ({ label: group.product_name, value: `${group.quantity} ${group.unit}` }));
  }
  if (reportId === 'customer-accounts') return [{ label: labels.totalCustomers, value: summary.total_customers }];
  if (reportId === 'workers') return [{ label: labels.totalWorkers, value: summary.total_workers }];
  if (reportId === 'orders') return [{ label: labels.activeValue, value: summary.active_value }];
  if (reportId === 'invoices') {
    return [
      { label: labels.paid, value: summary.paid_count, tone: 'good' },
      { label: labels.unpaid, value: summary.unpaid_count, tone: 'warning' },
      { label: labels.paidValue, value: summary.total_paid_value },
      { label: labels.outstandingValue, value: summary.total_outstanding_value },
    ];
  }
  if (reportId === 'shipments') return (summary.completed_item_groups || []).slice(0, 4).map((group) => ({ label: group.product_name, value: `${group.quantity} ${group.unit}` }));
  if (reportId === 'financial-summary') return flattenSummary(summary, '', isArabic).slice(0, 6);
  return [];
}
