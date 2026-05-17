import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel, productLabel, unitLabel } from './customerHelpers.js';

export default function CustomerStatement({ customer, cashTransactions, commodityTransactions }) {
  const { t, isArabic, statusLabel } = useLanguage();
  if (!customer) return null;

  return (
    <section className="customer-statement print-only">
      <div className="statement-header">
        <div>
          <h1>{t('companyName')}</h1>
          <p>{t('customers.customerStatement')}</p>
        </div>
        <div>
          <span>{t('customers.datePrinted')}</span>
          <strong>{new Date().toLocaleDateString()}</strong>
        </div>
      </div>

      <div className="statement-grid">
        <p><strong>{t('common.customerName')}:</strong> {customer.name}</p>
        <p><strong>{t('common.phone')}:</strong> {customer.phone}</p>
        <p><strong>{t('customers.address')}:</strong> {customer.address}</p>
        <p><strong>{t('customers.customerType')}:</strong> {customerTypeLabel(customer.customerType, isArabic)}</p>
        <p><strong>{t('customers.debtStatus')}:</strong> {statusLabel(customer.status)}</p>
      </div>

      <h2>{t('customers.balanceSummary')}</h2>
      <div className="statement-grid">
        <p><strong>{t('customers.cashBalance')}:</strong> {formatCurrency(Math.abs(customer.cashAccount))}</p>
        <p><strong>{t('customers.commodityBalance')}:</strong> {customer.commodityBalance}</p>
        <p><strong>{t('customers.debtBalance')}:</strong> {formatCurrency(customer.debtBalance)}</p>
        <p><strong>{t('common.remainingBalance')}:</strong> {formatCurrency(customer.remainingBalance)}</p>
      </div>

      <h2>{t('customers.cashTransactions')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('common.date')}</th>
            <th>{t('common.type')}</th>
            <th>{t('common.amount')}</th>
            <th>{t('journal.lahuAlayh')}</th>
            <th>{t('common.description')}</th>
          </tr>
        </thead>
        <tbody>
          {cashTransactions.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.type}</td>
              <td>{formatCurrency(row.amount)}</td>
              <td>{statusLabel(row.lahuWaAlayh)}</td>
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
            <th>{t('journal.lahuAlayh')}</th>
          </tr>
        </thead>
        <tbody>
          {commodityTransactions.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{productLabel(row.product, isArabic)}</td>
              <td>{row.quantity}</td>
              <td>{unitLabel(row.unit, isArabic)}</td>
              <td>{row.warehouseName}</td>
              <td>{statusLabel(row.lahuWaAlayh)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
