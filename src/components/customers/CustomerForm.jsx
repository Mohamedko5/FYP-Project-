import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel } from './customerHelpers.js';

const customerTypes = ['Farmer', 'Investor', 'Consumer', 'Exporter', 'Factory', 'Supplier'];

export default function CustomerForm({ form, errors, onChange, onSubmit }) {
  const { t, isArabic } = useLanguage();

  return (
    <form className="form-grid form-grid--single" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('common.customerName')}
        <input name="name" value={form.name} onChange={onChange} placeholder={t('customers.namePlaceholder')} />
      </label>
      <label>
        {t('common.phone')}
        <input name="phone" value={form.phone} onChange={onChange} placeholder="+249..." />
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
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.notesPlaceholder')} />
      </label>
      <Button type="submit">{t('customers.addCustomer')}</Button>
    </form>
  );
}
