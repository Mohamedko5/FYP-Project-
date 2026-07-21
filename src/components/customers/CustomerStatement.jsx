import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel, productLabel, unitLabel } from './customerHelpers.js';

export default function CustomerStatement({ customer, cashTransactions, commodityTransactions, statement, visible = false, adminName = '' }) {
  const { t, isArabic } = useLanguage();
  if (!customer) return null;
  const statementCustomer = statement?.customer || customer;
  const generatedAt = statement?.generated_at ? new Date(statement.generated_at).toLocaleString() : new Date().toLocaleString();
  const cashRows = statement?.cash_transactions || cashTransactions;
  const commodityRows = statement?.commodity_transactions || commodityTransactions;
  const commodityBalances = statement?.commodity_balances || statementCustomer.commodity_balances || statementCustomer.commodityBalances || [];

  return (
    <section className={`customer-statement print-only ${visible ? 'customer-statement--visible' : ''}`}>
      <div className="statement-header">
        <div>
          <h1>{t('companyName')}</h1>
          <p>{t('customers.customerStatement')}</p>
        </div>
        <div>
          <span>{t('customers.datePrinted')}</span>
          <strong>{generatedAt}</strong>
        </div>
      </div>

      <div className="statement-grid">
        <p><strong>{t('customers.customerCode')}:</strong> {statementCustomer.code}</p>
        <p><strong>{t('common.customerName')}:</strong> {statementCustomer.name}</p>
        <p><strong>{t('common.phone')}:</strong> {statementCustomer.phone}</p>
        <p><strong>{t('customers.address')}:</strong> {statementCustomer.address}</p>
        <p><strong>{t('customers.customerType')}:</strong> {customerTypeLabel(statementCustomer.customer_type || statementCustomer.customerType, isArabic)}</p>
        <p><strong>{t('warehouse.admin')}:</strong> {adminName || '-'}</p>
      </div>

      <h2>{t('customers.balanceSummary')}</h2>
      <div className="statement-grid">
        <p><strong>{t('customers.cashBalance')}:</strong> {formatCurrency(Math.abs(Number(statement?.cash_balance ?? statementCustomer.cash_balance ?? 0)))}</p>
        <p><strong>{t('customers.debtStatus')}:</strong> {statement?.cash_status || statementCustomer.cash_status}</p>
        <p><strong>{t('customers.totalDebits')}:</strong> {formatCurrency(statement?.total_debits || statementCustomer.total_debits || 0)}</p>
        <p><strong>{t('customers.totalCredits')}:</strong> {formatCurrency(statement?.total_credits || statementCustomer.total_credits || 0)}</p>
        <p><strong>{t('customers.totalPaymentsReceived')}:</strong> {formatCurrency(statement?.total_payments_received || statementCustomer.total_payments_received || 0)}</p>
      </div>
      <div className="statement-grid">
        {commodityBalances.length === 0 ? (
          <p><strong>{t('customers.commodityBalance')}:</strong> -</p>
        ) : commodityBalances.map((row) => (
          <p key={`${row.product_id}-${row.unit}`}><strong>{productLabel(row.product_name, isArabic)}:</strong> {Number(row.quantity).toLocaleString()} {unitLabel(row.unit, isArabic)}</p>
        ))}
      </div>

      <h2>{t('customers.cashTransactions')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('common.date')}</th>
            <th>{t('common.type')}</th>
            <th>{t('common.amount')}</th>
            <th>{t('common.description')}</th>
          </tr>
        </thead>
        <tbody>
          {cashRows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.type || row.transaction_type}</td>
              <td>{formatCurrency(row.amount)}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t('customers.commodityTransactions')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('common.date')}</th>
            <th>{t('common.product')}</th>
            <th>{t('common.quantity')}</th>
            <th>{t('common.unit')}</th>
            <th>{t('customers.warehouseName')}</th>
          </tr>
        </thead>
        <tbody>
          {commodityRows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{productLabel(row.product || row.product_detail?.name_en, isArabic)}</td>
              <td>{row.quantity}</td>
              <td>{unitLabel(row.unit, isArabic)}</td>
              <td>{row.warehouseName || row.warehouse_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
