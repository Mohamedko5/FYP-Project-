import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
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

function chartData(rows, key, valueKey = 'count') {
  return (rows || []).map((row) => ({ name: row[key] || 'Unknown', value: Number(row[valueKey] || 0) }));
}

export default function ZakatManagement() {
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
      setError(err.message || 'Unable to load Zakat module data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAction(handler) {
    setError('');
    try {
      await handler();
      await load();
    } catch (err) {
      setError(err.message || 'Action failed.');
    }
  }

  const statCards = useMemo(() => ([
    ['Pending crop assessments', dashboard.pending_crop_assessments],
    ['Awaiting verification', dashboard.awaiting_verification],
    ['Unpaid assessments', dashboard.unpaid_assessments],
    ['Valid receipts', dashboard.valid_receipts],
    ['Certificates expiring soon', dashboard.certificates_expiring_soon],
    ['Expired certificates', dashboard.expired_certificates],
    ['Active movement permits', dashboard.active_movement_permits],
    ['Permits expiring soon', dashboard.permits_expiring_soon],
  ]), [dashboard]);

  return (
    <div className="module-page zakat-page">
      <header className="module-page-header">
        <div>
          <span className="module-page-header__eyebrow">Compliance</span>
          <h1>Zakat Management</h1>
          <p>Configurable Zakat rules, crop and trade assessments, receipts, certificates, movement permits, audit, and reports.</p>
          <p className="zakat-notice">{dashboard.notice || 'Rates and official documents must be confirmed by the competent Zakat Chamber before production use.'}</p>
        </div>
        <div className="module-page-header__actions">
          <Button type="button" variant="secondary" onClick={load}>Refresh</Button>
          <Button type="button" onClick={() => setAction('crop')}>New Crop Assessment</Button>
        </div>
      </header>

      <div className="module-tabs" role="tablist" aria-label="Zakat sections">
        {tabs.map((tab) => (
          <button key={tab} type="button" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {error && <div className="form-error"><p>{error}</p></div>}
      {loading && <Card><p className="module-muted">Loading Zakat records...</p></Card>}

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
          <Card title="Recent Crop Assessments" subtitle="Latest assessment workflow status">
            <CropTable rows={cropAssessments.slice(0, 8)} onCalculate={(row) => runAction(() => calculateCropZakatAssessment(row.id))} onApprove={(row) => runAction(() => approveCropZakatAssessment(row.id))} />
          </Card>
        </>
      )}

      {activeTab === 'crop' && (
        <Card title="Crop Zakat Assessments" subtitle="Assess crop Zakat without changing inventory balances">
          <div className="button-row">
            <Button type="button" onClick={() => setAction('crop')}>New Crop Assessment</Button>
            <Button type="button" variant="secondary" onClick={() => setAction('previousReceipt')}>Previous Receipt Evidence</Button>
          </div>
          <CropTable rows={cropAssessments} onCalculate={(row) => runAction(() => calculateCropZakatAssessment(row.id))} onApprove={(row) => runAction(() => approveCropZakatAssessment(row.id))} />
        </Card>
      )}

      {activeTab === 'trade' && (
        <Card title="Trade Zakat Assessments" subtitle="Separate business/trade Zakat calculation">
          <div className="button-row"><Button type="button" onClick={() => setAction('trade')}>New Trade Assessment</Button></div>
          <Table
            rows={tradeAssessments}
            columns={[
              { key: 'assessment_number', label: 'Number' },
              { key: 'company', label: 'Company' },
              { key: 'zakat_year', label: 'Year' },
              { key: 'net_assessable_base', label: 'Base', render: (row) => money(row.net_assessable_base, row.currency) },
              { key: 'zakat_due', label: 'Due', render: (row) => money(row.zakat_due, row.currency) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'action', label: 'Action', render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => calculateTradeZakatAssessment(row.id))}>Calculate</Button> },
            ]}
          />
        </Card>
      )}

      {activeTab === 'receipts' && (
        <Card title="Receipts and Previous Evidence" subtitle="Official receipts and proof already paid elsewhere">
          <div className="button-row">
            <Button type="button" onClick={() => setAction('receipt')}>New Zakat Receipt</Button>
            <Button type="button" variant="secondary" onClick={() => setAction('previousReceipt')}>New Previous Evidence</Button>
          </div>
          <Table
            rows={receipts}
            columns={[
              { key: 'receipt_number', label: 'Receipt' },
              { key: 'receipt_type', label: 'Type' },
              { key: 'issue_date', label: 'Date' },
              { key: 'amount_paid', label: 'Amount', render: (row) => money(row.amount_paid, row.currency) },
              { key: 'verification_status', label: 'Verification', render: (row) => <StatusBadge status={row.verification_status} /> },
              { key: 'action', label: 'Action', render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => verifyZakatReceipt(row.id))}>Verify</Button> },
            ]}
          />
          <h3 className="zakat-subtitle">Previous Zakat Receipt Evidence</h3>
          <Table
            rows={previousReceipts}
            columns={[
              { key: 'receipt_number', label: 'Receipt' },
              { key: 'payer', label: 'Payer' },
              { key: 'issuing_office', label: 'Office' },
              { key: 'verification_status', label: 'Verification', render: (row) => <StatusBadge status={row.verification_status} /> },
              { key: 'action', label: 'Action', render: (row) => <Button type="button" variant="secondary" onClick={() => runAction(() => verifyPreviousZakatReceipt(row.id))}>Verify</Button> },
            ]}
          />
        </Card>
      )}

      {activeTab === 'certificates' && (
        <Card title="Performance Certificates" subtitle="Validity and expiry monitoring">
          <div className="button-row"><Button type="button" onClick={() => setAction('certificate')}>New Certificate</Button></div>
          <Table rows={certificates} columns={[
            { key: 'certificate_number', label: 'Certificate' },
            { key: 'party_name', label: 'Party' },
            { key: 'zakat_year', label: 'Year' },
            { key: 'expiry_date', label: 'Expiry' },
            { key: 'computed_status', label: 'Status', render: (row) => <StatusBadge status={row.computed_status || row.status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'permits' && (
        <Card title="Crop Movement Permits" subtitle="Permit checks linked to Zakat evidence">
          <div className="button-row"><Button type="button" onClick={() => setAction('permit')}>New Movement Permit</Button></div>
          <Table rows={permits} columns={[
            { key: 'permit_number', label: 'Permit' },
            { key: 'source_location', label: 'Source' },
            { key: 'destination_location', label: 'Destination' },
            { key: 'expiry_date', label: 'Expiry' },
            { key: 'computed_status', label: 'Status', render: (row) => <StatusBadge status={row.computed_status || row.status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'rules' && (
        <Card title="Rules and Rates" subtitle="Draft local rule configuration until official confirmation">
          <div className="button-row">
            <Button type="button" onClick={() => setAction('rule')}>New Rule</Button>
            <Button type="button" variant="secondary" onClick={() => runAction(seedDraftZakatRules)}>Seed Draft Rules</Button>
          </div>
          <Table rows={rules} columns={[
            { key: 'rule_code', label: 'Code' },
            { key: 'name_en', label: 'Name' },
            { key: 'zakat_type', label: 'Type' },
            { key: 'irrigation_method', label: 'Irrigation' },
            { key: 'rate_percentage', label: 'Rate %' },
            { key: 'verification_status', label: 'Verification', render: (row) => <StatusBadge status={row.verification_status} /> },
          ]} />
        </Card>
      )}

      {activeTab === 'reports' && (
        <div className="zakat-report-grid">
          <ChartCard title="Assessments by Status" data={chartData(reports.assessments_by_status, 'assessment_status')} />
          <ChartCard title="Irrigation Distribution" data={chartData(reports.irrigation_distribution, 'irrigation_method')} />
          <BarCard title="Calculated Amount by Crop" data={(reports.calculated_amount_by_crop || []).map((row) => ({ name: row.product_name_snapshot || 'Crop', value: Number(row.amount || 0) }))} />
          <BarCard title="Trade Zakat by Year" data={(reports.trade_zakat_by_year || []).map((row) => ({ name: String(row.zakat_year || 'Year'), value: Number(row.amount || 0) }))} />
        </div>
      )}

      {activeTab === 'audit' && (
        <Card title="Audit History" subtitle="Sensitive Zakat actions and calculation events">
          <Table rows={auditRows} columns={[
            { key: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
            { key: 'actor_name', label: 'User' },
            { key: 'action', label: 'Action' },
            { key: 'record_type', label: 'Record' },
            { key: 'reason', label: 'Reason' },
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

const tabLabels = {
  dashboard: 'Dashboard',
  crop: 'Crop Assessments',
  trade: 'Trade Assessments',
  receipts: 'Receipts',
  certificates: 'Certificates',
  permits: 'Movement Permits',
  rules: 'Rules and Rates',
  reports: 'Reports',
  audit: 'Audit',
};

function CropTable({ rows, onCalculate, onApprove }) {
  return (
    <Table
      rows={rows}
      columns={[
        { key: 'assessment_number', label: 'Number' },
        { key: 'seller_name_snapshot', label: 'Seller' },
        { key: 'agricultural_season', label: 'Season' },
        { key: 'irrigation_method', label: 'Irrigation' },
        { key: 'total_zakat_value', label: 'Due', render: (row) => money(row.total_zakat_value, row.currency) },
        { key: 'assessment_status', label: 'Status', render: (row) => <StatusBadge status={row.assessment_status} /> },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <div className="button-row button-row--compact">
              <Button type="button" variant="secondary" onClick={() => onCalculate(row)}>Calculate</Button>
              <Button type="button" variant="secondary" onClick={() => onApprove(row)}>Approve</Button>
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
      setError(err.message || 'Unable to save Zakat record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppWindow id={`zakat-${action}`} title={windowTitles[action]} description={windowDescriptions[action]} isOpen onClose={onClose} isSubmitting={saving}>
      <form className="module-dialog zakat-form" onSubmit={submit}>
        {error && <div className="form-error"><p>{error}</p></div>}
        {action === 'rule' && (
          <>
            <Field label="Rule Code" value={form.rule_code} onChange={(value) => update('rule_code', value)} required />
            <Field label="Arabic Name" value={form.name_ar} onChange={(value) => update('name_ar', value)} required />
            <Field label="English Name" value={form.name_en} onChange={(value) => update('name_en', value)} required />
            <Select label="Type" value={form.zakat_type} onChange={(value) => update('zakat_type', value)} options={[['crop', 'Crop'], ['trade', 'Trade']]} />
            <Select label="Calculation" value={form.calculation_method} onChange={(value) => update('calculation_method', value)} options={[['quantity_percentage', 'Quantity %'], ['monetary_percentage', 'Monetary %'], ['manual_official_assessment', 'Manual Official']]} />
            <Select label="Irrigation" value={form.irrigation_method} onChange={(value) => update('irrigation_method', value)} options={[['', 'Not specific'], ['natural', 'Natural'], ['artificial', 'Artificial'], ['mixed', 'Mixed']]} />
            <Select label="Crop Product" value={form.crop_product || ''} onChange={(value) => update('crop_product', value)} options={[['', 'Any crop'], ...productOptions.map((product) => [product.id, product.name_en || product.name_ar || product.name])]} />
            <Field label="Rate %" type="number" step="0.0001" value={form.rate_percentage} onChange={(value) => update('rate_percentage', value)} required />
            <Field label="Threshold Quantity" type="number" step="0.001" value={form.threshold_quantity} onChange={(value) => update('threshold_quantity', value)} />
            <Field label="Threshold Unit" value={form.threshold_unit} onChange={(value) => update('threshold_unit', value)} />
            <Field label="Monetary Threshold" type="number" step="0.01" value={form.monetary_threshold} onChange={(value) => update('monetary_threshold', value)} />
            <Field label="Official Valuation Price" type="number" step="0.01" value={form.official_valuation_price} onChange={(value) => update('official_valuation_price', value)} />
            <Field label="Effective From" type="date" value={form.effective_from} onChange={(value) => update('effective_from', value)} required />
            <Field label="Issuing Authority" value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} />
            <Field label="Official Reference" value={form.official_reference} onChange={(value) => update('official_reference', value)} />
          </>
        )}
        {action === 'crop' && (
          <>
            <Field label="Seller Name" value={form.seller_name_snapshot} onChange={(value) => update('seller_name_snapshot', value)} required />
            <Field label="Assessment Date" type="date" value={form.assessment_date} onChange={(value) => update('assessment_date', value)} required />
            <Field label="Season" value={form.agricultural_season} onChange={(value) => update('agricultural_season', value)} required />
            <Select label="Irrigation" value={form.irrigation_method} onChange={(value) => update('irrigation_method', value)} options={[['natural', 'Natural'], ['artificial', 'Artificial'], ['mixed', 'Mixed'], ['unknown', 'Unknown']]} />
            <Field label="State" value={form.state} onChange={(value) => update('state', value)} />
            <Field label="Locality" value={form.locality} onChange={(value) => update('locality', value)} />
            <Select label="Product" value={form.product} onChange={(value) => update('product', value)} options={productOptions.map((product) => [product.id, product.name_en || product.name_ar || product.name])} required />
            <Field label="Net Quantity" type="number" step="0.001" value={form.net_quantity} onChange={(value) => update('net_quantity', value)} required />
            <Field label="Unit" value={form.unit} onChange={(value) => update('unit', value)} required />
            <Select label="Previous Zakat Paid" value={form.previous_zakat_paid} onChange={(value) => update('previous_zakat_paid', value)} options={[[false, 'No'], [true, 'Yes']]} />
            <Select label="Previous Receipt" value={form.previous_receipt || ''} onChange={(value) => update('previous_receipt', value)} options={[['', 'None'], ...previousReceipts.map((receipt) => [receipt.id, receipt.receipt_number])]} />
          </>
        )}
        {action === 'trade' && (
          <>
            <Field label="Company Name" value={form.company} onChange={(value) => update('company', value)} required />
            <Field label="Assessment Date" type="date" value={form.assessment_date} onChange={(value) => update('assessment_date', value)} required />
            <Field label="Zakat Year" type="number" value={form.zakat_year} onChange={(value) => update('zakat_year', value)} required />
            <Field label="Period Start" type="date" value={form.period_start} onChange={(value) => update('period_start', value)} required />
            <Field label="Period End" type="date" value={form.period_end} onChange={(value) => update('period_end', value)} required />
            <Field label="Cash Balance" type="number" step="0.01" value={form.cash_balance} onChange={(value) => update('cash_balance', value)} />
            <Field label="Trade Inventory Value" type="number" step="0.01" value={form.trade_inventory_value} onChange={(value) => update('trade_inventory_value', value)} />
            <Field label="Receivables" type="number" step="0.01" value={form.receivables_value} onChange={(value) => update('receivables_value', value)} />
            <Field label="Liabilities" type="number" step="0.01" value={form.allowed_liabilities} onChange={(value) => update('allowed_liabilities', value)} />
            <Field label="Other Assets" type="number" step="0.01" value={form.other_assessable_assets} onChange={(value) => update('other_assessable_assets', value)} />
          </>
        )}
        {action === 'previousReceipt' && (
          <>
            <Field label="Receipt Number" value={form.receipt_number} onChange={(value) => update('receipt_number', value)} required />
            <Field label="Issue Date" type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label="Payer Name" value={form.payer} onChange={(value) => update('payer', value)} required />
            <Field label="Issuing State" value={form.issuing_state} onChange={(value) => update('issuing_state', value)} />
            <Field label="Issuing Locality" value={form.issuing_locality} onChange={(value) => update('issuing_locality', value)} />
            <Field label="Issuing Office" value={form.issuing_office} onChange={(value) => update('issuing_office', value)} required />
            <Select label="Crop" value={form.crop || ''} onChange={(value) => update('crop', value)} options={[['', 'None'], ...productOptions.map((product) => [product.id, product.name_en || product.name_ar || product.name])]} />
            <Field label="Paid Quantity" type="number" step="0.001" value={form.paid_quantity} onChange={(value) => update('paid_quantity', value)} />
            <Field label="Paid Amount" type="number" step="0.01" value={form.paid_amount} onChange={(value) => update('paid_amount', value)} />
          </>
        )}
        {action === 'receipt' && (
          <>
            <Field label="Receipt Number" value={form.receipt_number} onChange={(value) => update('receipt_number', value)} required />
            <Select label="Receipt Type" value={form.receipt_type} onChange={(value) => update('receipt_type', value)} options={[['crop_zakat', 'Crop Zakat'], ['trade_zakat', 'Trade Zakat'], ['official_external_receipt', 'External Official'], ['internal_payment_record', 'Internal Payment']]} />
            <Select label="Crop Assessment" value={form.crop_assessment || ''} onChange={(value) => update('crop_assessment', value)} options={[['', 'None'], ...cropAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Select label="Trade Assessment" value={form.trade_assessment || ''} onChange={(value) => update('trade_assessment', value)} options={[['', 'None'], ...tradeAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Field label="Issue Date" type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label="Issuing Authority" value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} required />
            <Field label="Issuing Office" value={form.issuing_office} onChange={(value) => update('issuing_office', value)} />
            <Field label="Amount Paid" type="number" step="0.01" value={form.amount_paid} onChange={(value) => update('amount_paid', value)} />
            <Field label="Quantity Paid" type="number" step="0.001" value={form.quantity_paid} onChange={(value) => update('quantity_paid', value)} />
            <Field label="Unit" value={form.unit} onChange={(value) => update('unit', value)} />
          </>
        )}
        {action === 'certificate' && (
          <>
            <Field label="Certificate Number" value={form.certificate_number} onChange={(value) => update('certificate_number', value)} required />
            <Field label="Party Name" value={form.party_name} onChange={(value) => update('party_name', value)} required />
            <Field label="Zakat Year" type="number" value={form.zakat_year} onChange={(value) => update('zakat_year', value)} required />
            <Field label="Issue Date" type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label="Expiry Date" type="date" value={form.expiry_date} onChange={(value) => update('expiry_date', value)} required />
            <Field label="Issuing Authority" value={form.issuing_authority} onChange={(value) => update('issuing_authority', value)} required />
          </>
        )}
        {action === 'permit' && (
          <>
            <Field label="Permit Number" value={form.permit_number} onChange={(value) => update('permit_number', value)} required />
            <Field label="Issue Date" type="date" value={form.issue_date} onChange={(value) => update('issue_date', value)} required />
            <Field label="Expiry Date" type="date" value={form.expiry_date} onChange={(value) => update('expiry_date', value)} required />
            <Field label="Source Location" value={form.source_location} onChange={(value) => update('source_location', value)} required />
            <Field label="Destination Location" value={form.destination_location} onChange={(value) => update('destination_location', value)} required />
            <Field label="Vehicle Number" value={form.vehicle_number} onChange={(value) => update('vehicle_number', value)} />
            <Select label="Assessment" value={form.related_zakat_assessment || ''} onChange={(value) => update('related_zakat_assessment', value)} options={[['', 'None'], ...cropAssessments.map((row) => [row.id, row.assessment_number])]} />
            <Select label="Receipt" value={form.related_zakat_receipt || ''} onChange={(value) => update('related_zakat_receipt', value)} options={[['', 'None'], ...receipts.map((row) => [row.id, row.receipt_number])]} />
            <Select label="Product" value={form.product || ''} onChange={(value) => update('product', value)} options={productOptions.map((product) => [product.id, product.name_en || product.name_ar || product.name])} />
            <Field label="Quantity" type="number" step="0.001" value={form.quantity} onChange={(value) => update('quantity', value)} />
            <Field label="Unit" value={form.unit} onChange={(value) => update('unit', value)} />
          </>
        )}
        <div className="button-row">
          <Button type="submit" disabled={saving}>Save</Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
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

const windowTitles = {
  rule: 'New Zakat Rule',
  crop: 'New Crop Assessment',
  trade: 'New Trade Assessment',
  previousReceipt: 'Previous Receipt Evidence',
  receipt: 'New Zakat Receipt',
  certificate: 'New Performance Certificate',
  permit: 'New Movement Permit',
};

const windowDescriptions = {
  rule: 'Configure draft rates and thresholds pending official confirmation.',
  crop: 'Record crop quantities for assessment. Inventory is not deducted.',
  trade: 'Record business balances for separate trade Zakat calculation.',
  previousReceipt: 'Capture evidence of Zakat paid outside this ERP.',
  receipt: 'Record a Zakat receipt or payment proof.',
  certificate: 'Track validity of Zakat performance certificates.',
  permit: 'Track crop movement permit validity and linked Zakat evidence.',
};

function defaultForm(action, productId) {
  const base = { assessment_date: today, issue_date: today, effective_from: today, currency: 'SDG', unit: 'Bag' };
  if (action === 'rule') return { ...base, rule_code: '', name_ar: '', name_en: '', zakat_type: 'crop', calculation_method: 'quantity_percentage', irrigation_method: 'natural', crop_product: '', rate_percentage: '10', threshold_quantity: '0', threshold_unit: 'Bag', official_valuation_price: '0', monetary_threshold: '0', issuing_authority: 'Zakat Chamber' };
  if (action === 'crop') return { ...base, seller_name_snapshot: '', agricultural_season: String(new Date().getFullYear()), irrigation_method: 'natural', state: 'White Nile', locality: 'Kosti', product: productId || '', net_quantity: '', previous_zakat_paid: false, previous_receipt: '' };
  if (action === 'trade') return { ...base, company: '', zakat_year: new Date().getFullYear(), period_start: `${new Date().getFullYear()}-01-01`, period_end: `${new Date().getFullYear()}-12-31`, cash_balance: '0', trade_inventory_value: '0', receivables_value: '0', allowed_liabilities: '0', other_assessable_assets: '0' };
  if (action === 'previousReceipt') return { ...base, receipt_number: '', payer: '', issuing_state: 'White Nile', issuing_locality: 'Kosti', issuing_office: '', crop: productId || '', paid_quantity: '', paid_amount: '' };
  if (action === 'receipt') return { ...base, receipt_number: '', receipt_type: 'crop_zakat', crop_assessment: '', trade_assessment: '', issuing_authority: 'Zakat Chamber', issuing_office: '', amount_paid: '0', quantity_paid: '', unit: '' };
  if (action === 'certificate') return { ...base, certificate_number: '', party_name: '', zakat_year: new Date().getFullYear(), expiry_date: today, issuing_authority: 'Zakat Chamber' };
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
