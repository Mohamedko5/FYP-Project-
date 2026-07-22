import Button from '../ui/Button.jsx';

function CashIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="2" /><circle cx="10" cy="10" r="2.2" /><path d="M6 8h1.5M12.5 12H14" /></svg>;
}

function ElectronicIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M3 8h14M6 12h4" /></svg>;
}

export default function CashJournalForm({ form, errors, isEditing, isSaving = false, onChange, onRemoveReceipt, onSubmit, onCancel, t, statusLabel }) {
  const isElectronic = form.paymentMethod === 'electronic';
  const receiptPreview = form.paymentReceiptPreview || form.existingReceiptUrl;
  const receiptName = form.paymentReceipt?.name || (form.existingReceiptUrl ? t('journal.existingReceipt') : t('journal.noReceiptSelected'));

  return (
    <form className="form-grid cash-transaction-form" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('journal.transactionType')}
        <select name="type" value={form.type} onChange={onChange}>
          <option value="Income">{statusLabel('Income')}</option>
          <option value="Expense">{statusLabel('Expense')}</option>
        </select>
      </label>
      <label>
        {t('journal.paymentMethod')}
        <div className="payment-method-segment" role="radiogroup" aria-label={t('journal.paymentMethod')}>
          <label className={`payment-method-option ${form.paymentMethod === 'cash' ? 'is-selected' : ''}`}>
            <input type="radio" name="paymentMethod" value="cash" checked={form.paymentMethod === 'cash'} onChange={onChange} />
            <CashIcon />
            <span>{t('journal.paymentMethods.cash')}</span>
          </label>
          <label className={`payment-method-option ${isElectronic ? 'is-selected' : ''}`}>
            <input type="radio" name="paymentMethod" value="electronic" checked={isElectronic} onChange={onChange} />
            <ElectronicIcon />
            <span>{t('journal.paymentMethods.electronic')}</span>
          </label>
        </div>
      </label>
      <label>
        {t('common.customerSupplier')}
        <input name="party" value={form.party} onChange={onChange} placeholder={t('journal.partyPlaceholder')} />
      </label>
      <label>
        {t('common.amount')}
        <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={onChange} placeholder={t('journal.amountPlaceholder')} />
      </label>
      {isElectronic && (
        <>
          <label className="form-grid__wide">
            {t('journal.electronicReference')}
            <input name="electronicReference" value={form.electronicReference} onChange={onChange} placeholder={t('journal.electronicReferencePlaceholder')} />
          </label>
          <div className="form-field form-grid__wide">
            <span className="form-field__label">{t('journal.uploadPaymentReceipt')}</span>
            <label className="localized-file-input receipt-upload-input">
              <input name="paymentReceipt" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} aria-label={t('journal.chooseReceiptImage')} />
              <span className="localized-file-input__button">{form.paymentReceipt || form.existingReceiptUrl ? t('journal.changeReceipt') : t('journal.chooseReceiptImage')}</span>
              <span className="localized-file-input__name">{receiptName}</span>
            </label>
            {receiptPreview && (
              <div className="receipt-preview">
                <span>{t('journal.receiptPreview')}</span>
                <img src={receiptPreview} alt={t('journal.receiptPreview')} />
                <Button type="button" variant="secondary" onClick={onRemoveReceipt} disabled={isSaving}>{t('journal.removeReceipt')}</Button>
              </div>
            )}
          </div>
        </>
      )}
      <label className="form-grid__wide">
        {t('common.description')}
        <textarea name="description" value={form.description} onChange={onChange} placeholder={t('journal.descriptionPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : isEditing ? t('journal.saveChanges') : t('journal.saveTransaction')}</Button>
      </div>
    </form>
  );
}
