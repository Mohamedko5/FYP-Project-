import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import CustomerForm from '../components/customers/CustomerForm.jsx';
import CustomerList from '../components/customers/CustomerList.jsx';
import CustomerProfile from '../components/customers/CustomerProfile.jsx';
import WorkerForm from '../components/customers/WorkerForm.jsx';
import WorkerList from '../components/customers/WorkerList.jsx';
import WorkerProfile from '../components/customers/WorkerProfile.jsx';
import {
  companyWorkers,
  customerCashTransactions,
  customerCommodityTransactions,
  commodityUnits,
  customers,
  orders,
  paymentHistory,
  products,
  warehouses,
} from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function createCustomerForm() {
  return {
    name: '',
    phone: '',
    address: '',
    customerType: 'Farmer',
    photoUrl: '',
    cashAccount: '',
    commodityBalance: '',
    notes: '',
  };
}

function createWorkerForm() {
  return {
    name: '',
    phone: '',
    workerType: 'General Worker',
    assignedWork: '',
    photoUrl: '',
    notes: '',
  };
}

export default function Customers() {
  const { t } = useLanguage();
  const [activeCustomerTab, setActiveCustomerTab] = useState('business');
  const [customerList, setCustomerList] = useState(customers);
  const [workerList, setWorkerList] = useState(companyWorkers);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState(createCustomerForm());
  const [workerForm, setWorkerForm] = useState(createWorkerForm());
  const [cashTransactions, setCashTransactions] = useState(customerCashTransactions);
  const [commodityTransactions, setCommodityTransactions] = useState(customerCommodityTransactions);
  const [formErrors, setFormErrors] = useState([]);
  const [workerErrors, setWorkerErrors] = useState([]);

  const selectedCustomer = useMemo(
    () => customerList.find((customer) => String(customer.id) === String(selectedCustomerId)),
    [customerList, selectedCustomerId]
  );
  const selectedWorker = useMemo(
    () => workerList.find((worker) => String(worker.id) === String(selectedWorkerId)),
    [workerList, selectedWorkerId]
  );

  const selectedCashTransactions = cashTransactions.filter(
    (transaction) => transaction.customer === selectedCustomer?.name
  );
  const selectedCommodityTransactions = commodityTransactions.filter(
    (transaction) => transaction.customer === selectedCustomer?.name
  );
  const selectedOrders = orders.filter((order) => order.customer === selectedCustomer?.name);
  const selectedPayments = paymentHistory.filter((payment) => payment.customer === selectedCustomer?.name);

  function switchCustomerTab(tab) {
    setActiveCustomerTab(tab);
    setSelectedCustomerId('');
    setSelectedWorkerId('');
    setShowCustomerForm(false);
    setShowWorkerForm(false);
  }

  function handleChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0];
      setCustomerForm((current) => ({ ...current, [name]: file ? URL.createObjectURL(file) : '' }));
      return;
    }
    setCustomerForm((current) => ({ ...current, [name]: value }));
  }

  function handleWorkerChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0];
      setWorkerForm((current) => ({ ...current, [name]: file ? URL.createObjectURL(file) : '' }));
      return;
    }
    setWorkerForm((current) => ({ ...current, [name]: value }));
  }

  function openCustomerForm() {
    setFormErrors([]);
    setCustomerForm(createCustomerForm());
    setShowCustomerForm(true);
  }

  function closeCustomerForm() {
    setFormErrors([]);
    setCustomerForm(createCustomerForm());
    setShowCustomerForm(false);
  }

  function openWorkerForm() {
    setWorkerErrors([]);
    setWorkerForm(createWorkerForm());
    setShowWorkerForm(true);
  }

  function closeWorkerForm() {
    setWorkerErrors([]);
    setWorkerForm(createWorkerForm());
    setShowWorkerForm(false);
  }

  function handleAddCustomer(event) {
    event.preventDefault();
    const errors = [];

    if (!customerForm.name.trim()) errors.push(t('customers.customerNameRequired'));
    if (!customerForm.phone.trim()) errors.push(t('customers.phoneRequired'));
    if (!customerForm.address.trim()) errors.push(t('customers.addressRequired'));

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const newCustomer = {
      id: Date.now(),
      name: customerForm.name,
      phone: customerForm.phone,
      address: customerForm.address,
      customerType: customerForm.customerType,
      photoUrl: customerForm.photoUrl,
      cashAccount: Number(customerForm.cashAccount || 0),
      commodityAccount: customerForm.commodityBalance || 'None',
      commodityBalance: customerForm.commodityBalance || 'None',
      debtBalance: Number(customerForm.cashAccount || 0),
      paidAmount: 0,
      remainingBalance: Number(customerForm.cashAccount || 0),
      status: Number(customerForm.cashAccount || 0) > 0 ? 'Debtor' : 'Balanced',
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      notes: customerForm.notes || t('warehouse.noNotes'),
    };

    setCustomerList((current) => [...current, newCustomer]);
    setSelectedCustomerId(newCustomer.id);
    setCustomerForm(createCustomerForm());
    setFormErrors([]);
    setShowCustomerForm(false);
  }

  function handleAddWorker(event) {
    event.preventDefault();
    const errors = [];

    if (!workerForm.name.trim()) errors.push(t('customers.workerNameRequired'));
    if (!workerForm.phone.trim()) errors.push(t('customers.phoneRequired'));
    if (!workerForm.assignedWork.trim()) errors.push(t('customers.assignedWorkRequired'));

    if (errors.length > 0) {
      setWorkerErrors(errors);
      return;
    }

    const newWorker = {
      id: Date.now(),
      name: workerForm.name,
      phone: workerForm.phone,
      workerType: workerForm.workerType,
      assignedWork: workerForm.assignedWork,
      status: 'Available',
      photoUrl: workerForm.photoUrl,
      notes: workerForm.notes || t('warehouse.noNotes'),
      paymentHistory: [],
    };

    setWorkerList((current) => [...current, newWorker]);
    setSelectedWorkerId(newWorker.id);
    setWorkerForm(createWorkerForm());
    setWorkerErrors([]);
    setShowWorkerForm(false);
  }

  function handlePrintStatement() {
    window.print();
  }

  function handleAddCashTransaction(transaction) {
    setCashTransactions((current) => [transaction, ...current]);
  }

  function handleAddCommodityTransaction(transaction) {
    setCommodityTransactions((current) => [transaction, ...current]);
  }

  function handleAddWorkerTransaction(workerId, transaction) {
    setWorkerList((current) =>
      current.map((worker) =>
        String(worker.id) === String(workerId)
          ? { ...worker, paymentHistory: [transaction, ...(worker.paymentHistory || [])] }
          : worker
      )
    );
  }

  return (
    <div className="page-grid customers-page">
      <div className="customer-module-tabs">
        <button
          type="button"
          className={`customer-module-tabs__button ${activeCustomerTab === 'business' ? 'is-active' : ''}`}
          onClick={() => switchCustomerTab('business')}
        >
          {t('customers.businessCustomers')}
        </button>
        <button
          type="button"
          className={`customer-module-tabs__button ${activeCustomerTab === 'workers' ? 'is-active' : ''}`}
          onClick={() => switchCustomerTab('workers')}
        >
          {t('customers.companyWorkers')}
        </button>
      </div>

      {activeCustomerTab === 'business' && (
        <>
          <Card title={t('customers.listTitle')} subtitle={t('customers.listSubtitle')}>
            <CustomerList customers={customerList} selectedCustomerId={selectedCustomerId} onSelect={setSelectedCustomerId} />
          </Card>

          {selectedCustomer && (
            <CustomerProfile
              customer={selectedCustomer}
              cashTransactions={selectedCashTransactions}
              commodityTransactions={selectedCommodityTransactions}
              orders={selectedOrders}
              payments={selectedPayments}
              products={products}
              units={commodityUnits}
              onAddCashTransaction={handleAddCashTransaction}
              onAddCommodityTransaction={handleAddCommodityTransaction}
              onPrint={handlePrintStatement}
              onClose={() => setSelectedCustomerId('')}
            />
          )}

          <div className="customers-add-new-section">
            {!showCustomerForm && <Button variant="secondary" onClick={openCustomerForm}>{t('customers.addNewCustomer')}</Button>}
          </div>

          {showCustomerForm && (
            <Card title={t('customers.formTitle')} subtitle={t('customers.formSubtitle')}>
              <CustomerForm form={customerForm} errors={formErrors} onChange={handleChange} onSubmit={handleAddCustomer} onCancel={closeCustomerForm} />
            </Card>
          )}
        </>
      )}

      {activeCustomerTab === 'workers' && (
        <>
          <Card title={t('customers.workersListTitle')} subtitle={t('customers.workersListSubtitle')}>
            <WorkerList workers={workerList} selectedWorkerId={selectedWorkerId} onSelect={setSelectedWorkerId} />
          </Card>

          {selectedWorker && (
            <WorkerProfile
              worker={selectedWorker}
              warehouses={warehouses}
              onAddTransaction={handleAddWorkerTransaction}
              onClose={() => setSelectedWorkerId('')}
            />
          )}

          <div className="customers-add-new-section">
            {!showWorkerForm && <Button variant="secondary" onClick={openWorkerForm}>{t('customers.addNewWorker')}</Button>}
          </div>

          {showWorkerForm && (
            <Card title={t('customers.addWorkerTitle')} subtitle={t('customers.addWorkerSubtitle')}>
              <WorkerForm form={workerForm} errors={workerErrors} onChange={handleWorkerChange} onSubmit={handleAddWorker} onCancel={closeWorkerForm} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
