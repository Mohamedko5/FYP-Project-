import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import AppWindow from '../ui/AppWindow.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import PrintableWorkerStatement from '../reports/PrintableWorkerStatement.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { normalizeWorkerType, workerTypeLabel } from './workerHelpers.js';
import WorkerTransactionForm from './WorkerTransactionForm.jsx';
import WorkerProfileEditForm, {
  createWorkerProfileEditForm,
  isWorkerProfileEditDirty,
  validateWorkerProfileEditForm,
} from './WorkerProfileEditForm.jsx';

function statusDisplay(status) {
  return { available: 'Available', working: 'Working', inactive: 'Inactive', unpaid: 'Unpaid', paid: 'Paid' }[status] || status;
}

function createTransactionForm(worker, warehouses) {
  const type = normalizeWorkerType(worker?.worker_type || worker?.workerType);
  const calculationMethod = type === 'bag_carrying_worker' ? 'bag_based' : 'daily_wage';
  return {
    warehouseId: warehouses[0]?.id || '',
    calculationMethod,
    numberOfBags: '',
    pricePerBag: worker?.default_price_per_bag || '',
    dailyWage: worker?.default_daily_wage || '',
    workDescription: '',
    notes: '',
  };
}

export default function WorkerProfile({
  worker,
  warehouses = [],
  records = [],
  statement,
  isSavingRecord = false,
  isMarkingPaid = false,
  isSavingProfile = false,
  canEdit = false,
  onClose,
  onUpdateProfile,
  onAddRecord,
  onMarkPaid,
  onLoadStatement,
  onPrint,
  adminName,
}) {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState('');
  const [transactionForm, setTransactionForm] = useState(createTransactionForm(worker, warehouses));
  const [transactionErrors, setTransactionErrors] = useState([]);
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentErrors, setPaymentErrors] = useState([]);
  const [editForm, setEditForm] = useState(createWorkerProfileEditForm(worker));
  const [editErrors, setEditErrors] = useState([]);
  const recordButtonRef = useRef(null);
  const paymentButtonRef = useRef(null);
  const editButtonRef = useRef(null);

  useEffect(() => {
    setTransactionForm(createTransactionForm(worker, warehouses));
    setTransactionErrors([]);
    setPaymentRecord(null);
    setEditForm(createWorkerProfileEditForm(worker));
    setEditErrors([]);
    setActiveSection('');
  }, [worker?.id, warehouses]);

  if (!worker) return null;

  const avatar = worker.photo_url || worker.photoUrl
    ? <img src={worker.photo_url || worker.photoUrl} alt={worker.name} />
    : <span>{worker.name.slice(0, 1).toUpperCase()}</span>;
  const recordDirty = activeSection === 'record' && JSON.stringify(transactionForm) !== JSON.stringify(createTransactionForm(worker, warehouses));
  const paymentDirty = activeSection === 'payment' && paymentMethod !== 'cash';
  const editDirty = activeSection === 'edit' && isWorkerProfileEditDirty(editForm, worker);

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'code', label: t('customers.workRecordCode') },
    { key: 'warehouse_name', label: t('warehouse.warehouse') },
    { key: 'calculation_method', label: t('customers.calculationMethod'), render: (row) => row.calculation_method === 'daily_wage' ? t('customers.dailyWagePayment') : t('customers.bagBasedPayment') },
    { key: 'daily_wage', label: t('customers.dailyWage'), render: (row) => row.daily_wage ? formatCurrency(row.daily_wage) : '-' },
    { key: 'bags', label: t('customers.numberOfBags'), render: (row) => row.number_of_bags || '-' },
    { key: 'price_per_bag', label: t('customers.pricePerBag'), render: (row) => row.price_per_bag ? formatCurrency(row.price_per_bag) : '-' },
    { key: 'total_wage', label: t('customers.totalWage'), render: (row) => formatCurrency(row.total_wage) },
    { key: 'payment_status', label: t('customers.paymentStatus'), render: (row) => <StatusBadge status={statusDisplay(row.payment_status)} /> },
    { key: 'payment_method', label: t('customers.paymentMethod'), render: (row) => row.payment_method ? t(`customers.paymentMethods.${row.payment_method}`) : '-' },
    { key: 'admin', label: t('warehouse.admin'), render: (row) => row.administrator_name },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => row.payment_status === 'unpaid'
        ? <Button variant="secondary" onClick={() => openPayment(row)} ref={paymentButtonRef}>{t('customers.markAsPaid')}</Button>
        : <span className="muted-text">{row.paid_by_name || '-'}</span>,
    },
  ];

  function openRecordForm() {
    setActiveSection('record');
    setTransactionForm(createTransactionForm(worker, warehouses));
    setTransactionErrors([]);
  }

  function openPayment(record) {
    setActiveSection('payment');
    setPaymentRecord(record);
    setPaymentMethod('cash');
    setPaymentErrors([]);
  }

  function openEditForm() {
    setActiveSection('edit');
    setEditForm(createWorkerProfileEditForm(worker));
    setEditErrors([]);
  }

  function closeSection() {
    setActiveSection('');
    setTransactionErrors([]);
    setPaymentErrors([]);
    setPaymentRecord(null);
    setEditErrors([]);
  }

  function handleTransactionChange(event) {
    const { name, value } = event.target;
    setTransactionForm((current) => ({ ...current, [name]: value }));
  }

  function handleEditChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0] || null;
      setEditForm((current) => ({
        ...current,
        photo: file,
        photoPreview: file ? URL.createObjectURL(file) : '',
      }));
      return;
    }
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  function removeSelectedPhoto() {
    setEditForm((current) => ({ ...current, photo: null, photoPreview: '' }));
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    const validationErrors = validateWorkerProfileEditForm(editForm, t);
    if (validationErrors.length) {
      setEditErrors(validationErrors);
      return;
    }
    setEditErrors([]);
    try {
      const payload = new FormData();
      payload.append('name', editForm.name);
      payload.append('phone', editForm.phone);
      payload.append('secondary_phone', editForm.secondaryPhone);
      payload.append('worker_type', editForm.workerType);
      payload.append('assigned_work', editForm.assignedWork);
      payload.append('status', editForm.status);
      payload.append('notes', editForm.notes);
      if (editForm.photo) payload.append('photo', editForm.photo);
      await onUpdateProfile?.(worker.id, payload);
      closeSection();
    } catch (error) {
      setEditErrors([error?.message || t('unableToUpdateInformation')]);
    }
  }

  async function handleTransactionSubmit(event) {
    event.preventDefault();
    setTransactionErrors([]);
    try {
      await onAddRecord({
        warehouse_id: transactionForm.warehouseId,
        calculation_method: transactionForm.calculationMethod,
        daily_wage: transactionForm.calculationMethod === 'daily_wage' ? transactionForm.dailyWage : '',
        number_of_bags: transactionForm.calculationMethod === 'bag_based' ? transactionForm.numberOfBags : '',
        price_per_bag: transactionForm.calculationMethod === 'bag_based' ? transactionForm.pricePerBag : '',
        work_description: transactionForm.workDescription,
        notes: transactionForm.notes,
      });
      closeSection();
    } catch (error) {
      setTransactionErrors(String(error.message || error).split('\n'));
    }
  }

  async function handleMarkPaid(event) {
    event.preventDefault();
    setPaymentErrors([]);
    try {
      await onMarkPaid(paymentRecord.id, paymentMethod);
      closeSection();
    } catch (error) {
      setPaymentErrors(String(error.message || error).split('\n'));
    }
  }

  return (
    <Card title={t('customers.workerProfileTitle')} subtitle={t('customers.workerProfileSubtitle')}>
      <div className="customer-profile-header section-header">
        <div className="customer-profile-identity">
          <div className="customer-avatar customer-avatar--large">{avatar}</div>
          <div>
            <h3>{worker.name}</h3>
            <p>{worker.code}</p>
            <p>{worker.phone}</p>
            <p>{workerTypeLabel(worker.worker_type, t)}</p>
          </div>
        </div>
        <div className="customer-profile-header__actions">
          <StatusBadge status={statusDisplay(worker.status)} />
          {canEdit && <Button variant="secondary" onClick={openEditForm} ref={editButtonRef}>{t('editProfile')}</Button>}
          <Button variant="secondary" onClick={onClose}>{t('customers.closeProfile')}</Button>
        </div>
      </div>

      <div className="detail-panel customer-profile-summary">
        <div><span>{t('customers.paidWages')}</span><strong>{formatCurrency(worker.paid_wage_total || 0)}</strong></div>
        <div><span>{t('customers.unpaidWages')}</span><strong>{formatCurrency(worker.unpaid_wage_total || 0)}</strong></div>
        <div><span>{t('customers.totalWorkRecords')}</span><strong>{worker.total_work_records || 0}</strong></div>
        <div><span>{t('customers.lastWorkDate')}</span><strong>{worker.last_work_at ? new Date(worker.last_work_at).toLocaleDateString() : '-'}</strong></div>
      </div>

      <p className="customer-notes">{worker.notes || t('warehouse.noNotes')}</p>

      <div className="customer-profile-tabs">
        <button type="button" className={`customer-profile-tabs__button ${activeSection === 'record' ? 'is-active' : ''}`} onClick={openRecordForm} ref={recordButtonRef}>{t('customers.addNewWorkerTransaction')}</button>
        <button type="button" className={`customer-profile-tabs__button ${activeSection === 'history' ? 'is-active' : ''}`} onClick={() => setActiveSection('history')}>{t('customers.workerTransactionHistory')}</button>
        <button type="button" className={`customer-profile-tabs__button ${activeSection === 'statement' ? 'is-active' : ''}`} onClick={() => { setActiveSection('statement'); onLoadStatement?.(); }}>{t('customers.printWorkerStatement')}</button>
      </div>

      <AppWindow
        id="worker-profile-edit"
        title={t('editProfile')}
        description={t('customers.editWorkerProfileSubtitle')}
        isOpen={activeSection === 'edit'}
        isDirty={editDirty}
        isSubmitting={isSavingProfile}
        defaultSize="large"
        openerRef={editButtonRef}
        onClose={closeSection}
      >
        <WorkerProfileEditForm
          form={editForm}
          worker={worker}
          errors={editErrors}
          onChange={handleEditChange}
          onRemovePhoto={removeSelectedPhoto}
          onSubmit={handleEditSubmit}
          onCancel={closeSection}
          isSaving={isSavingProfile}
        />
      </AppWindow>

      <AppWindow
        id="worker-record"
        title={t('customers.addNewWorkerTransaction')}
        description={t('customers.workerProfileSubtitle')}
        isOpen={activeSection === 'record'}
        isDirty={recordDirty}
        isSubmitting={isSavingRecord}
        defaultSize="large"
        openerRef={recordButtonRef}
        onClose={closeSection}
      >
        <WorkerTransactionForm
            form={transactionForm}
            errors={transactionErrors}
            warehouses={warehouses}
            workerType={worker.worker_type}
            onChange={handleTransactionChange}
            onSubmit={handleTransactionSubmit}
            onCancel={closeSection}
            isSaving={isSavingRecord}
          />
      </AppWindow>

      <AppWindow
        id="worker-payment"
        title={t('customers.confirmPayment')}
        description={paymentRecord?.code}
        isOpen={activeSection === 'payment' && Boolean(paymentRecord)}
        isDirty={paymentDirty}
        isSubmitting={isMarkingPaid}
        defaultSize="medium"
        openerRef={paymentButtonRef}
        onClose={closeSection}
      >
      {paymentRecord && (
        <form className="form-grid" onSubmit={handleMarkPaid}>
          {paymentErrors.length > 0 && <div className="form-error form-grid__wide">{paymentErrors.map((error) => <p key={error}>{error}</p>)}</div>}
          <label>{t('customers.workerName')}<input value={worker.name} readOnly /></label>
          <label>{t('customers.workRecordCode')}<input value={paymentRecord.code} readOnly /></label>
          <label>{t('customers.totalWage')}<input value={formatCurrency(paymentRecord.total_wage)} readOnly /></label>
          <label>{t('customers.paymentMethod')}<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">{t('customers.paymentMethods.cash')}</option><option value="online">{t('customers.paymentMethods.online')}</option></select></label>
          <div className="form-grid__actions form-grid__actions--split">
            <Button type="submit" disabled={isMarkingPaid}>{isMarkingPaid ? t('journal.saving') : t('customers.confirmPayment')}</Button>
            <Button type="button" variant="secondary" onClick={closeSection} disabled={isMarkingPaid}>{t('cancel')}</Button>
          </div>
        </form>
      )}
      </AppWindow>

      {(activeSection === 'history' || !activeSection) && (
        <div className="customer-profile-history">
          <Table columns={columns} rows={records} emptyMessage={t('customers.noWorkRecords')} />
        </div>
      )}

      {activeSection === 'statement' && (
        <div className="customer-section-header section-header">
          <Button onClick={onPrint}>{t('reports.printPdf')}</Button>
          <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
        </div>
      )}

      <PrintableWorkerStatement worker={worker} records={records} statement={statement} adminName={adminName} />
    </Card>
  );
}
