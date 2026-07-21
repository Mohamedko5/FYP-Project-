import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel } from './customerHelpers.js';

const customerTypes = ['farmer', 'investor', 'consumer', 'exporter', 'factory', 'supplier'];

export default function CustomerForm({ form, errors, onChange, onSubmit, onCancel, isSaving = false }) {
  const { t, isArabic } = useLanguage();
  const preview = form.photoPreview
    ? <img src={form.photoPreview} alt={form.name || t('customers.photo')} />
    : <span>{(form.name || t('customers.avatarPlaceholder')).slice(0, 1).toUpperCase()}</span>;

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('customers.photo')}
        <div className="customer-photo-input">
          <div className="customer-avatar">{preview}</div>
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
        </div>
      </label>
      <label>
        {t('common.customerName')}
        <input name="name" value={form.name} onChange={onChange} placeholder={t('customers.namePlaceholder')} />
      </label>
      <label>
        {t('common.phone')}
        <input name="phone" value={form.phone} onChange={onChange} placeholder="+249..." />
      </label>
      <label>
        {t('customers.secondaryPhone')}
        <input name="secondaryPhone" value={form.secondaryPhone} onChange={onChange} placeholder="+249..." />
      </label>
      <label>
        {t('customers.address')}
        <input name="address" value={form.address} onChange={onChange} placeholder={t('customers.addressPlaceholder')} />
      </label>
      <label>
        {t('customers.customerType')}
        <select name="customerType" value={form.customerType} onChange={onChange}>
          {customerTypes.map((type) => (
            <option key={type} value={type}>{customerTypeLabel(type, isArabic)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('customers.initialCashBalance')}
        <input name="openingBalanceAmount" type="number" min="0" step="0.01" value={form.openingBalanceAmount} onChange={onChange} placeholder="0" />
      </label>
      {form.openingBalanceAmount && (
        <label>
          {t('customers.openingBalanceType')}
          <select name="openingBalanceType" value={form.openingBalanceType} onChange={onChange}>
            <option value="customer_owes_company">{t('customers.customerOwesCompany')}</option>
            <option value="company_owes_customer">{t('customers.companyOwesCustomer')}</option>
          </select>
        </label>
      )}
      <label>
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.notesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('customers.addCustomer')}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>}
      </div>
    </form>
  );
}
