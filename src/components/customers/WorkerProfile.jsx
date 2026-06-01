import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel } from './workerHelpers.js';
import WorkerTransactionForm from './WorkerTransactionForm.jsx';

const today = new Date().toISOString().slice(0, 10);
const currentTime = () => new Date().toTimeString().slice(0, 5);

function createTransactionForm(warehouses) {
  return {
    date: today,
    time: currentTime(),
    warehouseName: warehouses[0]?.warehouseName || '',
    paymentMode: 'bag',
    numberOfBags: '',
    pricePerBag: '',
    dailyWage: '',
    workDescription: '',
    notes: '',
  };
}

export default function WorkerProfile({ worker, warehouses = [], onClose, onAddTransaction }) {
  const { t, isArabic } = useLanguage();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState(createTransactionForm(warehouses));
  const [transactionErrors, setTransactionErrors] = useState([]);
  if (!worker) return null;

  const avatar = worker.photoUrl
    ? <img src={worker.photoUrl} alt={worker.name} />
    : <span>{worker.name.slice(0, 1).toUpperCase()}</span>;

  const isGeneralWorker = worker.workerType === 'General Worker';
  const isWeighingWorker = worker.workerType === 'Weighing Worker';

  const generalWorkerColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'warehouseName', label: t('customers.assignedLocationWarehouse') },
    { key: 'dailyWage', label: t('customers.dailyWage'), render: (row) => formatCurrency(row.dailyWage ?? row.totalWage ?? row.totalPayment ?? 0) },
    { key: 'workDescription', label: t('customers.workDescription') },
    { key: 'adminName', label: t('warehouse.admin') },
    { key: 'notes', label: t('warehouse.notes') },
  ];

  const weighingWorkerColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'warehouseName', label: t('warehouse.warehouse') },
    {
      key: 'paymentMethod',
      label: t('customers.paymentMethod'),
      render: (row) => row.paymentMethod === 'Daily Wage' ? t('customers.dailyWagePayment') : t('customers.bagBasedPayment'),
    },
    {
      key: 'workDetails',
      label: t('common.detail'),
      render: (row) => row.paymentMethod === 'Daily Wage'
        ? (row.workDescription || t('warehouse.noNotes'))
        : `${Number(row.numberOfBags || 0).toLocaleString()} × ${formatCurrency(row.pricePerBag || 0)}`,
    },
    { key: 'totalWage', label: t('customers.totalWage'), render: (row) => formatCurrency(row.totalWage ?? row.totalPayment ?? row.dailyWage ?? 0) },
    { key: 'adminName', label: t('warehouse.admin') },
    { key: 'notes', label: t('warehouse.notes') },
  ];

  const bagWorkerColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'warehouseName', label: t('warehouse.warehouse') },
    { key: 'numberOfBags', label: t('customers.numberOfBags'), render: (row) => Number(row.numberOfBags || 0).toLocaleString() },
    { key: 'pricePerBag', label: t('customers.pricePerBag'), render: (row) => formatCurrency(row.pricePerBag || 0) },
    { key: 'totalWage', label: t('customers.totalWage'), render: (row) => formatCurrency(row.totalWage ?? row.totalPayment ?? 0) },
    { key: 'adminName', label: t('warehouse.admin') },
    { key: 'notes', label: t('warehouse.notes') },
  ];

  const transactionColumns = isGeneralWorker
    ? generalWorkerColumns
    : isWeighingWorker
      ? weighingWorkerColumns
      : bagWorkerColumns;

  function openTransactionForm() {
    setTransactionForm(createTransactionForm(warehouses));
    setTransactionErrors([]);
    setShowTransactionForm(true);
  }

  function closeTransactionForm() {
    setTransactionForm(createTransactionForm(warehouses));
    setTransactionErrors([]);
    setShowTransactionForm(false);
  }

  function handleTransactionChange(event) {
    const { name, value } = event.target;
    setTransactionForm((current) => ({ ...current, [name]: value }));
  }

  function handleTransactionSubmit(event) {
    event.preventDefault();
    const errors = [];
    const numberOfBags = Number(transactionForm.numberOfBags);
    const pricePerBag = Number(transactionForm.pricePerBag);
    const dailyWage = Number(transactionForm.dailyWage);
    const usesDailyWage = isGeneralWorker || (isWeighingWorker && transactionForm.paymentMode === 'daily');

    if (!transactionForm.date || !transactionForm.time || !transactionForm.warehouseName) {
      errors.push(t('customers.workerTransactionRequiredError'));
    }

    if (usesDailyWage) {
      if (!dailyWage || dailyWage <= 0) errors.push(t('customers.dailyWageRequired'));
      if (!transactionForm.workDescription.trim()) errors.push(t('customers.workDescriptionRequired'));
    } else {
      if (!numberOfBags || numberOfBags <= 0) errors.push(t('customers.numberOfBagsRequired'));
      if (!pricePerBag || pricePerBag <= 0) errors.push(t('customers.pricePerBagRequired'));
    }

    if (errors.length > 0) {
      setTransactionErrors(errors);
      return;
    }

    const totalWage = usesDailyWage ? dailyWage : numberOfBags * pricePerBag;
    const transaction = {
      id: Date.now(),
      date: transactionForm.date,
      time: transactionForm.time,
      warehouseName: transactionForm.warehouseName,
      paymentMethod: usesDailyWage ? 'Daily Wage' : 'Bag Based',
      totalWage,
      totalPayment: totalWage,
      adminName: t('admin'),
      notes: transactionForm.notes || t('warehouse.noNotes'),
    };

    if (usesDailyWage) {
      transaction.dailyWage = dailyWage;
      transaction.workDescription = transactionForm.workDescription;
    } else {
      transaction.numberOfBags = numberOfBags;
      transaction.pricePerBag = pricePerBag;
    }

    onAddTransaction(worker.id, transaction);
    closeTransactionForm();
  }

  return (
    <Card title={t('customers.workerProfileTitle')} subtitle={t('customers.workerProfileSubtitle')}>
      <div className="customer-profile-header">
        <div className="customer-profile-identity">
          <div className="customer-avatar customer-avatar--large">{avatar}</div>
          <div>
            <h3>{worker.name}</h3>
            <p>{worker.phone}</p>
            <p>{workerTypeLabel(worker.workerType, isArabic)}</p>
          </div>
        </div>
        <div className="customer-profile-header__actions">
          {worker.status && <StatusBadge status={worker.status} />}
          <Button variant="secondary" onClick={onClose}>{t('customers.closeProfile')}</Button>
        </div>
      </div>

      <div className="detail-panel customer-profile-summary">
        <div>
          <span>{t('customers.workerType')}</span>
          <strong>{workerTypeLabel(worker.workerType, isArabic)}</strong>
        </div>
        <div>
          <span>{t('customers.assignedWork')}</span>
          <strong>{worker.assignedWork}</strong>
        </div>
      </div>

      <p className="customer-notes">{worker.notes}</p>

      <div className="customer-section-header">
        <div>
          <h3>{t('customers.workerTransactionHistory')}</h3>
          <p>{t('customers.workerTransactionSubtitle')}</p>
        </div>
        {!showTransactionForm && (
          <Button onClick={openTransactionForm}>{t('customers.addNewWorkerTransaction')}</Button>
        )}
      </div>

      {showTransactionForm && (
        <WorkerTransactionForm
          form={transactionForm}
          errors={transactionErrors}
          warehouses={warehouses}
          workerType={worker.workerType}
          onChange={handleTransactionChange}
          onSubmit={handleTransactionSubmit}
          onCancel={closeTransactionForm}
        />
      )}

      <div className="customer-profile-history">
        <Table columns={transactionColumns} rows={worker.paymentHistory || []} emptyMessage={t('customers.noPaymentHistory')} />
      </div>
    </Card>
  );
}
