import Button from '../ui/Button.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function WorkerTransactionForm({ form, errors, warehouses, workerType, onChange, onSubmit, onCancel }) {
  const { t } = useLanguage();
  const isGeneralWorker = workerType === 'General Worker';
  const isWeighingWorker = workerType === 'Weighing Worker';
  const usesDailyWage = isGeneralWorker || (isWeighingWorker && form.paymentMode === 'daily');
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
        {isGeneralWorker ? t('customers.assignedLocationWarehouse') : t('warehouse.warehouse')}
        <select name="warehouseName" value={form.warehouseName} onChange={onChange}>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>
          ))}
        </select>
      </label>

      {isWeighingWorker && (
        <label>
          {t('customers.paymentMethod')}
          <select name="paymentMode" value={form.paymentMode} onChange={onChange}>
            <option value="bag">{t('customers.bagBasedPayment')}</option>
            <option value="daily">{t('customers.dailyWagePayment')}</option>
          </select>
        </label>
      )}

      {usesDailyWage ? (
        <>
          <label>
            {t('customers.dailyWage')}
            <input name="dailyWage" type="number" min="0" value={form.dailyWage} onChange={onChange} placeholder="0" />
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
            <input name="numberOfBags" type="number" min="0" value={form.numberOfBags} onChange={onChange} placeholder="0" />
          </label>
          <label>
            {t('customers.pricePerBag')}
            <input name="pricePerBag" type="number" min="0" value={form.pricePerBag} onChange={onChange} placeholder="0" />
          </label>
        </>
      )}

      <label>
        {t('customers.totalWage')}
        <input value={formatCurrency(totalWage)} readOnly />
      </label>
      <label className="form-grid__wide">
        {t('warehouse.notes')}
        <textarea name="notes" value={form.notes} onChange={onChange} placeholder={t('customers.workNotesPlaceholder')} />
      </label>
      <div className="form-grid__actions form-grid__actions--split">
        <Button type="submit">{t('journal.saveTransaction')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
