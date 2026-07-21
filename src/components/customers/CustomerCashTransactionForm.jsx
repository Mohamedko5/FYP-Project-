import Button from '../ui/Button.jsx';

export default function CustomerCashTransactionForm({ form, errors, customerName, onChange, onSubmit, onCancel, t, isSaving = false }) {
  const requiresPaymentMethod = form.type === 'payment_received' || form.type === 'customer_expense';

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('journal.transactionType')}
        <select name="type" value={form.type} onChange={onChange}>
          <option value="payment_received">{t('customers.paymentReceived')}</option>
          <option value="payment_owed">{t('customers.paymentOwed')}</option>
          <option value="customer_expense">{t('customers.customerExpense')}</option>
        </select>
      </label>
      {requiresPaymentMethod && (
        <label>
          {t('customers.paymentMethod')}
          <select name="paymentMethod" value={form.paymentMethod} onChange={onChange}>
            <option value="cash">{t('customers.paymentMethods.cash')}</option>
            <option value="online">{t('customers.paymentMethods.online')}</option>
          </select>
        </label>
      )}
      <label>
        {t('common.customerName')}
        <input name="customer" value={customerName} readOnly />
      </label>
      <label>
        {t('common.amount')}
        <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={onChange} placeholder="0" />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('journal.saveTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
