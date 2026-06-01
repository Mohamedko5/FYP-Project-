import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel, workerTypes } from './workerHelpers.js';

export default function WorkerForm({ form, errors, onChange, onSubmit, onCancel }) {
  const { t, isArabic } = useLanguage();
  const preview = form.photoUrl
    ? <img src={form.photoUrl} alt={form.name || t('customers.workerName')} />
    : <span>{(form.name || t('customers.workerAvatar')).slice(0, 1).toUpperCase()}</span>;

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
          <input name="photoUrl" type="file" accept="image/*" onChange={onChange} />
        </div>
      </label>
      <label>
        {t('customers.workerName')}
        <input name="name" value={form.name} onChange={onChange} placeholder={t('customers.workerNamePlaceholder')} />
      </label>
      <label>
        {t('common.phone')}
        <input name="phone" value={form.phone} onChange={onChange} placeholder="+249..." />
      </label>
      <label>
        {t('customers.workerType')}
        <select name="workerType" value={form.workerType} onChange={onChange}>
          {workerTypes.map((type) => (
            <option key={type} value={type}>{workerTypeLabel(type, isArabic)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('customers.assignedWork')}
        <input name="assignedWork" value={form.assignedWork} onChange={onChange} placeholder={t('customers.assignedWorkPlaceholder')} />
      </label>
      <label className="form-grid__wide">
        {t('customers.workNotes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.workNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('customers.addWorker')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
