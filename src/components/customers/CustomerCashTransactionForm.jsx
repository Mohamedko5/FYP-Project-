import Button from '../ui/Button.jsx';

export default function CustomerCashTransactionForm({ form, errors, customerName, onChange, onSubmit, onCancel, t }) {
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
          <option value="Payment Received">{t('customers.paymentReceived')}</option>
          <option value="Payment Owed">{t('customers.paymentOwed')}</option>
          <option value="Customer Expense">{t('customers.customerExpense')}</option>
        </select>
      </label>
      <label>
        {t('common.customerName')}
        <input name="customer" value={customerName} readOnly />
      </label>
      <label>
        {t('common.amount')}
        <input name="amount" type="number" min="0" value={form.amount} onChange={onChange} placeholder="0" />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('journal.saveTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
