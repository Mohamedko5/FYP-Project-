import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import { formatCurrency } from '../../data/dummyData.js';

const PURPOSES = ['invoice_payment', 'previous_balance', 'advance_payment', 'general_account_payment', 'other'];

export default function CustomerPaymentForm({
  form,
  errors,
  customer,
  unpaidInvoices,
  isLoadingInvoices,
  onChange,
  onSubmit,
  onCancel,
  t,
  isSaving = false,
}) {
  const isInvoicePayment = form.paymentPurpose === 'invoice_payment';

  return (
    <form className="form-grid customer-account-transaction-form" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('common.customerName')}
        <input value={customer.name} readOnly />
      </label>
      <label>
        {t('customers.currentBalance')}
        <input value={formatCurrency(customer.cash_balance || 0)} readOnly />
      </label>
      <label>
        {t('customers.debtStatus')}
        <span className="readonly-status"><StatusBadge status={customer.cash_status || 'Balanced'} /></span>
      </label>
      <label>
        {t('customers.paymentMethod')}
        <select name="paymentMethod" value={form.paymentMethod} onChange={onChange} disabled={isSaving}>
          <option value="cash">{t('customers.paymentMethods.cash')}</option>
          <option value="online">{t('customers.paymentMethods.online')}</option>
        </select>
      </label>
      <label>
        {t('customers.paymentPurpose')}
        <select name="paymentPurpose" value={form.paymentPurpose} onChange={onChange} disabled={isSaving}>
          {PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>{t(`customers.paymentPurposes.${purpose}`)}</option>
          ))}
        </select>
      </label>
      {isInvoicePayment && (
        <label>
          {t('customers.selectInvoice')}
          <select name="invoiceId" value={form.invoiceId} onChange={onChange} disabled={isSaving || isLoadingInvoices}>
            <option value="">{isLoadingInvoices ? t('journal.loading') : t('customers.selectInvoice')}</option>
            {unpaidInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} - {formatCurrency(invoice.outstanding_amount || invoice.total_amount)} - {invoice.issued_date || ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t('common.amount')}
        <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={onChange} readOnly={isInvoicePayment} disabled={isSaving} placeholder="0" />
      </label>
      <label className="form-grid__wide customer-account-transaction-form__description">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} disabled={isSaving} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split customer-account-transaction-form__actions">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('customers.savePayment')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
