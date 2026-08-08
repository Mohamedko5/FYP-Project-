import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { productLabel as localizedProductLabel } from '../components/customers/customerHelpers.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getManagedProducts } from '../services/productsApi.js';
import {
  createZakatReceipt,
  getCropZakatAssessments,
  getZakatDashboard,
  getZakatReceipts,
  getZakatReports,
  updateZakatReceipt,
  verifyZakatReceipt,
} from '../services/zakatApi.js';

const tabs = ['dashboard', 'receipts', 'movements'];
const colors = ['#4d6b4a', '#94722c', '#58708a', '#8a4b3f', '#6b6b63', '#9a7d50'];
const today = new Date().toISOString().slice(0, 10);
const localZakatCopy = {
  en: {
    'tabs.dashboard': 'Zakat Dashboard',
    'tabs.receipts': 'Zakat Receipts',
    'tabs.movements': 'Crop Receipt Movements',
    'actions.view': 'View',
    'actions.edit': 'Edit',
    'actions.print': 'Print',
    'actions.downloadPdf': 'Download PDF',
    'actions.resetFilters': 'Reset Filters',
    'actions.close': 'Close',
    'actions.updateReceipt': 'Update Receipt',
    'stats.totalCropAssessments': 'Total Crop Assessments',
    'stats.totalZakatDue': 'Total Zakat Due',
    'stats.totalZakatPaid': 'Total Zakat Paid',
    'stats.pendingZakat': 'Pending Zakat',
    'stats.numberOfReceipts': 'Number of Zakat Receipts',
    'stats.recentCropTransactions': 'Recent Crop Transactions',
    'cards.recentCropTransactions': 'Recent Crop Transactions',
    'cards.movementsTitle': 'Crop Receipt Movements',
    'cards.movementsSubtitle': 'Trace crop assessments, receipt payments, and their current Zakat status',
    'charts.collectedOverTime': 'Zakat Collected Over Time',
    'charts.paidVsUnpaid': 'Paid vs Unpaid Zakat',
    'charts.cropQuantities': 'Crop Quantities Assessed',
    'charts.zakatByCrop': 'Zakat by Crop/Product',
    'table.crop': 'Crop/Product',
    'table.quantity': 'Quantity',
    'table.zakatAmount': 'Zakat Amount',
    'table.paymentMethod': 'Payment Method',
    'table.paymentStatus': 'Payment Status',
    'table.movementType': 'Movement Type',
    'table.createdAt': 'Created At',
    'forms.paymentMethod': 'Payment Method',
    'filters.all': 'All',
    'filters.search': 'Search',
    'filters.from': 'From Date',
    'filters.to': 'To Date',
    'filters.crop': 'Crop',
    'filters.payer': 'Payer / Seller',
    'filters.seller': 'Seller',
    'filters.paymentStatus': 'Payment Status',
    'filters.paymentMethod': 'Payment Method',
    'filters.status': 'Status',
    'meta.currentDate': 'Current Date',
    'meta.lastUpdated': 'Last Updated',
    'movementTypes.assessment': 'Assessment',
    'movementTypes.receipt': 'Receipt',
    'windows.receiptEditTitle': 'Edit Zakat Receipt',
    'windows.receiptDetailsTitle': 'Zakat Receipt Details',
    'windows.receiptDetailsDescription': 'Review receipt, crop, payer, payment, and verification details.',
  },
  ar: {
    'tabs.dashboard': 'لوحة الزكاة',
    'tabs.receipts': 'إيصالات الزكاة',
    'tabs.movements': 'حركة إيصالات المحاصيل',
    'actions.view': 'عرض',
    'actions.edit': 'تعديل',
    'actions.print': 'طباعة',
    'actions.downloadPdf': 'تنزيل PDF',
    'actions.resetFilters': 'مسح الفلاتر',
    'actions.close': 'إغلاق',
    'actions.updateReceipt': 'تحديث الإيصال',
    'stats.totalCropAssessments': 'إجمالي تقييمات المحاصيل',
    'stats.totalZakatDue': 'إجمالي الزكاة المستحقة',
    'stats.totalZakatPaid': 'إجمالي الزكاة المدفوعة',
    'stats.pendingZakat': 'الزكاة المعلقة',
    'stats.numberOfReceipts': 'عدد إيصالات الزكاة',
    'stats.recentCropTransactions': 'حركات المحاصيل الحديثة',
    'cards.recentCropTransactions': 'حركات المحاصيل الحديثة',
    'cards.movementsTitle': 'حركة إيصالات المحاصيل',
    'cards.movementsSubtitle': 'تتبع تقييمات المحاصيل ومدفوعات الإيصالات وحالة الزكاة الحالية',
    'charts.collectedOverTime': 'الزكاة المحصلة عبر الوقت',
    'charts.paidVsUnpaid': 'الزكاة المدفوعة وغير المدفوعة',
    'charts.cropQuantities': 'كميات المحاصيل المقيمة',
    'charts.zakatByCrop': 'الزكاة حسب المحصول / المنتج',
    'table.crop': 'المحصول / المنتج',
    'table.quantity': 'الكمية',
    'table.zakatAmount': 'مبلغ الزكاة',
    'table.paymentMethod': 'طريقة الدفع',
    'table.paymentStatus': 'حالة الدفع',
    'table.movementType': 'نوع الحركة',
    'table.createdAt': 'تاريخ الإنشاء',
    'forms.paymentMethod': 'طريقة الدفع',
    'filters.all': 'الكل',
    'filters.search': 'بحث',
    'filters.from': 'من تاريخ',
    'filters.to': 'إلى تاريخ',
    'filters.crop': 'المحصول',
    'filters.payer': 'الدافع / البائع',
    'filters.seller': 'البائع',
    'filters.paymentStatus': 'حالة الدفع',
    'filters.paymentMethod': 'طريقة الدفع',
    'filters.status': 'الحالة',
    'meta.currentDate': 'التاريخ الحالي',
    'meta.lastUpdated': 'آخر تحديث',
    'movementTypes.assessment': 'تقييم',
    'movementTypes.receipt': 'إيصال',
    'windows.receiptEditTitle': 'تعديل إيصال الزكاة',
    'windows.receiptDetailsTitle': 'تفاصيل إيصال الزكاة',
    'windows.receiptDetailsDescription': 'مراجعة تفاصيل الإيصال والمحصول والدافع والدفع والتحقق.',
  },
};

function useZakatText() {
  const { language, t } = useLanguage();
  return useCallback((key) => localZakatCopy[language]?.[key] || t(`zakat.${key}`), [language, t]);
}

function list(response) {
  return response?.results || response || [];
}

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function number(value, digits = 3) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function dateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function matchesText(...values) {
  const haystack = values.map((value) => String(value || '').toLowerCase()).join(' ');
  return (query) => !query || haystack.includes(query.toLowerCase());
}

function productNameFromItem(item, isArabic) {
  return localizedProductLabel(item?.product_name_snapshot || item?.product_name || '', isArabic);
}

function productName(product, isArabic) {
  const name = isArabic ? (product.name_ar || product.name_en || product.name) : (product.name_en || product.name_ar || product.name);
  return localizedProductLabel(name, isArabic);
}

function clean(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

export default function ZakatManagement() {
  const { statusLabel, direction, language, isArabic } = useLanguage();
  const z = useZakatText();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [reports, setReports] = useState({});
  const [cropAssessments, setCropAssessments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [products, setProducts] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [action, setAction] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [receiptFilters, setReceiptFilters] = useState(defaultReceiptFilters);
  const [movementFilters, setMovementFilters] = useState(defaultMovementFilters);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [dashboardResponse, reportsResponse, cropResponse, receiptResponse, productResponse] = await Promise.all([
        getZakatDashboard(),
        getZakatReports(),
        getCropZakatAssessments({ page_size: 200 }),
        getZakatReceipts({ page_size: 200 }),
        getManagedProducts({ page_size: 200 }),
      ]);
      setDashboard(dashboardResponse || {});
      setReports(reportsResponse || {});
      setCropAssessments(list(cropResponse));
      setReceipts(list(receiptResponse));
      setProducts(list(productResponse));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || z('loadError'));
    } finally {
      setLoading(false);
    }
  }, [z]);

  useEffect(() => { load(); }, [load]);

  const assessmentById = useMemo(() => {
    const map = new Map();
    cropAssessments.forEach((assessment) => map.set(String(assessment.id), assessment));
    return map;
  }, [cropAssessments]);

  const receiptRows = useMemo(() => receipts.map((receipt) => {
    const assessment = assessmentById.get(String(receipt.crop_assessment));
    const firstItem = assessment?.items?.[0];
    const due = Number(assessment?.total_zakat_value || 0);
    const paid = Number(receipt.amount_paid || 0);
    const paymentStatus = receipt.verification_status === 'verified'
      ? 'paid'
      : paid > 0 && due > 0 && paid < due ? 'partial' : paid > 0 ? 'pending' : 'unpaid';
    return {
      ...receipt,
      payer_name: receipt.customer_name || assessment?.seller_name_snapshot || '-',
      crop_name: productNameFromItem(firstItem, isArabic) || '-',
      quantity: receipt.quantity_paid || assessment?.total_zakat_quantity || firstItem?.net_quantity || '',
      unit: receipt.unit || firstItem?.unit || '',
      zakat_due: due,
      payment_status: paymentStatus,
      assessment,
    };
  }), [assessmentById, isArabic, receipts]);

  const movementRows = useMemo(() => {
    const rows = [];
    cropAssessments.forEach((assessment) => {
      const linkedReceipts = receiptRows.filter((receipt) => String(receipt.crop_assessment || '') === String(assessment.id));
      const items = assessment.items?.length ? assessment.items : [{}];
      items.forEach((item, index) => {
        rows.push({
          id: `assessment-${assessment.id}-${item.id || index}`,
          date: assessment.assessment_date,
          crop_name: productNameFromItem(item, isArabic) || '-',
          seller: assessment.seller_name_snapshot || assessment.customer_name || '-',
          quantity: item.net_quantity || assessment.total_zakat_quantity || '',
          unit: item.unit || '',
          zakat_amount: item.zakat_monetary_value || assessment.total_zakat_value || 0,
          receipt_number: linkedReceipts.map((receipt) => receipt.receipt_number).filter(Boolean).join(', ') || '-',
          movement_type: 'assessment',
          status: assessment.payment_status || assessment.assessment_status,
          action_receipt: linkedReceipts[0],
        });
      });
    });
    receiptRows.filter((receipt) => receipt.crop_assessment).forEach((receipt) => {
      rows.push({
        id: `receipt-${receipt.id}`,
        date: receipt.issue_date,
        crop_name: receipt.crop_name,
        seller: receipt.payer_name,
        quantity: receipt.quantity,
        unit: receipt.unit,
        zakat_amount: receipt.amount_paid,
        receipt_number: receipt.receipt_number,
        movement_type: 'receipt',
        status: receipt.verification_status,
        action_receipt: receipt,
      });
    });
    return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [cropAssessments, isArabic, receiptRows]);

  const summary = useMemo(() => {
    const totalDue = cropAssessments.reduce((sum, row) => sum + Number(row.total_zakat_value || 0), 0);
    const totalPaid = receipts.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
    const recentTransactions = movementRows.filter((row) => row.movement_type === 'assessment').length;
    return {
      totalAssessments: cropAssessments.length,
      totalDue,
      totalPaid,
      pending: Math.max(totalDue - totalPaid, 0),
      receiptCount: receipts.length,
      recentTransactions,
    };
  }, [cropAssessments, movementRows, receipts]);

  const filteredReceipts = useMemo(() => receiptRows.filter((row) => {
    const match = matchesText(row.receipt_number, row.payer_name, row.crop_name, row.payment_method, row.verification_status);
    if (!match(receiptFilters.search)) return false;
    if (receiptFilters.from && row.issue_date < receiptFilters.from) return false;
    if (receiptFilters.to && row.issue_date > receiptFilters.to) return false;
    if (receiptFilters.crop && row.crop_name !== receiptFilters.crop) return false;
    if (receiptFilters.payer && row.payer_name !== receiptFilters.payer) return false;
    if (receiptFilters.paymentStatus && row.payment_status !== receiptFilters.paymentStatus) return false;
    if (receiptFilters.paymentMethod && (row.payment_method || '') !== receiptFilters.paymentMethod) return false;
    return true;
  }), [receiptFilters, receiptRows]);

  const filteredMovements = useMemo(() => movementRows.filter((row) => {
    const match = matchesText(row.crop_name, row.seller, row.receipt_number, row.status);
    if (!match(movementFilters.search)) return false;
    if (movementFilters.from && row.date < movementFilters.from) return false;
    if (movementFilters.to && row.date > movementFilters.to) return false;
    if (movementFilters.crop && row.crop_name !== movementFilters.crop) return false;
    if (movementFilters.seller && row.seller !== movementFilters.seller) return false;
    if (movementFilters.status && row.status !== movementFilters.status) return false;
    return true;
  }), [movementFilters, movementRows]);

  const cropOptions = useMemo(() => [...new Set(receiptRows.map((row) => row.crop_name).filter((value) => value && value !== '-'))], [receiptRows]);
  const payerOptions = useMemo(() => [...new Set(receiptRows.map((row) => row.payer_name).filter((value) => value && value !== '-'))], [receiptRows]);
  const sellerOptions = useMemo(() => [...new Set(movementRows.map((row) => row.seller).filter((value) => value && value !== '-'))], [movementRows]);
  const paymentMethods = useMemo(() => [...new Set(receiptRows.map((row) => row.payment_method).filter(Boolean))], [receiptRows]);
  const movementStatuses = useMemo(() => [...new Set(movementRows.map((row) => row.status).filter(Boolean))], [movementRows]);

  const collectedOverTime = useMemo(() => {
    const grouped = new Map();
    receipts.forEach((receipt) => {
      const key = receipt.issue_date || today;
      grouped.set(key, (grouped.get(key) || 0) + Number(receipt.amount_paid || 0));
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([name, value]) => ({ name, value }));
  }, [receipts]);

  const paidVsUnpaid = useMemo(() => [
    { name: statusLabel('paid'), value: summary.totalPaid },
    { name: statusLabel('unpaid'), value: summary.pending },
  ], [statusLabel, summary]);

  const cropQuantities = useMemo(() => {
    const grouped = new Map();
    cropAssessments.forEach((assessment) => {
      (assessment.items || []).forEach((item) => {
        const key = productNameFromItem(item, isArabic) || z('options.cropFallback');
        grouped.set(key, (grouped.get(key) || 0) + Number(item.net_quantity || 0));
      });
    });
    return [...grouped.entries()].map(([name, value]) => ({ name, value })).slice(0, 8);
  }, [cropAssessments, isArabic, z]);

  const zakatByCrop = useMemo(() => (reports.calculated_amount_by_crop || []).map((row) => ({
    name: row.product_name_snapshot ? localizedProductLabel(row.product_name_snapshot, isArabic) : z('options.cropFallback'),
    value: Number(row.amount || 0),
  })).slice(0, 8), [isArabic, reports, z]);

  async function runAction(handler) {
    setError('');
    try {
      await handler();
      await load();
    } catch (err) {
      setError(err.message || z('actionError'));
    }
  }

  function openReceipt(actionName, receipt = null) {
    setSelectedReceipt(receipt);
    setAction(actionName);
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="module-page zakat-page" dir={direction} lang={language}>
      <header className="module-page-header">
        <div>
          <span className="module-page-header__eyebrow">{z('eyebrow')}</span>
          <h1>{z('title')}</h1>
          <p>{z('subtitle')}</p>
        </div>
        <div className="module-page-header__actions">
          <div className="zakat-date-stack">
            <span>{z('meta.currentDate')}: {new Date().toLocaleDateString()}</span>
            <span>{z('meta.lastUpdated')}: {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</span>
          </div>
          <Button type="button" variant="secondary" onClick={load}>{z('actions.refresh')}</Button>
          {activeTab === 'receipts' && <Button type="button" onClick={() => openReceipt('receipt')}>{z('actions.newZakatReceipt')}</Button>}
        </div>
      </header>

      <div className="module-tabs" role="tablist" aria-label={z('sectionsLabel')}>
        {tabs.map((tab) => (
          <button key={tab} type="button" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>
            {z(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {error && <div className="form-error"><p>{error}</p></div>}
      {loading && <Card><p className="module-muted">{z('loading')}</p></Card>}

      {!loading && activeTab === 'dashboard' && (
        <>
          <div className="module-stat-grid">
            <SummaryCard label={z('stats.totalCropAssessments')} value={number(summary.totalAssessments, 0)} />
            <SummaryCard label={z('stats.totalZakatDue')} value={money(summary.totalDue)} />
            <SummaryCard label={z('stats.totalZakatPaid')} value={money(summary.totalPaid)} tone="good" />
            <SummaryCard label={z('stats.pendingZakat')} value={money(summary.pending)} tone="warning" />
            <SummaryCard label={z('stats.numberOfReceipts')} value={number(summary.receiptCount, 0)} />
            <SummaryCard label={z('stats.recentCropTransactions')} value={number(summary.recentTransactions, 0)} />
          </div>
          <div className="zakat-report-grid">
            <BarCard title={z('charts.collectedOverTime')} data={collectedOverTime} />
            <ChartCard title={z('charts.paidVsUnpaid')} data={paidVsUnpaid} />
            <BarCard title={z('charts.cropQuantities')} data={cropQuantities} />
            <BarCard title={z('charts.zakatByCrop')} data={zakatByCrop} />
          </div>
          <Card title={z('cards.recentCropTransactions')} subtitle={z('cards.latestWorkflow')}>
            <MovementTable rows={movementRows.slice(0, 8)} onView={(receipt) => openReceipt('viewReceipt', receipt)} />
          </Card>
        </>
      )}

      {!loading && activeTab === 'receipts' && (
        <Card title={z('cards.receiptsTitle')} subtitle={z('cards.receiptsSubtitle')}>
          <ReceiptFilters
            filters={receiptFilters}
            setFilters={setReceiptFilters}
            cropOptions={cropOptions}
            payerOptions={payerOptions}
            paymentMethods={paymentMethods}
          />
          <Table
            rows={filteredReceipts}
            columns={[
              { key: 'receipt_number', label: z('table.receipt') },
              { key: 'issue_date', label: z('table.date') },
              { key: 'payer_name', label: z('table.payer') },
              { key: 'crop_name', label: z('table.crop') },
              { key: 'quantity', label: z('table.quantity'), render: (row) => row.quantity ? `${number(row.quantity)} ${row.unit || ''}` : '-' },
              { key: 'amount_paid', label: z('table.zakatAmount'), render: (row) => money(row.amount_paid, row.currency) },
              { key: 'payment_method', label: z('table.paymentMethod'), render: (row) => row.payment_method || '-' },
              { key: 'payment_status', label: z('table.paymentStatus'), render: (row) => <StatusBadge status={row.payment_status} /> },
              { key: 'verification_status', label: z('table.verification'), render: (row) => <StatusBadge status={row.verification_status} /> },
              {
                key: 'actions',
                label: z('table.actions'),
                render: (row) => (
                  <div className="button-row button-row--compact">
                    <Button type="button" variant="secondary" onClick={() => openReceipt('viewReceipt', row)}>{z('actions.view')}</Button>
                    <Button type="button" variant="secondary" onClick={() => openReceipt('editReceipt', row)}>{z('actions.edit')}</Button>
                    <Button type="button" variant="secondary" onClick={() => runAction(() => verifyZakatReceipt(row.id))}>{z('actions.verify')}</Button>
                    <Button type="button" variant="secondary" onClick={printPage}>{z('actions.print')}</Button>
                    <Button type="button" variant="secondary" onClick={printPage}>{z('actions.downloadPdf')}</Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {!loading && activeTab === 'movements' && (
        <Card title={z('cards.movementsTitle')} subtitle={z('cards.movementsSubtitle')}>
          <MovementFilters
            filters={movementFilters}
            setFilters={setMovementFilters}
            cropOptions={cropOptions}
            sellerOptions={sellerOptions}
            statuses={movementStatuses}
          />
          <MovementTable rows={filteredMovements} onView={(receipt) => openReceipt('viewReceipt', receipt)} />
        </Card>
      )}

      <ReceiptWindow
        action={action}
        receipt={selectedReceipt}
        products={products}
        cropAssessments={cropAssessments}
        onClose={() => { setAction(null); setSelectedReceipt(null); }}
        onDone={async () => {
          setAction(null);
          setSelectedReceipt(null);
          await load();
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <section className={`module-summary-card ${tone ? `module-summary-card--${tone}` : ''}`}>
      <div className="module-summary-card__top"><span className="module-icon">Z</span>{label}</div>
      <strong>{value}</strong>
    </section>
  );
}

function ChartCard({ title, data }) {
  return (
    <Card title={title}>
      <div className="zakat-chart">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={82} label>
              {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BarCard({ title, data }) {
  return (
    <Card title={title}>
      <div className="zakat-chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4d6b4a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ReceiptFilters({ filters, setFilters, cropOptions, payerOptions, paymentMethods }) {
  const { statusLabel } = useLanguage();
  const z = useZakatText();
  return (
    <div className="module-filter-toolbar zakat-filter-toolbar">
      <div className="module-filter-toolbar__fields">
        <FilterInput label={z('filters.search')} value={filters.search} onChange={(value) => setFilters((current) => ({ ...current, search: value }))} />
        <FilterInput label={z('filters.from')} type="date" value={filters.from} onChange={(value) => setFilters((current) => ({ ...current, from: value }))} />
        <FilterInput label={z('filters.to')} type="date" value={filters.to} onChange={(value) => setFilters((current) => ({ ...current, to: value }))} />
        <FilterSelect label={z('filters.crop')} value={filters.crop} onChange={(value) => setFilters((current) => ({ ...current, crop: value }))} options={cropOptions.map((value) => [value, value])} />
        <FilterSelect label={z('filters.payer')} value={filters.payer} onChange={(value) => setFilters((current) => ({ ...current, payer: value }))} options={payerOptions.map((value) => [value, value])} />
        <FilterSelect label={z('filters.paymentStatus')} value={filters.paymentStatus} onChange={(value) => setFilters((current) => ({ ...current, paymentStatus: value }))} options={['paid', 'pending', 'unpaid', 'partial'].map((value) => [value, statusLabel(value)])} />
        <FilterSelect label={z('filters.paymentMethod')} value={filters.paymentMethod} onChange={(value) => setFilters((current) => ({ ...current, paymentMethod: value }))} options={paymentMethods.map((value) => [value, value])} />
      </div>
      <div className="module-filter-toolbar__actions">
        <Button type="button" variant="secondary" onClick={() => setFilters(defaultReceiptFilters)}>{z('actions.resetFilters')}</Button>
      </div>
    </div>
  );
}

function MovementFilters({ filters, setFilters, cropOptions, sellerOptions, statuses }) {
  const { statusLabel } = useLanguage();
  const z = useZakatText();
  return (
    <div className="module-filter-toolbar zakat-filter-toolbar">
      <div className="module-filter-toolbar__fields">
        <FilterInput label={z('filters.search')} value={filters.search} onChange={(value) => setFilters((current) => ({ ...current, search: value }))} />
        <FilterInput label={z('filters.from')} type="date" value={filters.from} onChange={(value) => setFilters((current) => ({ ...current, from: value }))} />
        <FilterInput label={z('filters.to')} type="date" value={filters.to} onChange={(value) => setFilters((current) => ({ ...current, to: value }))} />
        <FilterSelect label={z('filters.crop')} value={filters.crop} onChange={(value) => setFilters((current) => ({ ...current, crop: value }))} options={cropOptions.map((value) => [value, value])} />
        <FilterSelect label={z('filters.seller')} value={filters.seller} onChange={(value) => setFilters((current) => ({ ...current, seller: value }))} options={sellerOptions.map((value) => [value, value])} />
        <FilterSelect label={z('filters.status')} value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={statuses.map((value) => [value, statusLabel(value)])} />
      </div>
      <div className="module-filter-toolbar__actions">
        <Button type="button" variant="secondary" onClick={() => setFilters(defaultMovementFilters)}>{z('actions.resetFilters')}</Button>
        <Button type="button" variant="secondary" onClick={() => window.print()}>{z('actions.print')}</Button>
      </div>
    </div>
  );
}

function MovementTable({ rows, onView }) {
  const { statusLabel } = useLanguage();
  const z = useZakatText();
  return (
    <Table
      rows={rows}
      columns={[
        { key: 'date', label: z('table.date') },
        { key: 'crop_name', label: z('table.crop') },
        { key: 'seller', label: z('table.seller') },
        { key: 'quantity', label: z('table.quantity'), render: (row) => row.quantity ? `${number(row.quantity)} ${row.unit || ''}` : '-' },
        { key: 'zakat_amount', label: z('table.zakatAmount'), render: (row) => money(row.zakat_amount) },
        { key: 'receipt_number', label: z('table.receipt') },
        { key: 'movement_type', label: z('table.movementType'), render: (row) => z(`movementTypes.${row.movement_type}`) || statusLabel(row.movement_type) },
        { key: 'status', label: z('table.status'), render: (row) => <StatusBadge status={row.status} /> },
        {
          key: 'action',
          label: z('table.actions'),
          render: (row) => row.action_receipt
            ? <Button type="button" variant="secondary" onClick={() => onView(row.action_receipt)}>{z('actions.view')}</Button>
            : '-',
        },
      ]}
    />
  );
}

function FilterInput({ label, value, onChange, type = 'search' }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  const z = useZakatText();
  return (
    <label>
      <span>{label}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{z('filters.all')}</option>
        {options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function ReceiptWindow({ action, receipt, products, cropAssessments, onClose, onDone }) {
  const { t, isArabic, statusLabel } = useLanguage();
  const z = useZakatText();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultReceiptForm());
  const isViewing = action === 'viewReceipt';
  const isEditing = action === 'editReceipt';
  const isOpen = action === 'receipt' || isViewing || isEditing;

  useEffect(() => {
    setError('');
    setForm(receipt ? receiptFormFromReceipt(receipt) : defaultReceiptForm());
  }, [action, receipt]);

  if (!isOpen) return null;

  async function submit(event) {
    event.preventDefault();
    if (isViewing) return;
    setSaving(true);
    setError('');
    try {
      const payload = receiptPayload(form);
      if (isEditing && receipt?.id) {
        await updateZakatReceipt(receipt.id, payload);
      } else {
        await createZakatReceipt(payload);
      }
      await onDone();
    } catch (err) {
      setError(err.message || z('saveError'));
    } finally {
      setSaving(false);
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const title = isViewing ? z('windows.receiptDetailsTitle') : isEditing ? z('windows.receiptEditTitle') : z('windows.receiptTitle');
  const description = isViewing ? z('windows.receiptDetailsDescription') : z('windows.receiptDescription');

  return (
    <AppWindow id="zakat-receipt" title={title} description={description} isOpen onClose={onClose} isSubmitting={saving}>
      {isViewing ? (
        <div className="zakat-receipt-details">
          <Detail label={z('table.receipt')} value={receipt?.receipt_number} />
          <Detail label={z('table.date')} value={receipt?.issue_date} />
          <Detail label={z('table.payer')} value={receipt?.payer_name || receipt?.customer_name} />
          <Detail label={z('table.crop')} value={receipt?.crop_name} />
          <Detail label={z('table.quantity')} value={receipt?.quantity ? `${number(receipt.quantity)} ${receipt.unit || ''}` : '-'} />
          <Detail label={z('table.zakatAmount')} value={money(receipt?.amount_paid, receipt?.currency)} />
          <Detail label={z('table.paymentMethod')} value={receipt?.payment_method || '-'} />
          <Detail label={z('table.paymentStatus')} value={statusLabel(receipt?.payment_status)} />
          <Detail label={z('table.verification')} value={statusLabel(receipt?.verification_status)} />
          <Detail label={z('table.createdAt')} value={dateTime(receipt?.created_at)} />
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => window.print()}>{z('actions.print')}</Button>
            <Button type="button" variant="secondary" onClick={() => window.print()}>{z('actions.downloadPdf')}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>{z('actions.close')}</Button>
          </div>
        </div>
      ) : (
        <form className="module-dialog zakat-form" onSubmit={submit}>
          {error && <div className="form-error"><p>{error}</p></div>}
          <Field label={z('forms.receiptNumber')} value={form.receipt_number} onChange={(value) => update('receipt_number', value)} required />
          <Select label={z('forms.receiptType')} value={form.receipt_type} onChange={(value) => update('receipt_type', value)} options={[['crop_zakat', z('options.cropZakat')], ['official_external_receipt', z('options.externalOfficial')], ['internal_payment_record', z('options.internalPayment')]]} />
          <Select label={z('forms.cropAssessment')} value={form.crop_assessment || ''} onChange={(value) => update('crop_assessment', value)} options={[['', z('options.none')], ...cropAssessments.map((row) => [row.id, `${row.assessment_number} - ${row.seller_name_snapshot}`])]} />
          <Field label={z('forms.issueDate')} type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
          <Field label={z('forms.issuingAuthority')} value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} required />
          <Field label={z('forms.issuingOffice')} value={form.issuing_office} onChange={(value) => update('issuing_office', value)} />
          <Select label={t('common.product')} value={form.crop_product || ''} onChange={(value) => update('crop_product', value)} options={[['', z('options.none')], ...products.map((product) => [product.id, productName(product, isArabic)])]} />
          <Field label={z('forms.paymentMethod')} value={form.payment_method} onChange={(value) => update('payment_method', value)} />
          <Field label={z('forms.amountPaid')} type="number" step="0.01" value={form.amount_paid} onChange={(value) => update('amount_paid', value)} />
          <Field label={z('forms.quantityPaid')} type="number" step="0.001" value={form.quantity_paid} onChange={(value) => update('quantity_paid', value)} />
          <UnitSelect label={t('common.unit')} value={form.unit} onChange={(value) => update('unit', value)} />
          <Field label={z('forms.officialReference')} value={form.official_reference} onChange={(value) => update('official_reference', value)} />
          <div className="button-row">
            <Button type="submit" disabled={saving}>{isEditing ? z('actions.updateReceipt') : z('actions.save')}</Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{z('actions.cancel')}</Button>
          </div>
        </form>
      )}
    </AppWindow>
  );
}

function Detail({ label, value }) {
  return (
    <div className="zakat-detail-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', step, required = false }) {
  return (
    <label className="module-dialog-field">
      <span>{label}</span>
      <input type={type} step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Select({ label, value, onChange, options, required = false }) {
  return (
    <label className="module-dialog-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required}>
        {options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function UnitSelect({ label, value, onChange }) {
  const z = useZakatText();
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={onChange}
      options={[['', z('options.none')], ...['Bag', 'KG', 'Qintar', 'Bale', 'Unit'].map((unit) => [unit, z(`options.${unit}`)])]}
    />
  );
}

function defaultReceiptForm() {
  return {
    receipt_number: '',
    receipt_type: 'crop_zakat',
    crop_assessment: '',
    issue_date: today,
    issuing_authority: '',
    issuing_office: '',
    crop_product: '',
    payment_method: '',
    amount_paid: '0',
    quantity_paid: '',
    unit: '',
    official_reference: '',
    currency: 'SDG',
  };
}

function receiptFormFromReceipt(receipt) {
  return {
    receipt_number: receipt.receipt_number || '',
    receipt_type: receipt.receipt_type || 'crop_zakat',
    crop_assessment: receipt.crop_assessment || '',
    issue_date: receipt.issue_date || today,
    issuing_authority: receipt.issuing_authority || '',
    issuing_office: receipt.issuing_office || '',
    crop_product: '',
    payment_method: receipt.payment_method || '',
    amount_paid: receipt.amount_paid || '0',
    quantity_paid: receipt.quantity_paid || '',
    unit: receipt.unit || '',
    official_reference: receipt.official_reference || '',
    currency: receipt.currency || 'SDG',
  };
}

function receiptPayload(form) {
  return clean({
    receipt_number: form.receipt_number,
    receipt_type: form.receipt_type,
    crop_assessment: form.crop_assessment || null,
    issue_date: form.issue_date,
    issuing_authority: form.issuing_authority,
    issuing_office: form.issuing_office,
    payment_method: form.payment_method,
    amount_paid: form.amount_paid,
    quantity_paid: form.quantity_paid,
    unit: form.unit,
    official_reference: form.official_reference,
    currency: form.currency || 'SDG',
  });
}

const defaultReceiptFilters = {
  search: '',
  from: '',
  to: '',
  crop: '',
  payer: '',
  paymentStatus: '',
  paymentMethod: '',
};

const defaultMovementFilters = {
  search: '',
  from: '',
  to: '',
  crop: '',
  seller: '',
  status: '',
};

