import Button from '../ui/Button.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel, workerTypes } from './workerHelpers.js';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function createWorkerProfileEditForm(worker = {}) {
  return {
    name: worker.name || '',
    phone: worker.phone || '',
    secondaryPhone: worker.secondary_phone || worker.secondaryPhone || '',
    workerType: worker.worker_type || worker.workerType || 'general_worker',
    assignedWork: worker.assigned_work || worker.assignedWork || '',
    status: worker.status || 'available',
    photo: null,
    photoPreview: '',
    notes: worker.notes || '',
  };
}

export function isWorkerProfileEditDirty(form, worker) {
  const initial = createWorkerProfileEditForm(worker);
  return JSON.stringify({ ...form, photo: null, photoPreview: '' }) !== JSON.stringify(initial) || Boolean(form.photo);
}

export function validateWorkerProfileEditForm(form, t) {
  const errors = [];
  if (!form.name.trim()) errors.push(t('customers.workerNameRequired'));
  if (!form.phone.trim()) errors.push(t('customers.phoneRequired'));
  if (!form.assignedWork.trim()) errors.push(t('customers.assignedWorkRequired'));
  if (form.photo) {
    if (!ACCEPTED_PHOTO_TYPES.includes(form.photo.type)) errors.push(t('customers.photoTypeError'));
    if (form.photo.size > MAX_PHOTO_SIZE) errors.push(t('customers.photoSizeError'));
  }
  return errors;
}

export default function WorkerProfileEditForm({
  form,
  worker,
  errors,
  onChange,
  onRemovePhoto,
  onSubmit,
  onCancel,
  isSaving = false,
}) {
  const { t } = useLanguage();
  const previewSource = form.photoPreview || worker?.photo_url || worker?.photoUrl || '';
  const preview = previewSource
    ? <img src={previewSource} alt={form.name || t('customers.workerName')} />
    : <span>{(form.name || t('customers.workerAvatar')).slice(0, 1).toUpperCase()}</span>;

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
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('saveChanges')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
