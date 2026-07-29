import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel } from './customerHelpers.js';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const customerTypes = ['farmer', 'investor', 'consumer', 'exporter', 'factory', 'supplier'];

export function createCustomerProfileEditForm(customer = {}) {
  return {
    name: customer.name || '',
    phone: customer.phone || '',
    secondaryPhone: customer.secondary_phone || customer.secondaryPhone || '',
    address: customer.address || '',
    customerType: customer.customer_type || customer.customerType || 'farmer',
    isActive: customer.is_active ?? customer.isActive ?? true,
    photo: null,
    photoPreview: '',
    notes: customer.notes || '',
  };
}

export function isCustomerProfileEditDirty(form, customer) {
  const initial = createCustomerProfileEditForm(customer);
  return JSON.stringify({ ...form, photo: null, photoPreview: '' }) !== JSON.stringify(initial) || Boolean(form.photo);
}

export function validateCustomerProfileEditForm(form, t) {
  const errors = [];
  if (!form.name.trim()) errors.push(t('customers.nameRequired'));
  if (!form.phone.trim()) errors.push(t('customers.phoneRequired'));
  if (!form.address.trim()) errors.push(t('customers.addressRequired'));
  if (form.photo) {
    if (!ACCEPTED_PHOTO_TYPES.includes(form.photo.type)) errors.push(t('customers.photoTypeError'));
    if (form.photo.size > MAX_PHOTO_SIZE) errors.push(t('customers.photoSizeError'));
  }
  return errors;
}

export default function CustomerProfileEditForm({
  form,
  customer,
  errors,
  onChange,
  onRemovePhoto,
  onSubmit,
  onCancel,
  isSaving = false,
}) {
  const { t } = useLanguage();
  const isArchived = Boolean(customer?.is_deleted || !customer?.is_active);
  const previewSource = form.photoPreview || customer?.photo_url || customer?.photoUrl || '';
  const preview = previewSource
    ? <img src={previewSource} alt={form.name || t('customers.avatarPlaceholder')} />
    : <span>{(form.name || t('customers.avatarPlaceholder')).slice(0, 1).toUpperCase()}</span>;

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <div className="form-field">
        <span className="form-field__label">{t('customers.photo')}</span>
        <div className="customer-photo-input">
          <div className="customer-avatar">{preview}</div>
          <label className="localized-file-input">
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} aria-label={t('customers.choosePhoto')} />
            <span className="localized-file-input__button">{t('customers.choosePhoto')}</span>
            <span className="localized-file-input__name">{form.photo?.name || t('customers.noFileSelected')}</span>
          </label>
          {form.photo && (
            <Button type="button" variant="secondary" onClick={onRemovePhoto} disabled={isSaving}>
              {t('customers.removeSelectedPhoto')}
            </Button>
          )}
        </div>
      </div>
      <label>
        {t('customers.namePlaceholder')}
        <input name="name" value={form.name} onChange={onChange} placeholder={t('customers.namePlaceholder')} />
      </label>
      <label>
        {t('common.phone')}
        <input name="phone" value={form.phone} onChange={onChange} placeholder="+249..." />
      </label>
      <label>
        {t('customers.secondaryPhone')}
        <input name="secondaryPhone" value={form.secondaryPhone || ''} onChange={onChange} placeholder="+249..." />
      </label>
      <label>
        {t('customers.address')}
        <input name="address" value={form.address} onChange={onChange} placeholder={t('customers.addressPlaceholder')} />
      </label>
      <label>
        {t('customers.customerType')}
        <select name="customerType" value={form.customerType} onChange={onChange}>
          {customerTypes.map((type) => (
            <option key={type} value={type}>{customerTypeLabel(type, t)}</option>
          ))}
        </select>
      </label>
      {!isArchived && (
        <label>
          {t('common.status')}
          <select name="isActive" value={form.isActive ? 'true' : 'false'} onChange={onChange}>
            <option value="true">{t('customers.paymentActive')}</option>
            <option value="false">{t('status.Inactive')}</option>
          </select>
        </label>
      )}
      <label className="form-grid__wide">
        {t('common.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.notesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('saveChanges')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
