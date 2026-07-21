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
  },
};

function statusText(value) {
  const labels = {
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
  };
  return labels[value] || value || '-';
}

function formatLabel(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenSummary(value, prefix = '') {
  return Object.entries(value || {}).flatMap(([key, item]) => {
    if (Array.isArray(item)) return [{ label: `${prefix}${formatLabel(key)}`, value: `${item.length} groups` }];
    if (item && typeof item === 'object') return flattenSummary(item, `${prefix}${formatLabel(key)} / `);
    return [{ label: `${prefix}${formatLabel(key)}`, value: item ?? '-' }];
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

function PrintableReport({ columns, companyName, currency, filters, generatedAt, isArabic, report, rows, summary }) {
  if (!report) return null;
  const summaryRows = flattenSummary(summary);
  const activeFilters = Object.entries(filters).filter(([, value]) => value);
  return (
    <section className="print-area" aria-label="Printable report">
      <div className="print-report" dir={isArabic ? 'rtl' : 'ltr'}>
        <header className="print-report__header">
          <h1>{companyName}</h1>
          <p>Integrated Agricultural Trading System Incorporating Financial Tracking</p>
          <h2>{report.title}</h2>
        </header>
        <div className="print-report__meta">
          <div><span>Generated At</span><strong>{generatedAt || new Date().toLocaleString()}</strong></div>
          <div><span>Currency</span><strong>{currency}</strong></div>
          <div><span>Administrator</span><strong>Admin</strong></div>
        </div>
        {activeFilters.length > 0 && <section className="print-report__section"><h3>Active Filters</h3><p>{activeFilters.map(([key, value]) => `${formatLabel(key)}: ${value}`).join(' / ')}</p></section>}
        {summaryRows.length > 0 && (
          <section className="print-report__section">
            <h3>Summary</h3>
            <div className="print-report__summary">
              {summaryRows.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
            </div>
          </section>
        )}
        <section className="print-report__section">
          <h3>Report Table</h3>
          <table className="print-table">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={columns.length}>No records found.</td></tr> : rows.map((row) => (
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

  const selectedReport = reportTypes.find((report) => report.id === selectedReportId);
  const activeFilterKeys = relevantFilters[selectedReportId] || [];
  const rows = reportData?.results || [];
  const summary = reportData?.summary || {};

  const columnsByReport = useMemo(() => ({
    'daily-journal': [
      { key: 'date', label: t('common.date') },
      { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={statusText(row.type)} />, printRender: (row) => statusText(row.type) },
      { key: 'payment_method', label: t('common.method'), render: (row) => statusText(row.payment_method), printRender: (row) => statusText(row.payment_method) },
      { key: 'party', label: t('common.customerSupplier') },
      { key: 'amount', label: t('common.amount') },
      { key: 'description', label: t('common.description') },
    ],
    inventory: [
      { key: 'product_code', label: 'Code' },
      { key: 'product_name', label: t('common.product') },
      { key: 'warehouse_name', label: t('warehouse.warehouse') },
      { key: 'quantity', label: t('common.quantity') },
      { key: 'unit', label: t('common.unit') },
      { key: 'stock_status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.stock_status)} />, printRender: (row) => statusText(row.stock_status) },
    ],
    'customer-accounts': [
      { key: 'customer_code', label: 'Code' },
      { key: 'customer_name', label: t('common.customerName') },
      { key: 'cash_balance', label: t('customers.cashBalance') },
      { key: 'cash_status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.cash_status)} />, printRender: (row) => statusText(row.cash_status) },
      { key: 'total_debits', label: 'Debits' },
      { key: 'total_payments_received', label: 'Payments' },
      { key: 'outstanding_invoice_value', label: 'Outstanding' },
    ],
    workers: [
      { key: 'worker_code', label: 'Code' },
      { key: 'worker_name', label: 'Worker' },
      { key: 'worker_type', label: t('common.type') },
      { key: 'total_work_records', label: 'Records' },
      { key: 'paid_wages', label: 'Paid Wages' },
      { key: 'unpaid_wages', label: 'Unpaid Wages' },
    ],
    orders: [
      { key: 'order_number', label: t('common.orderNumber') },
      { key: 'customer', label: t('common.customerName') },
      { key: 'product_summary', label: t('common.product') },
      { key: 'total', label: t('common.totalAmount') },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.status)} />, printRender: (row) => statusText(row.status) },
      { key: 'linked_invoice', label: t('common.invoiceNumber') },
      { key: 'linked_shipment', label: t('shipments.shipmentId') },
    ],
    invoices: [
      { key: 'invoice_number', label: t('common.invoiceNumber') },
      { key: 'order_number', label: t('common.orderNumber') },
      { key: 'customer', label: t('common.customerName') },
      { key: 'total', label: t('common.totalAmount') },
      { key: 'payment_status', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={statusText(row.payment_status)} />, printRender: (row) => statusText(row.payment_status) },
      { key: 'payment_method', label: t('common.method'), render: (row) => statusText(row.payment_method), printRender: (row) => statusText(row.payment_method) },
      { key: 'outstanding_amount', label: 'Outstanding' },
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
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={statusText(row.status)} />, printRender: (row) => statusText(row.status) },
    ],
    'financial-summary': [
      { key: 'label', label: t('reports.report') },
      { key: 'value', label: t('common.mainValue') },
    ],
  }), [t]);

  const tableRows = selectedReportId === 'financial-summary' ? flattenSummary(summary).map((item, index) => ({ id: index, ...item })) : rows;
  const columns = columnsByReport[selectedReportId] || [];
  const summaryCards = summaryHighlights(selectedReportId, summary);
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
      setErrors(['Date From cannot be after Date To.']);
      return;
    }
    setLoading(true);
    setErrors([]);
    const scopedFilters = Object.fromEntries(Object.entries(filters).filter(([key, value]) => activeFilterKeys.includes(key) && value));
    try {
      setReportData(await getReport(selectedReportId, scopedFilters));
      setAppliedFilters({ ...filters });
    } catch (error) {
      setErrors(String(error.message || 'Unable to load report.').split('\n'));
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
    if (key === 'worker') return <label key={key}>Worker<select {...commonProps}><option value="">{t('reports.all')}</option>{options.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>;
    if (key === 'payment_method') return <label key={key}>{t('common.method')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="cash">Cash</option><option value="online">Online</option></select></label>;
    if (key === 'payment_status') return <label key={key}>{t('orders.paymentStatus')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>;
    if (key === 'transaction_type') return <label key={key}>{t('common.type')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="income">Income</option><option value="expense">Expense</option></select></label>;
    if (key === 'unit') return <label key={key}>{t('common.unit')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="Qintar">Qintar</option><option value="KG">KG</option><option value="Bag">Bag</option><option value="Bale">Bale</option><option value="Unit">Unit</option></select></label>;
    if (key === 'order_status') return <label key={key}>{t('common.status')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="pending">Pending</option><option value="received">Received</option><option value="invoiced">Invoiced</option><option value="ready_for_shipment">Ready for Shipment</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>;
    if (key === 'shipment_status') return <label key={key}>{t('shipments.shipmentStatus')}<select {...commonProps}><option value="">{t('reports.all')}</option><option value="ready_for_shipment">Ready for Shipment</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>;
    return null;
  }

  return (
    <div className="module-page reports-page">
      <ModulePageHeader
        title={label.title}
        description={selectedReport ? `${label.description} Selected: ${selectedReport.title}` : label.description}
        actions={reportData && <Button variant="secondary" onClick={() => window.print()}>{t('reports.printPdf')}</Button>}
      />

      <Card title={label.choose} subtitle={label.noReport}>
        <div className="report-selector-grid">
          {reportTypes.map((report) => (
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
              {activeFilters.map(([key, value]) => <span key={key}>{formatLabel(key)}: {value}</span>)}
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
          <PrintableReport columns={columns} companyName={t('companyName')} currency={currency} filters={appliedFilters} generatedAt={reportData?.generated_at} isArabic={isArabic} report={selectedReport} rows={tableRows} summary={summary} />
        </Card>
      )}
    </div>
  );
}

function summaryHighlights(reportId, summary) {
  if (reportId === 'daily-journal') {
    return [
      { label: 'Opening Balance', value: summary.opening_balance },
      { label: 'Income', value: summary.total_income, tone: 'good' },
      { label: 'Expenses', value: summary.total_expenses, tone: 'warning' },
      { label: 'Closing Balance', value: summary.closing_balance },
    ];
  }
  if (reportId === 'inventory') {
    return (summary.groups || []).slice(0, 4).map((group) => ({ label: group.product_name, value: `${group.quantity} ${group.unit}` }));
  }
  if (reportId === 'customer-accounts') return [{ label: 'Total Customers', value: summary.total_customers }];
  if (reportId === 'workers') return [{ label: 'Total Workers', value: summary.total_workers }];
  if (reportId === 'orders') return [{ label: 'Active Value', value: summary.active_value }];
  if (reportId === 'invoices') {
    return [
      { label: 'Paid', value: summary.paid_count, tone: 'good' },
      { label: 'Unpaid', value: summary.unpaid_count, tone: 'warning' },
      { label: 'Paid Value', value: summary.total_paid_value },
      { label: 'Outstanding Value', value: summary.total_outstanding_value },
    ];
  }
  if (reportId === 'shipments') return (summary.completed_item_groups || []).slice(0, 4).map((group) => ({ label: group.product_name, value: `${group.quantity} ${group.unit}` }));
  if (reportId === 'financial-summary') return flattenSummary(summary).slice(0, 6);
  return [];
}
