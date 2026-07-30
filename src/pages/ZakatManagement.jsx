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
  approveCropZakatAssessment,
  calculateCropZakatAssessment,
  calculateTradeZakatAssessment,
  createCropMovementPermit,
  createCropZakatAssessment,
  createPreviousZakatReceipt,
  createTradeZakatAssessment,
  createZakatCertificate,
  createZakatReceipt,
  createZakatRule,
  getCropMovementPermits,
  getCropZakatAssessments,
  getPreviousZakatReceipts,
  getTradeZakatAssessments,
  getZakatAuditHistory,
  getZakatCertificates,
  getZakatDashboard,
  getZakatReceipts,
  getZakatReports,
  getZakatRules,
  seedDraftZakatRules,
  verifyPreviousZakatReceipt,
  verifyZakatReceipt,
} from '../services/zakatApi.js';

const tabs = ['dashboard', 'crop', 'trade', 'receipts', 'certificates', 'permits', 'rules', 'reports', 'audit'];
const colors = ['#4d6b4a', '#94722c', '#58708a', '#8a4b3f', '#6b6b63', '#9a7d50'];
const today = new Date().toISOString().slice(0, 10);

function list(response) {
  return response?.results || response || [];
}

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function localizedChartData(rows, key, statusLabel, fallback, valueKey = 'count') {
  return (rows || []).map((row) => ({ name: statusLabel(row[key] || fallback), value: Number(row[valueKey] || 0) }));
}

export default function ZakatManagement() {
  const { t, statusLabel, direction, language, isArabic } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [reports, setReports] = useState({});
  const [rules, setRules] = useState([]);
  const [cropAssessments, setCropAssessments] = useState([]);
  const [tradeAssessments, setTradeAssessments] = useState([]);
  const [previousReceipts, setPreviousReceipts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [permits, setPermits] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const [
        dashboardResponse,
        reportsResponse,
        rulesResponse,
        cropResponse,
        tradeResponse,
        previousResponse,
        receiptResponse,
        certResponse,
        permitResponse,
        auditResponse,
        productResponse,
      ] = await Promise.all([
        getZakatDashboard(),
        getZakatReports(),
        getZakatRules({ page_size: 100 }),
        getCropZakatAssessments({ page_size: 100 }),
        getTradeZakatAssessments({ page_size: 100 }),
        getPreviousZakatReceipts({ page_size: 100 }),
        getZakatReceipts({ page_size: 100 }),
        getZakatCertificates({ page_size: 100 }),
        getCropMovementPermits({ page_size: 100 }),
        getZakatAuditHistory({ page_size: 100 }),
        getManagedProducts({ page_size: 100 }),
      ]);
      setDashboard(dashboardResponse || {});
      setReports(reportsResponse || {});
      setRules(list(rulesResponse));
      setCropAssessments(list(cropResponse));
      setTradeAssessments(list(tradeResponse));
      setPreviousReceipts(list(previousResponse));
      setReceipts(list(receiptResponse));
      setCertificates(list(certResponse));
      setPermits(list(permitResponse));
      setAuditRows(list(auditResponse));
      setProducts(list(productResponse));
    } catch (err) {
      setError(err.message || t('zakat.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function runAction(handler) {
    setError('');
    try {
      await handler();
      await load();
    } catch (err) {
      setError(err.message || t('zakat.actionError'));
    }
  }

  const statCards = useMemo(() => ([
    [t('zakat.stats.pendingCropAssessments'), dashboard.pending_crop_assessments],
    [t('zakat.stats.awaitingVerification'), dashboard.awaiting_verification],
    [t('zakat.stats.unpaidAssessments'), dashboard.unpaid_assessments],
    [t('zakat.stats.validReceipts'), dashboard.valid_receipts],
    [t('zakat.stats.certificatesExpiringSoon'), dashboard.certificates_expiring_soon],
    [t('zakat.stats.expiredCertificates'), dashboard.expired_certificates],
    [t('zakat.stats.activeMovementPermits'), dashboard.active_movement_permits],
    [t('zakat.stats.permitsExpiringSoon'), dashboard.permits_expiring_soon],
  ]), [dashboard, t]);

  return (
    <div className="module-page zakat-page" dir={direction} lang={language}>
      <header className="module-page-header">
        <div>
          <span className="module-page-header__eyebrow">{t('zakat.eyebrow')}</span>
          <h1>{t('zakat.title')}</h1>
          <p>{t('zakat.subtitle')}</p>
          <p className="zakat-notice">{dashboard.notice ? t('zakat.confirmationNotice') : t('zakat.fallbackNotice')}</p>
        </div>
        <div className="module-page-header__actions">
          <Button type="button" variant="secondary" onClick={load}>{t('zakat.actions.refresh')}</Button>
          <Button type="button" onClick={() => setAction('crop')}>{t('zakat.actions.newCropAssessment')}</Button>
        </div>
      </header>

      <div className="module-tabs" role="tablist" aria-label={t('zakat.sectionsLabel')}>
        {tabs.map((tab) => (
          <button key={tab} type="button" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>
            {t(`zakat.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {error && <div className="form-error"><p>{error}</p></div>}
      {loading && <Card><p className="module-muted">{t('zakat.loading')}</p></Card>}

      {activeTab === 'dashboard' && !loading && (
        <>
          <div className="module-stat-grid">
            {statCards.map(([label, value]) => (
              <section key={label} className="module-summary-card">
                <div className="module-summary-card__top"><span className="module-icon">Z</span>{label}</div>
                <strong>{Number(value || 0).toLocaleString()}</strong>
              </section>
            ))}
          </div>
          <Card title={t('zakat.cards.recentCropAssessments')} subtitle={t('zakat.cards.latestWorkflow')}>
            <CropTable rows={cropAssessments.slice(0, 8)} onCalculate={(row) => runAction(() => calculateCropZakatAssessment(row.id))} onApprove={(row) => runAction(() => approveCropZakatAssessment(row.id))} />
          </Card>
        </>
      )}

      {activeTab === 'crop' && (
        <Card title={t('zakat.cards.cropTitle')} subtitle={t('zakat.cards.cropSubtitle')}>
          <div className="button-row">
            <Button type="button" onClick={() => setAction('crop')}>{t('zakat.actions.newCropAssessment')}</Button>
            <Button type="button" variant="secondary" onClick={() => setAction('previousReceipt')}>{t('zakat.actions.previousReceiptEvidence')}</Button>
          </div>
          <CropTable rows={cropAssessments} onCalculate={(row) => runAction(() => calculateCropZakatAssessment(row.id))} onApprove={(row) => runAction(() => approveCropZakatAssessment(row.id))} />
        </Card>
      )}

      {activeTab === 'trade' && (
        <Card title={t('zakat.cards.tradeTitle')} subtitle={t('zakat.cards.tradeSubtitle')}>
          <div className="button-row"><Button type="button" onClick={() => setAction('trade')}>{t('zakat.actions.newTradeAssessment')}</Button></div>
          <Table
            rows={tradeAssessments}
            columns={[
              { key: 'assessment_number', label: t('zakat.table.number') },
              { key: 'company', label: t('zakat.table.company') },
              { key: 'zakat_year', label: t('zakat.table.year') },
              { key: 'net_assessable_base', label: t('zakat.table.base'), render: (row) => money(row.net_assessable_base, row.currency) },
              { key: 'zakat_due', label: t('zakat.table.due'), render: (row) => money(row.zakat_due, row.currency) },
              { key: 'status', label: t('zakat.table.status'), render: (row) => <StatusBadge status={row.status} /> },
              { key: 'action', label: t('zakat.table.actions'), render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => calculateTradeZakatAssessment(row.id))}>{t('zakat.actions.calculate')}</Button> },
            ]}
          />
        </Card>
      )}

      {activeTab === 'receipts' && (
        <Card title={t('zakat.cards.receiptsTitle')} subtitle={t('zakat.cards.receiptsSubtitle')}>
          <div className="button-row">
            <Button type="button" onClick={() => setAction('receipt')}>{t('zakat.actions.newZakatReceipt')}</Button>
            <Button type="button" variant="secondary" onClick={() => setAction('previousReceipt')}>{t('zakat.actions.newPreviousEvidence')}</Button>
          </div>
          <Table
            rows={receipts}
            columns={[
              { key: 'receipt_number', label: t('zakat.table.receipt') },
              { key: 'receipt_type', label: t('zakat.table.type'), render: (row) => statusLabel(row.receipt_type) },
              { key: 'issue_date', label: t('zakat.table.date') },
              { key: 'amount_paid', label: t('zakat.table.amount'), render: (row) => money(row.amount_paid, row.currency) },
              { key: 'verification_status', label: t('zakat.table.verification'), render: (row) => <StatusBadge status={row.verification_status} /> },
              { key: 'action', label: t('zakat.table.actions'), render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => verifyZakatReceipt(row.id))}>{t('zakat.actions.verify')}</Button> },
            ]}
          />
          <h3 className="zakat-subtitle">{t('zakat.actions.previousReceiptEvidence')}</h3>
          <Table
            rows={previousReceipts}
            columns={[
              { key: 'receipt_number', label: t('zakat.table.receipt') },
              { key: 'payer', label: t('zakat.table.payer') },
              { key: 'issuing_office', label: t('zakat.table.office') },
              { key: 'verification_status', label: t('zakat.table.verification'), render: (row) => <StatusBadge status={row.verification_status} /> },
              { key: 'action', label: t('zakat.table.actions'), render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => verifyPreviousZakatReceipt(row.id))}>{t('zakat.actions.verify')}</Button> },
            ]}
          />
        </Card>
      )}

      {activeTab === 'certificates' && (
        <Card title={t('zakat.cards.certificatesTitle')} subtitle={t('zakat.cards.certificatesSubtitle')}>
          <div className="button-row"><Button type="button" onClick={() => setAction('certificate')}>{t('zakat.actions.newCertificate')}</Button></div>
          <Table rows={certificates} columns={[
            { key: 'certificate_number', label: t('zakat.table.certificate') },
            { key: 'party_name', label: t('zakat.table.party') },
            { key: 'zakat_year', label: t('zakat.table.year') },
            { key: 'expiry_date', label: t('zakat.table.expiry') },
            { key: 'computed_status', label: t('zakat.table.status'), render: (row) => <StatusBadge status={row.computed_status || row.status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'permits' && (
        <Card title={t('zakat.cards.permitsTitle')} subtitle={t('zakat.cards.permitsSubtitle')}>
          <div className="button-row"><Button type="button" onClick={() => setAction('permit')}>{t('zakat.actions.newMovementPermit')}</Button></div>
          <Table rows={permits} columns={[
            { key: 'permit_number', label: t('zakat.table.permit') },
            { key: 'source_location', label: t('zakat.table.source') },
            { key: 'destination_location', label: t('zakat.table.destination') },
            { key: 'expiry_date', label: t('zakat.table.expiry') },
            { key: 'computed_status', label: t('zakat.table.status'), render: (row) => <StatusBadge status={row.computed_status || row.status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'rules' && (
        <Card title={t('zakat.cards.rulesTitle')} subtitle={t('zakat.cards.rulesSubtitle')}>
          <div className="button-row">
            <Button type="button" onClick={() => setAction('rule')}>{t('zakat.actions.newRule')}</Button>
            <Button type="button" variant="secondary" onClick={() => runAction(seedDraftZakatRules)}>{t('zakat.actions.seedDraftRules')}</Button>
          </div>
          <Table rows={rules} columns={[
            { key: 'rule_code', label: t('zakat.table.code') },
            { key: 'name_en', label: t('zakat.table.name'), render: (row) => isArabic ? (row.name_ar || row.name_en) : (row.name_en || row.name_ar) },
            { key: 'zakat_type', label: t('zakat.table.type'), render: (row) => statusLabel(row.zakat_type) },
            { key: 'irrigation_method', label: t('zakat.table.irrigation'), render: (row) => row.irrigation_method ? statusLabel(row.irrigation_method) : t('zakat.options.notSpecific') },
            { key: 'rate_percentage', label: t('zakat.table.rate') },
            { key: 'verification_status', label: t('zakat.table.verification'), render: (row) => <StatusBadge status={row.verification_status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'reports' && (
        <div className="zakat-report-grid">
          <ChartCard title={t('zakat.charts.assessmentsByStatus')} data={localizedChartData(reports.assessments_by_status, 'assessment_status', statusLabel, 'unknown')} />
          <ChartCard title={t('zakat.charts.irrigationDistribution')} data={localizedChartData(reports.irrigation_distribution, 'irrigation_method', statusLabel, 'unknown')} />
          <BarCard title={t('zakat.charts.calculatedAmountByCrop')} data={(reports.calculated_amount_by_crop || []).map((row) => ({ name: row.product_name_snapshot ? localizedProductLabel(row.product_name_snapshot, isArabic) : t('zakat.options.cropFallback'), value: Number(row.amount || 0) }))} />
          <BarCard title={t('zakat.charts.tradeZakatByYear')} data={(reports.trade_zakat_by_year || []).map((row) => ({ name: String(row.zakat_year || t('zakat.options.yearFallback')), value: Number(row.amount || 0) }))} />
        </div>
      )}

      {activeTab === 'audit' && (
        <Card title={t('zakat.cards.auditTitle')} subtitle={t('zakat.cards.auditSubtitle')}>
          <Table rows={auditRows} columns={[
            { key: 'created_at', label: t('zakat.table.date'), render: (row) => new Date(row.created_at).toLocaleString() },
            { key: 'actor_name', label: t('zakat.table.user') },
            { key: 'action', label: t('zakat.table.actions') },
            { key: 'record_type', label: t('zakat.table.record') },
            { key: 'reason', label: t('zakat.table.reason') },
          ]} />
        </Card>
      )}

      <ZakatActionWindow
        action={action}
        products={products}
        cropAssessments={cropAssessments}
        tradeAssessments={tradeAssessments}
        receipts={receipts}
        previousReceipts={previousReceipts}
        onClose={() => setAction(null)}
        onDone={async () => { setAction(null); await load(); }}
      />
    </div>
  );
}

function CropTable({ rows, onCalculate, onApprove }) {
  const { t, statusLabel } = useLanguage();
  return (
    <Table
      rows={rows}
      columns={[
        { key: 'assessment_number', label: t('zakat.table.number') },
        { key: 'seller_name_snapshot', label: t('zakat.table.seller') },
        { key: 'agricultural_season', label: t('zakat.table.season') },
        { key: 'irrigation_method', label: t('zakat.table.irrigation'), render: (row) => statusLabel(row.irrigation_method) },
        { key: 'total_zakat_value', label: t('zakat.table.due'), render: (row) => money(row.total_zakat_value, row.currency) },
        { key: 'assessment_status', label: t('zakat.table.status'), render: (row) => <StatusBadge status={row.assessment_status} /> },
        {
          key: 'actions',
          label: t('zakat.table.actions'),
          render: (row) => (
            <div className="button-row button-row--compact">
              <Button type="button" variant="secondary" onClick={() => onCalculate(row)}>{t('zakat.actions.calculate')}</Button>
              <Button type="button" variant="secondary" onClick={() => onApprove(row)}>{t('zakat.actions.approve')}</Button>
            </div>
          ),
        },
      ]}
    />
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

function ZakatActionWindow({ action, products, cropAssessments, tradeAssessments, receipts, previousReceipts, onClose, onDone }) {
  const { t, isArabic } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const productOptions = products || [];

  useEffect(() => {
    setError('');
    setForm(defaultForm(action, productOptions[0]?.id));
  }, [action, productOptions]);

  if (!action) return null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (action === 'rule') await createZakatRule(rulePayload(form));
      if (action === 'crop') await createCropZakatAssessment(cropPayload(form));
      if (action === 'trade') await createTradeZakatAssessment(tradePayload(form));
      if (action === 'previousReceipt') await createPreviousZakatReceipt(previousReceiptPayload(form));
      if (action === 'receipt') await createZakatReceipt(receiptPayload(form));
      if (action === 'certificate') await createZakatCertificate(certificatePayload(form));
      if (action === 'permit') await createCropMovementPermit(permitPayload(form));
      await onDone();
    } catch (err) {
      setError(err.message || t('zakat.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppWindow id={`zakat-${action}`} title={t(windowTitleKeys[action])} description={t(windowDescriptionKeys[action])} isOpen onClose={onClose} isSubmitting={saving}>
      <form className="module-dialog zakat-form" onSubmit={submit}>
        {error && <div className="form-error"><p>{error}</p></div>}
        {action === 'rule' && (
          <>
            <Field label={t('zakat.forms.ruleCode')} value={form.rule_code} onChange={(value) => update('rule_code', value)} required />
            <Field label={t('zakat.forms.arabicName')} value={form.name_ar} onChange={(value) => update('name_ar', value)} required />
            <Field label={t('zakat.forms.englishName')} value={form.name_en} onChange={(value) => update('name_en', value)} required />
            <Select label={t('common.type')} value={form.zakat_type} onChange={(value) => update('zakat_type', value)} options={[['crop', t('zakat.options.crop')], ['trade', t('zakat.options.trade')]]} />
            <Select label={t('zakat.forms.calculation')} value={form.calculation_method} onChange={(value) => update('calculation_method', value)} options={[['quantity_percentage', t('zakat.options.quantityPercentage')], ['monetary_percentage', t('zakat.options.monetaryPercentage')], ['manual_official_assessment', t('zakat.options.manualOfficial')]]} />
            <Select label={t('zakat.table.irrigation')} value={form.irrigation_method} onChange={(value) => update('irrigation_method', value)} options={[['', t('zakat.options.notSpecific')], ['natural', t('zakat.options.natural')], ['artificial', t('zakat.options.artificial')], ['mixed', t('zakat.options.mixed')]]} />
            <Select label={t('zakat.forms.cropProduct')} value={form.crop_product || ''} onChange={(value) => update('crop_product', value)} options={[['', t('zakat.options.anyCrop')], ...productOptions.map((product) => [product.id, productName(product, isArabic)])]} />
            <Field label={t('zakat.forms.rate')} type="number" step="0.0001" value={form.rate_percentage} onChange={(value) => update('rate_percentage', value)} required />
            <Field label={t('zakat.forms.thresholdQuantity')} type="number" step="0.001" value={form.threshold_quantity} onChange={(value) => update('threshold_quantity', value)} />
            <UnitSelect label={t('zakat.forms.thresholdUnit')} value={form.threshold_unit} onChange={(value) => update('threshold_unit', value)} />
            <Field label={t('zakat.forms.monetaryThreshold')} type="number" step="0.01" value={form.monetary_threshold} onChange={(value) => update('monetary_threshold', value)} />
            <Field label={t('zakat.forms.officialValuationPrice')} type="number" step="0.01" value={form.official_valuation_price} onChange={(value) => update('official_valuation_price', value)} />
            <Field label={t('zakat.forms.effectiveFrom')} type="date" value={form.effective_from} onChange={(value) => update('effective_from', value)} required />
            <Field label={t('zakat.forms.issuingAuthority')} value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} />
            <Field label={t('zakat.forms.officialReference')} value={form.official_reference} onChange={(value) => update('official_reference', value)} />
          </>
        )}
        {action === 'crop' && (
          <>
            <Field label={t('zakat.forms.sellerName')} value={form.seller_name_snapshot} onChange={(value) => update('seller_name_snapshot', value)} required />
            <Field label={t('zakat.forms.assessmentDate')} type="date" value={form.assessment_date} onChange={(value) => update('assessment_date', value)} required />
            <Field label={t('zakat.table.season')} value={form.agricultural_season} onChange={(value) => update('agricultural_season', value)} required />
            <Select label={t('zakat.table.irrigation')} value={form.irrigation_method} onChange={(value) => update('irrigation_method', value)} options={[['natural', t('zakat.options.natural')], ['artificial', t('zakat.options.artificial')], ['mixed', t('zakat.options.mixed')], ['unknown', t('zakat.options.unknown')]]} />
            <Field label={t('zakat.forms.state')} value={form.state} onChange={(value) => update('state', value)} />
            <Field label={t('zakat.forms.locality')} value={form.locality} onChange={(value) => update('locality', value)} />
            <Select label={t('common.product')} value={form.product} onChange={(value) => update('product', value)} options={productOptions.map((product) => [product.id, productName(product, isArabic)])} required />
            <Field label={t('zakat.forms.netQuantity')} type="number" step="0.001" value={form.net_quantity} onChange={(value) => update('net_quantity', value)} required />
            <UnitSelect label={t('common.unit')} value={form.unit} onChange={(value) => update('unit', value)} required />
            <Select label={t('zakat.forms.previousZakatPaid')} value={form.previous_zakat_paid} onChange={(value) => update('previous_zakat_paid', value)} options={[[false, t('zakat.options.no')], [true, t('zakat.options.yes')]]} />
            <Select label={t('zakat.forms.previousReceipt')} value={form.previous_receipt || ''} onChange={(value) => update('previous_receipt', value)} options={[['', t('zakat.options.none')], ...previousReceipts.map((receipt) => [receipt.id, receipt.receipt_number])]} />
          </>
        )}
        {action === 'trade' && (
          <>
            <Field label={t('zakat.forms.companyName')} value={form.company} onChange={(value) => update('company', value)} required />
            <Field label={t('zakat.forms.assessmentDate')} type="date" value={form.assessment_date} onChange={(value) => update('assessment_date', value)} required />
            <Field label={t('zakat.forms.zakatYear')} type="number" value={form.zakat_year} onChange={(value) => update('zakat_year', value)} required />
            <Field label={t('zakat.forms.periodStart')} type="date" value={form.period_start} onChange={(value) => update('period_start', value)} required />
            <Field label={t('zakat.forms.periodEnd')} type="date" value={form.period_end} onChange={(value) => update('period_end', value)} required />
            <Field label={t('zakat.forms.cashBalance')} type="number" step="0.01" value={form.cash_balance} onChange={(value) => update('cash_balance', value)} />
            <Field label={t('zakat.forms.tradeInventoryValue')} type="number" step="0.01" value={form.trade_inventory_value} onChange={(value) => update('trade_inventory_value', value)} />
            <Field label={t('zakat.forms.receivables')} type="number" step="0.01" value={form.receivables_value} onChange={(value) => update('receivables_value', value)} />
            <Field label={t('zakat.forms.liabilities')} type="number" step="0.01" value={form.allowed_liabilities} onChange={(value) => update('allowed_liabilities', value)} />
            <Field label={t('zakat.forms.otherAssets')} type="number" step="0.01" value={form.other_assessable_assets} onChange={(value) => update('other_assessable_assets', value)} />
          </>
        )}
        {action === 'previousReceipt' && (
          <>
            <Field label={t('zakat.forms.receiptNumber')} value={form.receipt_number} onChange={(value) => update('receipt_number', value)} required />
            <Field label={t('zakat.forms.issueDate')} type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label={t('zakat.forms.payerName')} value={form.payer} onChange={(value) => update('payer', value)} required />
            <Field label={t('zakat.forms.issuingState')} value={form.issuing_state} onChange={(value) => update('issuing_state', value)} />
            <Field label={t('zakat.forms.issuingLocality')} value={form.issuing_locality} onChange={(value) => update('issuing_locality', value)} />
            <Field label={t('zakat.forms.issuingOffice')} value={form.issuing_office} onChange={(value) => update('issuing_office', value)} required />
            <Select label={t('zakat.options.crop')} value={form.crop || ''} onChange={(value) => update('crop', value)} options={[['', t('zakat.options.none')], ...productOptions.map((product) => [product.id, productName(product, isArabic)])]} />
            <Field label={t('zakat.forms.paidQuantity')} type="number" step="0.001" value={form.paid_quantity} onChange={(value) => update('paid_quantity', value)} />
            <Field label={t('zakat.forms.paidAmount')} type="number" step="0.01" value={form.paid_amount} onChange={(value) => update('paid_amount', value)} />
          </>
        )}
        {action === 'receipt' && (
          <>
            <Field label={t('zakat.forms.receiptNumber')} value={form.receipt_number} onChange={(value) => update('receipt_number', value)} required />
            <Select label={t('zakat.forms.receiptType')} value={form.receipt_type} onChange={(value) => update('receipt_type', value)} options={[['crop_zakat', t('zakat.options.cropZakat')], ['trade_zakat', t('zakat.options.tradeZakat')], ['official_external_receipt', t('zakat.options.externalOfficial')], ['internal_payment_record', t('zakat.options.internalPayment')]]} />
            <Select label={t('zakat.forms.cropAssessment')} value={form.crop_assessment || ''} onChange={(value) => update('crop_assessment', value)} options={[['', t('zakat.options.none')], ...cropAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Select label={t('zakat.forms.tradeAssessment')} value={form.trade_assessment || ''} onChange={(value) => update('trade_assessment', value)} options={[['', t('zakat.options.none')], ...tradeAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Field label={t('zakat.forms.issueDate')} type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label={t('zakat.forms.issuingAuthority')} value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} required />
            <Field label={t('zakat.forms.issuingOffice')} value={form.issuing_office} onChange={(value) => update('issuing_office', value)} />
            <Field label={t('zakat.forms.amountPaid')} type="number" step="0.01" value={form.amount_paid} onChange={(value) => update('amount_paid', value)} />
            <Field label={t('zakat.forms.quantityPaid')} type="number" step="0.001" value={form.quantity_paid} onChange={(value) => update('quantity_paid', value)} />
            <UnitSelect label={t('common.unit')} value={form.unit} onChange={(value) => update('unit', value)} allowBlank />
          </>
        )}
        {action === 'certificate' && (
          <>
            <Field label={t('zakat.forms.certificateNumber')} value={form.certificate_number} onChange={(value) => update('certificate_number', value)} required />
            <Field label={t('zakat.forms.partyName')} value={form.party_name} onChange={(value) => update('party_name', value)} required />
            <Field label={t('zakat.forms.zakatYear')} type="number" value={form.zakat_year} onChange={(value) => update('zakat_year', value)} required />
            <Field label={t('zakat.forms.issueDate')} type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label={t('zakat.forms.expiryDate')} type="date" value={form.expiry_date} onChange={(value) => update('expiry_date', value)} required />
            <Field label={t('zakat.forms.issuingAuthority')} value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} required />
          </>
        )}
        {action === 'permit' && (
          <>
            <Field label={t('zakat.forms.permitNumber')} value={form.permit_number} onChange={(value) => update('permit_number', value)} required />
            <Field label={t('zakat.forms.issueDate')} type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label={t('zakat.forms.expiryDate')} type="date" value={form.expiry_date} onChange={(value) => update('expiry_date', value)} required />
            <Field label={t('zakat.forms.sourceLocation')} value={form.source_location} onChange={(value) => update('source_location', value)} required />
            <Field label={t('zakat.forms.destinationLocation')} value={form.destination_location} onChange={(value) => update('destination_location', value)} required />
            <Field label={t('zakat.forms.vehicleNumber')} value={form.vehicle_number} onChange={(value) => update('vehicle_number', value)} />
            <Select label={t('zakat.forms.assessment')} value={form.related_zakat_assessment || ''} onChange={(value) => update('related_zakat_assessment', value)} options={[['', t('zakat.options.none')], ...cropAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Select label={t('zakat.table.receipt')} value={form.related_zakat_receipt || ''} onChange={(value) => update('related_zakat_receipt', value)} options={[['', t('zakat.options.none')], ...receipts.map((row) => [row.id, row.receipt_number])]} />
            <Select label={t('common.product')} value={form.product || ''} onChange={(value) => update('product', value)} options={productOptions.map((product) => [product.id, productName(product, isArabic)])} />
            <Field label={t('common.quantity')} type="number" step="0.001" value={form.quantity} onChange={(value) => update('quantity', value)} />
            <UnitSelect label={t('common.unit')} value={form.unit} onChange={(value) => update('unit', value)} />
          </>
        )}
        <div className="button-row">
          <Button type="submit" disabled={saving}>{t('zakat.actions.save')}</Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('zakat.actions.cancel')}</Button>
        </div>
      </form>
    </AppWindow>
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

function UnitSelect({ label, value, onChange, required = false, allowBlank = false }) {
  const { t } = useLanguage();
  const unitOptions = ['Bag', 'KG', 'Qintar', 'Bale', 'Unit'].map((unit) => [unit, t(`zakat.options.${unit}`)]);
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={onChange}
      required={required}
      options={allowBlank ? [['', t('zakat.options.none')], ...unitOptions] : unitOptions}
    />
  );
}

function productName(product, isArabic) {
  const name = isArabic ? (product.name_ar || product.name_en || product.name) : (product.name_en || product.name_ar || product.name);
  return localizedProductLabel(name, isArabic);
}

const windowTitleKeys = {
  rule: 'zakat.windows.ruleTitle',
  crop: 'zakat.windows.cropTitle',
  trade: 'zakat.windows.tradeTitle',
  previousReceipt: 'zakat.windows.previousReceiptTitle',
  receipt: 'zakat.windows.receiptTitle',
  certificate: 'zakat.windows.certificateTitle',
  permit: 'zakat.windows.permitTitle',
};

const windowDescriptionKeys = {
  rule: 'zakat.windows.ruleDescription',
  crop: 'zakat.windows.cropDescription',
  trade: 'zakat.windows.tradeDescription',
  previousReceipt: 'zakat.windows.previousReceiptDescription',
  receipt: 'zakat.windows.receiptDescription',
  certificate: 'zakat.windows.certificateDescription',
  permit: 'zakat.windows.permitDescription',
};

function defaultForm(action, productId) {
  const base = { assessment_date: today, issue_date: today, effective_from: today, currency: 'SDG', unit: 'Bag' };
  if (action === 'rule') return { ...base, rule_code: '', name_ar: '', name_en: '', zakat_type: 'crop', calculation_method: 'quantity_percentage', irrigation_method: 'natural', crop_product: '', rate_percentage: '10', threshold_quantity: '0', threshold_unit: 'Bag', official_valuation_price: '0', monetary_threshold: '0', issuing_authority: '' };
  if (action === 'crop') return { ...base, seller_name_snapshot: '', agricultural_season: String(new Date().getFullYear()), irrigation_method: 'natural', state: '', locality: '', product: productId || '', net_quantity: '', previous_zakat_paid: false, previous_receipt: '' };
  if (action === 'trade') return { ...base, company: '', zakat_year: new Date().getFullYear(), period_start: `${new Date().getFullYear()}-01-01`, period_end: `${new Date().getFullYear()}-12-31`, cash_balance: '0', trade_inventory_value: '0', receivables_value: '0', allowed_liabilities: '0', other_assessable_assets: '0' };
  if (action === 'previousReceipt') return { ...base, receipt_number: '', payer: '', issuing_state: '', issuing_locality: '', issuing_office: '', crop: productId || '', paid_quantity: '', paid_amount: '' };
  if (action === 'receipt') return { ...base, receipt_number: '', receipt_type: 'crop_zakat', crop_assessment: '', trade_assessment: '', issuing_authority: '', issuing_office: '', amount_paid: '0', quantity_paid: '', unit: '' };
  if (action === 'certificate') return { ...base, certificate_number: '', party_name: '', zakat_year: new Date().getFullYear(), expiry_date: today, issuing_authority: '' };
  if (action === 'permit') return { ...base, permit_number: '', expiry_date: today, source_location: '', destination_location: '', vehicle_number: '', related_zakat_assessment: '', related_zakat_receipt: '', product: productId || '', quantity: '', unit: 'Bag' };
  return base;
}

function clean(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function rulePayload(form) {
  return clean({
    rule_code: form.rule_code,
    name_ar: form.name_ar,
    name_en: form.name_en,
    zakat_type: form.zakat_type,
    calculation_method: form.calculation_method,
    irrigation_method: form.irrigation_method || null,
    crop_product: form.crop_product || null,
    rate_percentage: form.rate_percentage,
    threshold_quantity: form.threshold_quantity,
    threshold_unit: form.threshold_unit,
    monetary_threshold: form.monetary_threshold,
    official_valuation_price: form.official_valuation_price,
    effective_from: form.effective_from,
    issuing_authority: form.issuing_authority,
    official_reference: form.official_reference,
    currency: form.currency,
  });
}

function cropPayload(form) {
  const payload = clean({
    seller_name_snapshot: form.seller_name_snapshot,
    assessment_date: form.assessment_date,
    agricultural_season: form.agricultural_season,
    irrigation_method: form.irrigation_method,
    state: form.state,
    locality: form.locality,
    previous_zakat_paid: form.previous_zakat_paid === true || form.previous_zakat_paid === 'true',
    previous_receipt: form.previous_receipt || null,
    items: [{ product: form.product, net_quantity: form.net_quantity, gross_quantity: form.net_quantity, packaging_weight: '0', unit: form.unit, irrigation_method: form.irrigation_method }],
  });
  if (!payload.previous_receipt) delete payload.previous_receipt;
  return payload;
}

function tradePayload(form) {
  return clean({
    company: form.company,
    assessment_date: form.assessment_date,
    zakat_year: form.zakat_year,
    period_start: form.period_start,
    period_end: form.period_end,
    cash_balance: form.cash_balance,
    trade_inventory_value: form.trade_inventory_value,
    receivables_value: form.receivables_value,
    allowed_liabilities: form.allowed_liabilities,
    other_assessable_assets: form.other_assessable_assets,
    currency: form.currency,
  });
}

function previousReceiptPayload(form) {
  return clean({
    receipt_number: form.receipt_number,
    issue_date: form.issue_date,
    payer: form.payer,
    issuing_state: form.issuing_state,
    issuing_locality: form.issuing_locality,
    issuing_office: form.issuing_office,
    crop: form.crop || null,
    paid_quantity: form.paid_quantity,
    paid_amount: form.paid_amount,
    currency: form.currency,
  });
}

function receiptPayload(form) {
  return clean({
    receipt_number: form.receipt_number,
    receipt_type: form.receipt_type,
    crop_assessment: form.crop_assessment || null,
    trade_assessment: form.trade_assessment || null,
    issue_date: form.issue_date,
    issuing_authority: form.issuing_authority,
    issuing_office: form.issuing_office,
    amount_paid: form.amount_paid,
    quantity_paid: form.quantity_paid,
    unit: form.unit,
    currency: form.currency,
  });
}

function certificatePayload(form) {
  return clean({
    certificate_number: form.certificate_number,
    party_name: form.party_name,
    zakat_year: form.zakat_year,
    issue_date: form.issue_date,
    expiry_date: form.expiry_date,
    issuing_authority: form.issuing_authority,
  });
}

function permitPayload(form) {
  const payload = clean({
    permit_number: form.permit_number,
    issue_date: form.issue_date,
    expiry_date: form.expiry_date,
    source_location: form.source_location,
    destination_location: form.destination_location,
    vehicle_number: form.vehicle_number,
    related_zakat_assessment: form.related_zakat_assessment || null,
    related_zakat_receipt: form.related_zakat_receipt || null,
  });
  if (form.product && form.quantity) payload.items = [{ product: form.product, quantity: form.quantity, unit: form.unit }];
  return payload;
}
