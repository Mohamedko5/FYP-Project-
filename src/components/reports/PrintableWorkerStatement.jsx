import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel } from '../customers/workerHelpers.js';

export default function PrintableWorkerStatement({ worker, statement, records, adminName }) {
  const { t, statusLabel } = useLanguage();
  if (!worker) return null;
  const rows = statement?.work_records || records || [];
  const generatedAt = statement?.generated_at ? new Date(statement.generated_at).toLocaleString() : new Date().toLocaleString();

  return (
    <section className="print-area customer-statement print-only" aria-label="Printable worker statement">
      <div className="statement-header">
        <div>
          <h1>{t('companyName')}</h1>
          <p>{t('customers.workerStatement')}</p>
        </div>
        <div>
          <span>{t('customers.datePrinted')}</span>
          <strong>{generatedAt}</strong>
        </div>
      </div>
      <div className="statement-grid">
        <p><strong>{t('customers.workerCode')}:</strong> {worker.code}</p>
        <p><strong>{t('customers.workerName')}:</strong> {worker.name}</p>
        <p><strong>{t('common.phone')}:</strong> {worker.phone}</p>
        <p><strong>{t('customers.workerType')}:</strong> {workerTypeLabel(worker.worker_type, t)}</p>
        <p><strong>{t('customers.assignedWork')}:</strong> {worker.assigned_work}</p>
        <p><strong>{t('common.status')}:</strong> {statusLabel(worker.status)}</p>
        <p><strong>{t('customers.paidWages')}:</strong> {formatCurrency(statement?.total_paid_wages || worker.paid_wage_total || 0)}</p>
        <p><strong>{t('customers.unpaidWages')}:</strong> {formatCurrency(statement?.total_unpaid_wages || worker.unpaid_wage_total || 0)}</p>
        <p><strong>{t('warehouse.admin')}:</strong> {adminName || '-'}</p>
      </div>
      <h2>{t('customers.workerTransactionHistory')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('common.date')}</th>
            <th>{t('customers.workRecordCode')}</th>
            <th>{t('warehouse.warehouse')}</th>
            <th>{t('customers.calculationMethod')}</th>
            <th>{t('customers.totalWage')}</th>
            <th>{t('customers.paymentStatus')}</th>
            <th>{t('customers.paymentMethod')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.code}</td>
              <td>{row.warehouse_name}</td>
              <td>{row.calculation_method === 'daily_wage' ? t('customers.dailyWagePayment') : t('customers.bagBasedPayment')}</td>
              <td>{formatCurrency(row.total_wage)}</td>
              <td>{statusLabel(row.payment_status)}</td>
              <td>{row.payment_method ? t(`customers.paymentMethods.${row.payment_method}`) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
