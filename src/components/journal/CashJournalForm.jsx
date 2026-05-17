import Button from '../ui/Button.jsx';

export default function CashJournalForm({ form, errors, isEditing, onChange, onSubmit, onCancel, t, statusLabel }) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('common.date')}
        <input name="date" type="date" value={form.date} onChange={onChange} />
      </label>
      <label>
        {t('common.time')}
        <input name="time" type="time" value={form.time} onChange={onChange} />
      </label>
      <label>
        {t('journal.transactionType')}
        <select name="type" value={form.type} onChange={onChange}>
          <option value="Income">{statusLabel('Income')}</option>
          <option value="Expense">{statusLabel('Expense')}</option>
        </select>
      </label>
      <label>
        {t('common.customerSupplier')}
        <input name="party" value={form.party} onChange={onChange} placeholder={t('journal.partyPlaceholder')} />
      </label>
      <label>
        {t('common.amount')}
        <input name="amount" type="number" min="0" value={form.amount} onChange={onChange} placeholder={t('journal.amountPlaceholder')} />
      </label>
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{isEditing ? t('journal.saveChanges') : t('journal.saveTransaction')}</Button>
        {isEditing && <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </form>
  );
}
