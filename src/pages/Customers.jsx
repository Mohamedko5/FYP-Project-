import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import CustomerForm from '../components/customers/CustomerForm.jsx';
import CustomerList from '../components/customers/CustomerList.jsx';
import CustomerProfile from '../components/customers/CustomerProfile.jsx';
import WorkerForm from '../components/customers/WorkerForm.jsx';
import WorkerList from '../components/customers/WorkerList.jsx';
import WorkerProfile from '../components/customers/WorkerProfile.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  createCustomer,
  createCustomerCashTransaction,
  createCustomerCommodityTransaction,
  createCustomerPayment,
  getCustomer,
  getCustomerCashTransactions,
  getCustomerCommodityTransactions,
  getCustomerStatement,
  getCustomers,
  restoreCustomer,
} from '../services/customersApi.js';
import { getProducts, getWarehouses } from '../services/inventoryApi.js';
import {
  createWorker,
  createWorkerWorkRecord,
  getWorker,
  getWorkerStatement,
  getWorkerWorkRecords,
  getWorkers,
  markWorkerWorkRecordPaid,
  updateWorker,
} from '../services/workersApi.js';

function createCustomerForm() {
  return {
    name: '',
    phone: '',
    secondaryPhone: '',
    address: '',
    customerType: 'farmer',
    photo: null,
    photoPreview: '',
    openingBalanceAmount: '',
    openingBalanceType: 'customer_owes_company',
    notes: '',
  };
}

function createWorkerForm() {
  return {
    name: '',
    phone: '',
    secondaryPhone: '',
    workerType: 'general_worker',
    assignedWork: '',
    defaultDailyWage: '',
    defaultPricePerBag: '',
    status: 'available',
    photo: null,
    photoPreview: '',
    notes: '',
  };
}

function formatApiError(error, t) {
  if (error?.code === 'ERR_NETWORK') return t('common.networkError');
  return t('common.requestFailed');
}

function storedAdminName() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user.username || user.email || 'Bayad Admin';
  } catch {
    return 'Bayad Admin';
  }
}

function readRole() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user?.profile?.role || user?.role || '';
  } catch {
    return '';
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name_en,
    nameAr: row.name_ar,
    category: row.category,
    units: (row.units || []).map((unit) => ({
      value: unit.unit,
      label: unit.unit,
      isDefault: unit.is_default,
    })),
  };
}

function mapWarehouse(row) {
  return {
    id: row.id,
    warehouseName: row.warehouse_name,
    location: row.location,
  };
}

export default function Customers() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [activeCustomerTab, setActiveCustomerTab] = useState('business');
  const [customerList, setCustomerList] = useState([]);
  const [workerList, setWorkerList] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState(createCustomerForm());
  const [workerForm, setWorkerForm] = useState(createWorkerForm());
  const [cashTransactions, setCashTransactions] = useState([]);
  const [commodityTransactions, setCommodityTransactions] = useState([]);
  const [statement, setStatement] = useState(null);
  const [products, setProducts] = useState([]);
  const [formErrors, setFormErrors] = useState([]);
  const [workerErrors, setWorkerErrors] = useState([]);
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingCash, setIsSavingCash] = useState(false);
  const [isSavingCommodity, setIsSavingCommodity] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isRestoringCustomer, setIsRestoringCustomer] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [isLoadingWorkerProfile, setIsLoadingWorkerProfile] = useState(false);
  const [isSavingWorker, setIsSavingWorker] = useState(false);
  const [isSavingWorkerProfile, setIsSavingWorkerProfile] = useState(false);
  const [isSavingWorkRecord, setIsSavingWorkRecord] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [filters, setFilters] = useState({ search: '', customer_type: '', cash_status: '' });
  const [workerFilters, setWorkerFilters] = useState({ search: '', worker_type: '', status: '' });
  const [workerRecords, setWorkerRecords] = useState([]);
  const [workerStatement, setWorkerStatement] = useState(null);
  const adminName = storedAdminName();
  const currentRole = readRole();
  const isAdmin = currentRole === 'admin';
  const canEditWorkerProfile = ['admin', 'manager'].includes(currentRole);
  const addCustomerButtonRef = useRef(null);
  const addWorkerButtonRef = useRef(null);

  const selectedPayments = cashTransactions.filter((transaction) => transaction.transaction_type === 'payment_received');
  const customerFormDirty = showCustomerForm && JSON.stringify({ ...customerForm, photoPreview: '', photo: null }) !== JSON.stringify(createCustomerForm());
  const workerFormDirty = showWorkerForm && JSON.stringify({ ...workerForm, photoPreview: '', photo: null }) !== JSON.stringify(createWorkerForm());

  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    setApiError('');
    try {
      const [customerResponse, productResponse] = await Promise.all([
        getCustomers({ ...filters, page_size: 100 }),
        getProducts({ active: true }),
      ]);
      const rows = Array.isArray(customerResponse) ? customerResponse : customerResponse.results || [];
      setCustomerList(rows);
      setProducts((Array.isArray(productResponse) ? productResponse : productResponse.results || productResponse).map(mapProduct));
      if (selectedCustomerId && !rows.some((customer) => String(customer.id) === String(selectedCustomerId))) {
        setSelectedCustomerId('');
        setSelectedCustomer(null);
      }
    } catch (error) {
      setApiError(formatApiError(error, t));
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [filters, selectedCustomerId, t]);

  const loadSelectedCustomer = useCallback(async (customerId) => {
    if (!customerId) return;
    setIsLoadingProfile(true);
    setApiError('');
    try {
      const [customer, cashRows, commodityRows] = await Promise.all([
        getCustomer(customerId),
        getCustomerCashTransactions(customerId),
        getCustomerCommodityTransactions(customerId),
      ]);
      setSelectedCustomer(customer);
      setCashTransactions(cashRows);
      setCommodityTransactions(commodityRows);
      setStatement(null);
    } catch (error) {
      setApiError(formatApiError(error, t));
    } finally {
      setIsLoadingProfile(false);
    }
  }, [t]);

  const loadWorkers = useCallback(async () => {
    setIsLoadingWorkers(true);
    setApiError('');
    try {
      const [workerResponse, warehouseResponse] = await Promise.all([
        getWorkers({ ...workerFilters, page_size: 100 }),
        getWarehouses({ is_active: true }),
      ]);
      const rows = Array.isArray(workerResponse) ? workerResponse : workerResponse.results || [];
      setWorkerList(rows);
      setWarehouseList((Array.isArray(warehouseResponse) ? warehouseResponse : warehouseResponse.results || warehouseResponse).map(mapWarehouse));
      if (selectedWorkerId && !rows.some((worker) => String(worker.id) === String(selectedWorkerId))) {
        setSelectedWorkerId('');
        setSelectedWorker(null);
      }
    } catch (error) {
      setApiError(formatApiError(error, t));
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [workerFilters, selectedWorkerId, t]);

  const loadSelectedWorker = useCallback(async (workerId) => {
    if (!workerId) return;
    setIsLoadingWorkerProfile(true);
    setApiError('');
    try {
      const [worker, records] = await Promise.all([
        getWorker(workerId),
        getWorkerWorkRecords(workerId),
      ]);
      setSelectedWorker(worker);
      setWorkerRecords(records);
      setWorkerStatement(null);
    } catch (error) {
      setApiError(formatApiError(error, t));
    } finally {
      setIsLoadingWorkerProfile(false);
    }
  }, [t]);

  useEffect(() => {
    if (activeCustomerTab === 'business') loadCustomers();
  }, [activeCustomerTab, loadCustomers]);

  useEffect(() => {
    const customerId = searchParams.get('customer');
    if (customerId) {
      setActiveCustomerTab('business');
      setSelectedCustomerId(customerId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeCustomerTab === 'workers') loadWorkers();
  }, [activeCustomerTab, loadWorkers]);

  useEffect(() => {
    if (selectedCustomerId) loadSelectedCustomer(selectedCustomerId);
  }, [selectedCustomerId, loadSelectedCustomer]);

  useEffect(() => {
    if (selectedWorkerId) loadSelectedWorker(selectedWorkerId);
  }, [selectedWorkerId, loadSelectedWorker]);

  function switchCustomerTab(tab) {
    setSuccessMessage('');
    setActiveCustomerTab(tab);
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setSelectedWorkerId('');
    setSelectedWorker(null);
    setShowCustomerForm(false);
    setShowWorkerForm(false);
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleWorkerFilterChange(event) {
    const { name, value } = event.target;
    setWorkerFilters((current) => ({ ...current, [name]: value }));
  }

  function handleChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0] || null;
      setCustomerForm((current) => ({
        ...current,
        photo: file,
        photoPreview: file ? URL.createObjectURL(file) : '',
      }));
      return;
    }
    setCustomerForm((current) => ({ ...current, [name]: value }));
  }

  function handleWorkerChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0] || null;
      setWorkerForm((current) => ({
        ...current,
        photo: file,
        photoPreview: file ? URL.createObjectURL(file) : '',
      }));
      return;
    }
    setWorkerForm((current) => ({ ...current, [name]: value }));
  }

  function openCustomerForm() {
    setFormErrors([]);
    setCustomerForm(createCustomerForm());
    setSelectedCustomerId('');
    setSelectedCustomer(null);
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
    setSelectedWorkerId('');
    setSelectedWorker(null);
    setShowWorkerForm(true);
  }

  function closeWorkerForm() {
    setWorkerErrors([]);
    setWorkerForm(createWorkerForm());
    setShowWorkerForm(false);
  }

  async function handleAddCustomer(event) {
    event.preventDefault();
    setFormErrors([]);
    setIsSavingCustomer(true);
    try {
      const payload = new FormData();
      payload.append('name', customerForm.name);
      payload.append('phone', customerForm.phone);
      payload.append('secondary_phone', customerForm.secondaryPhone);
      payload.append('address', customerForm.address);
      payload.append('customer_type', customerForm.customerType);
      payload.append('notes', customerForm.notes);
      if (customerForm.photo) payload.append('photo', customerForm.photo);
      if (customerForm.openingBalanceAmount) {
        payload.append('opening_balance_amount', customerForm.openingBalanceAmount);
        payload.append('opening_balance_type', customerForm.openingBalanceType);
      }
      const created = await createCustomer(payload);
      closeCustomerForm();
      await loadCustomers();
      setSelectedCustomerId(created.id);
    } catch (error) {
      setFormErrors([formatApiError(error, t)]);
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function handleAddWorker(event) {
    event.preventDefault();
    setWorkerErrors([]);
    setIsSavingWorker(true);
    try {
      const payload = new FormData();
      payload.append('name', workerForm.name);
      payload.append('phone', workerForm.phone);
      payload.append('secondary_phone', workerForm.secondaryPhone);
      payload.append('worker_type', workerForm.workerType);
      payload.append('assigned_work', workerForm.assignedWork);
      payload.append('status', workerForm.status);
      payload.append('notes', workerForm.notes);
      if (workerForm.defaultDailyWage) payload.append('default_daily_wage', workerForm.defaultDailyWage);
      if (workerForm.defaultPricePerBag) payload.append('default_price_per_bag', workerForm.defaultPricePerBag);
      if (workerForm.photo) payload.append('photo', workerForm.photo);
      const created = await createWorker(payload);
      closeWorkerForm();
      await loadWorkers();
      setSelectedWorkerId(created.id);
    } catch (error) {
      setWorkerErrors([formatApiError(error, t)]);
    } finally {
      setIsSavingWorker(false);
    }
  }

  function handlePrintStatement() {
    window.print();
  }

  async function handleAddCashTransaction(payload) {
    if (!selectedCustomerId) return;
    setIsSavingCash(true);
    try {
      await createCustomerCashTransaction(selectedCustomerId, payload);
      await Promise.all([loadCustomers(), loadSelectedCustomer(selectedCustomerId)]);
    } finally {
      setIsSavingCash(false);
    }
  }

  async function handleRestoreCustomer() {
    if (!selectedCustomerId) return;
    setApiError('');
    setSuccessMessage('');
    setIsRestoringCustomer(true);
    try {
      const restored = await restoreCustomer(selectedCustomerId);
      setSelectedCustomer(restored);
      await Promise.all([loadCustomers(), loadSelectedCustomer(selectedCustomerId)]);
      setSuccessMessage(t('customers.restoreSuccess'));
    } catch (error) {
      setApiError(formatApiError(error, t));
    } finally {
      setIsRestoringCustomer(false);
    }
  }

  async function handleAddPayment(payload) {
    if (!selectedCustomerId) return;
    setIsSavingPayment(true);
    try {
      await createCustomerPayment(selectedCustomerId, payload);
      await Promise.all([loadCustomers(), loadSelectedCustomer(selectedCustomerId)]);
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleAddCommodityTransaction(payload) {
    if (!selectedCustomerId) return;
    setIsSavingCommodity(true);
    try {
      await createCustomerCommodityTransaction(selectedCustomerId, payload);
      await Promise.all([loadCustomers(), loadSelectedCustomer(selectedCustomerId)]);
    } finally {
      setIsSavingCommodity(false);
    }
  }

  async function handleLoadStatement() {
    if (!selectedCustomerId) return;
    try {
      setStatement(await getCustomerStatement(selectedCustomerId));
    } catch (error) {
      setApiError(formatApiError(error, t));
    }
  }

  async function handleAddWorkerRecord(payload) {
    if (!selectedWorkerId) return;
    setIsSavingWorkRecord(true);
    try {
      await createWorkerWorkRecord(selectedWorkerId, payload);
      await Promise.all([loadWorkers(), loadSelectedWorker(selectedWorkerId)]);
    } finally {
      setIsSavingWorkRecord(false);
    }
  }

  async function handleMarkWorkerPaid(recordId, paymentMethod) {
    setIsMarkingPaid(true);
    try {
      await markWorkerWorkRecordPaid(recordId, paymentMethod);
      await Promise.all([loadWorkers(), loadSelectedWorker(selectedWorkerId)]);
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function handleUpdateWorkerProfile(workerId, payload) {
    if (!workerId) return;
    setApiError('');
    setSuccessMessage('');
    setIsSavingWorkerProfile(true);
    try {
      await updateWorker(workerId, payload);
      await Promise.all([loadWorkers(), loadSelectedWorker(workerId)]);
      setSuccessMessage(t('informationUpdated'));
    } catch (error) {
      throw new Error(error?.message || t('unableToUpdateInformation'));
    } finally {
      setIsSavingWorkerProfile(false);
    }
  }

  async function handleLoadWorkerStatement() {
    if (!selectedWorkerId) return;
    try {
      setWorkerStatement(await getWorkerStatement(selectedWorkerId));
    } catch (error) {
      setApiError(formatApiError(error, t));
    }
  }

  return (
    <div className="page-grid customers-page">
      <div className="customer-module-tabs">
        <Tooltip content={t('tooltips.businessCustomers')}>
          <button
            type="button"
            className={`customer-module-tabs__button ${activeCustomerTab === 'business' ? 'is-active' : ''}`}
            onClick={() => switchCustomerTab('business')}
          >
            {t('customers.businessCustomers')}
          </button>
        </Tooltip>
        <Tooltip content={t('tooltips.companyWorkers')}>
          <button
            type="button"
            className={`customer-module-tabs__button ${activeCustomerTab === 'workers' ? 'is-active' : ''}`}
            onClick={() => switchCustomerTab('workers')}
          >
            {t('customers.companyWorkers')}
          </button>
        </Tooltip>
      </div>

      {activeCustomerTab === 'business' && (
        <>
          <Card title={t('customers.listTitle')} subtitle={t('customers.listSubtitle')}>
            <div className="customer-toolbar">
              <label className="customer-toolbar__search">
                <span>{t('search')}</span>
                <input name="search" value={filters.search} onChange={handleFilterChange} placeholder={t('customers.searchPlaceholder')} />
              </label>
              <label>
                <span>{t('customers.customerType')}</span>
                <select name="customer_type" value={filters.customer_type} onChange={handleFilterChange}>
                  <option value="">{t('customers.allCustomerTypes')}</option>
                  <option value="farmer">{t('customers.types.farmer')}</option>
                  <option value="investor">{t('customers.types.investor')}</option>
                  <option value="consumer">{t('customers.types.consumer')}</option>
                  <option value="exporter">{t('customers.types.exporter')}</option>
                  <option value="factory">{t('customers.types.factory')}</option>
                  <option value="supplier">{t('customers.types.supplier')}</option>
                </select>
              </label>
              <label>
                <span>{t('customers.debtStatus')}</span>
                <select name="cash_status" value={filters.cash_status} onChange={handleFilterChange}>
                  <option value="">{t('customers.allAccountStatuses')}</option>
                  <option value="debtor">{t('status.Debtor')}</option>
                  <option value="creditor">{t('status.Creditor')}</option>
                  <option value="balanced">{t('status.Balanced')}</option>
                </select>
              </label>
              <div className="customer-toolbar__action">
                <Button variant="secondary" onClick={openCustomerForm} ref={addCustomerButtonRef}>{t('customers.addNewCustomer')}</Button>
              </div>
            </div>
            {apiError && (
              <div className="form-error">
                <p>{apiError}</p>
                <Button type="button" variant="secondary" onClick={loadCustomers}>{t('retry')}</Button>
              </div>
            )}
            {successMessage && <div className="form-success" role="status">{successMessage}</div>}
            {isLoadingCustomers ? (
              <p className="muted-text">{t('customers.loadingCustomers')}</p>
            ) : (
              <CustomerList customers={customerList} selectedCustomerId={selectedCustomerId} onSelect={setSelectedCustomerId} emptyMessage={t('customers.noCustomersFound')} />
            )}
          </Card>

          {selectedCustomer && (
            <CustomerProfile
              customer={selectedCustomer}
              cashTransactions={cashTransactions}
              commodityTransactions={commodityTransactions}
              payments={selectedPayments}
              products={products}
              statement={statement}
              isSavingCash={isSavingCash}
              isSavingCommodity={isSavingCommodity}
              isSavingPayment={isSavingPayment}
              isLoadingProfile={isLoadingProfile}
              onAddCashTransaction={handleAddCashTransaction}
              onAddCommodityTransaction={handleAddCommodityTransaction}
              onAddPayment={handleAddPayment}
              onLoadStatement={handleLoadStatement}
              onPrint={handlePrintStatement}
              onRestore={handleRestoreCustomer}
              onClose={() => {
                setSelectedCustomerId('');
                setSelectedCustomer(null);
                setSuccessMessage('');
              }}
              adminName={adminName}
              isAdmin={isAdmin}
              isRestoringCustomer={isRestoringCustomer}
            />
          )}

          <AppWindow
            id="customers-add-customer"
            title={t('customers.formTitle')}
            description={t('customers.formSubtitle')}
            isOpen={showCustomerForm}
            isDirty={customerFormDirty}
            isSubmitting={isSavingCustomer}
            defaultSize="large"
            openerRef={addCustomerButtonRef}
            onClose={closeCustomerForm}
          >
            <CustomerForm form={customerForm} errors={formErrors} onChange={handleChange} onSubmit={handleAddCustomer} onCancel={closeCustomerForm} isSaving={isSavingCustomer} />
          </AppWindow>
        </>
      )}

      {activeCustomerTab === 'workers' && (
        <>
          <Card title={t('customers.workersListTitle')} subtitle={t('customers.workersListSubtitle')}>
            <div className="customer-toolbar">
              <label className="customer-toolbar__search">
                <span>{t('search')}</span>
                <input name="search" value={workerFilters.search} onChange={handleWorkerFilterChange} placeholder={t('customers.workerSearchPlaceholder')} />
              </label>
              <label>
                <span>{t('customers.workerType')}</span>
                <select name="worker_type" value={workerFilters.worker_type} onChange={handleWorkerFilterChange}>
                  <option value="">{t('customers.allWorkerTypes')}</option>
                  <option value="general_worker">{t('customers.workerTypes.general_worker')}</option>
                  <option value="bag_carrying_worker">{t('customers.workerTypes.bag_carrying_worker')}</option>
                  <option value="weighing_worker">{t('customers.workerTypes.weighing_worker')}</option>
                </select>
              </label>
              <label>
                <span>{t('common.status')}</span>
                <select name="status" value={workerFilters.status} onChange={handleWorkerFilterChange}>
                  <option value="">{t('warehouse.allStatuses')}</option>
                  <option value="available">{t('status.Available')}</option>
                  <option value="working">{t('status.Working')}</option>
                  <option value="inactive">{t('status.Inactive')}</option>
                </select>
              </label>
              <div className="customer-toolbar__action">
                <Button variant="secondary" onClick={openWorkerForm} ref={addWorkerButtonRef}>{t('customers.addNewWorker')}</Button>
              </div>
            </div>
            {apiError && (
              <div className="form-error">
                <p>{apiError}</p>
                <Button type="button" variant="secondary" onClick={loadWorkers}>{t('retry')}</Button>
              </div>
            )}
            {successMessage && <div className="form-success" role="status">{successMessage}</div>}
            {isLoadingWorkers ? (
              <p className="muted-text">{t('customers.loadingWorkers')}</p>
            ) : (
              <WorkerList workers={workerList} selectedWorkerId={selectedWorkerId} onSelect={setSelectedWorkerId} emptyMessage={t('customers.noWorkersFound')} />
            )}
          </Card>

          {selectedWorker && (
            <WorkerProfile
              worker={selectedWorker}
              warehouses={warehouseList}
              records={workerRecords}
              statement={workerStatement}
              isSavingRecord={isSavingWorkRecord}
              isMarkingPaid={isMarkingPaid}
              isSavingProfile={isSavingWorkerProfile}
              canEdit={canEditWorkerProfile}
              onUpdateProfile={handleUpdateWorkerProfile}
              onAddRecord={handleAddWorkerRecord}
              onMarkPaid={handleMarkWorkerPaid}
              onLoadStatement={handleLoadWorkerStatement}
              onPrint={handlePrintStatement}
              onClose={() => {
                setSelectedWorkerId('');
                setSelectedWorker(null);
              }}
              adminName={adminName}
            />
          )}

          <AppWindow
            id="customers-add-worker"
            title={t('customers.addWorkerTitle')}
            description={t('customers.addWorkerSubtitle')}
            isOpen={showWorkerForm}
            isDirty={workerFormDirty}
            isSubmitting={isSavingWorker}
            defaultSize="large"
            openerRef={addWorkerButtonRef}
            onClose={closeWorkerForm}
          >
            <WorkerForm form={workerForm} errors={workerErrors} onChange={handleWorkerChange} onSubmit={handleAddWorker} onCancel={closeWorkerForm} isSaving={isSavingWorker} />
          </AppWindow>
        </>
      )}
    </div>
  );
}
