import Button from '../ui/Button.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { normalizeWorkerType } from './workerHelpers.js';

export default function WorkerTransactionForm({ form, errors, warehouses, workerType, onChange, onSubmit, onCancel, isSaving = false }) {
  const { t } = useLanguage();
  const normalizedType = normalizeWorkerType(workerType);
  const isGeneralWorker = normalizedType === 'general_worker';
  const isBagWorker = normalizedType === 'bag_carrying_worker';
  const isWeighingWorker = normalizedType === 'weighing_worker';
  const usesDailyWage = isGeneralWorker || (isWeighingWorker && form.calculationMethod === 'daily_wage');
  const totalWage = usesDailyWage
    ? Number(form.dailyWage || 0)
    : Number(form.numberOfBags || 0) * Number(form.pricePerBag || 0);

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div className="form-error form-grid__wide">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <label>
        {t('warehouse.warehouse')}
        <select name="warehouseId" value={form.warehouseId} onChange={onChange}>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouseName || warehouse.warehouse_name}</option>
          ))}
        </select>
      </label>

      {isWeighingWorker && (
        <label>
          {t('customers.calculationMethod')}
          <select name="calculationMethod" value={form.calculationMethod} onChange={onChange}>
            <option value="daily_wage">{t('customers.dailyWagePayment')}</option>
            <option value="bag_based">{t('customers.bagBasedPayment')}</option>
          </select>
        </label>
      )}

      {(isGeneralWorker || isBagWorker) && (
        <label>
          {t('customers.calculationMethod')}
          <input value={isGeneralWorker ? t('customers.dailyWagePayment') : t('customers.bagBasedPayment')} readOnly />
        </label>
      )}

      {usesDailyWage ? (
        <>
          <label>
            {t('customers.dailyWage')}
            <input name="dailyWage" type="number" min="0" step="0.01" value={form.dailyWage} onChange={onChange} placeholder="0" />
          </label>
          <label className="form-grid__wide">
            {t('customers.workDescription')}
            <textarea name="workDescription" value={form.workDescription} onChange={onChange} placeholder={t('customers.workDescriptionPlaceholder')} />
          </label>
        </>
      ) : (
        <>
          <label>
            {t('customers.numberOfBags')}
            <input name="numberOfBags" type="number" min="0" step="0.001" value={form.numberOfBags} onChange={onChange} placeholder="0" />
          </label>
          <label>
            {t('customers.pricePerBag')}
            <input name="pricePerBag" type="number" min="0" step="0.01" value={form.pricePerBag} onChange={onChange} placeholder="0" />
          </label>
          <label className="form-grid__wide">
            {t('customers.workDescription')}
            <textarea name="workDescription" value={form.workDescription} onChange={onChange} placeholder={t('customers.workDescriptionPlaceholder')} />
          </label>
        </>
      )}

      <label>
        {t('customers.totalWagePreview')}
        <input value={formatCurrency(totalWage)} readOnly />
      </label>
      <label className="form-grid__wide">
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.workNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit" disabled={isSaving}>{isSaving ? t('journal.saving') : t('journal.saveTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
