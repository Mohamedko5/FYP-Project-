import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel, workerTypes } from './workerHelpers.js';

export default function WorkerForm({ form, errors, onChange, onSubmit, onCancel, isSaving = false }) {
  const { t } = useLanguage();
  const preview = form.photoPreview
    ? <img src={form.photoPreview} alt={form.name || t('customers.workerName')} />
    : <span>{(form.name || t('customers.workerAvatar')).slice(0, 1).toUpperCase()}</span>;
  const isGeneral = form.workerType === 'general_worker';
  const isBag = form.workerType === 'bag_carrying_worker';
  const isWeighing = form.workerType === 'weighing_worker';

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
        </div>
      </div>
      <label>
        {t('customers.workerName')}
        <input name="name" value={form.name} onChange={onChange} placeholder={t('customers.workerNamePlaceholder')} />
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
        {t('customers.workerType')}
        <select name="workerType" value={form.workerType} onChange={onChange}>
          {workerTypes.map((type) => (
            <option key={type} value={type}>{workerTypeLabel(type, t)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('customers.assignedWork')}
        <input name="assignedWork" value={form.assignedWork} onChange={onChange} placeholder={t('customers.assignedWorkPlaceholder')} />
      </label>
      {(isGeneral || isWeighing) && (
        <label>
          {t('customers.defaultDailyWage')}
          <input name="defaultDailyWage" type="number" min="0" step="0.01" value={form.defaultDailyWage || ''} onChange={onChange} placeholder="0" />
        </label>
      )}
      {(isBag || isWeighing) && (
        <label>
          {t('customers.defaultPricePerBag')}
          <input name="defaultPricePerBag" type="number" min="0" step="0.01" value={form.defaultPricePerBag || ''} onChange={onChange} placeholder="0" />
        </label>
      )}
      <label>
        {t('common.status')}
        <select name="status" value={form.status} onChange={onChange}>
          <option value="available">{t('status.Available')}</option>
          <option value="working">{t('status.Working')}</option>
          <option value="inactive">{t('status.Inactive')}</option>
        </select>
      </label>
      <label className="form-grid__wide">
        {t('customers.workNotes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.workNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('customers.addWorker')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
