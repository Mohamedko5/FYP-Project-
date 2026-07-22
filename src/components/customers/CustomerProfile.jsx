import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import AppWindow from '../ui/AppWindow.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getInvoices } from '../../services/invoicesApi.js';
import { getOrders } from '../../services/ordersApi.js';
import CashAccountTable from './CashAccountTable.jsx';
import CommodityAccountTable from './CommodityAccountTable.jsx';
import CustomerCashTransactionForm from './CustomerCashTransactionForm.jsx';
import CustomerCommodityTransactionForm from './CustomerCommodityTransactionForm.jsx';
import CustomerPaymentForm from './CustomerPaymentForm.jsx';
import CustomerStatement from './CustomerStatement.jsx';
import { customerTypeLabel, productLabel, unitLabel } from './customerHelpers.js';

function createCashForm(customerName = '') {
  return {
    type: 'payment_received',
    paymentMethod: 'cash',
    customer: customerName,
    amount: '',
    description: '',
  };
}

function createPaymentForm() {
  return {
    amount: '',
    paymentMethod: 'cash',
    paymentPurpose: 'previous_balance',
    invoiceId: '',
    description: '',
    idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
}

function createCommodityForm(customerName = '', products = []) {
  const firstProduct = products[0];
  return {
    transactionType: 'product_received',
    productId: firstProduct?.id || '',
    quantity: '',
    unit: firstProduct?.units?.[0]?.value || '',
    customer: customerName,
    estimatedValue: '',
    description: '',
  };
}

function commoditySummary(customer, isArabic) {
  const balances = customer.commodityBalances || customer.commodity_balances || [];
  const positive = balances.filter((row) => Number(row.quantity) > 0);
  if (positive.length === 0) return '-';
  return positive.map((row) => `${productLabel(row.product_name, isArabic)} ${Number(row.quantity).toLocaleString()} ${unitLabel(row.unit, isArabic)}`).join(', ');
}

export default function CustomerProfile({
  customer,
  cashTransactions,
  commodityTransactions,
  payments,
  products,
  statement,
  isSavingCash,
  isSavingCommodity,
  isSavingPayment,
  isLoadingProfile,
  onAddCashTransaction,
  onAddCommodityTransaction,
  onAddPayment,
  onLoadStatement,
  onPrint,
  onClose,
  adminName,
}) {
  const { t, isArabic } = useLanguage();
  const [activeSection, setActiveSection] = useState('');
  const [cashForm, setCashForm] = useState(createCashForm(customer?.name));
  const [paymentForm, setPaymentForm] = useState(createPaymentForm());
  const [commodityForm, setCommodityForm] = useState(createCommodityForm(customer?.name, products));
  const [cashErrors, setCashErrors] = useState([]);
  const [paymentErrors, setPaymentErrors] = useState([]);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [commodityErrors, setCommodityErrors] = useState([]);
  const [orderRows, setOrderRows] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState('');
  const activeSectionButtonRef = useRef(null);

  useEffect(() => {
    if (!customer) return;
    setActiveSection('');
    setCashForm(createCashForm(customer.name));
    setPaymentForm(createPaymentForm());
    setCommodityForm(createCommodityForm(customer.name, products));
    setCashErrors([]);
    setPaymentErrors([]);
    setPaymentMessage('');
    setCommodityErrors([]);
  }, [customer?.id, products]);

  if (!customer) return null;

  const paymentColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'payment_method', label: t('customers.paymentMethod'), render: (row) => row.payment_method ? t(`customers.paymentMethods.${row.payment_method}`) : '-' },
    { key: 'description', label: t('common.description') },
  ];
  const avatar = customer.photoUrl || customer.photo_url
    ? <img src={customer.photoUrl || customer.photo_url} alt={customer.name} />
    : <span>{customer.name.slice(0, 1).toUpperCase()}</span>;
  const profileSections = [
    { key: 'payment', label: t('customers.addPayment'), tooltip: t('tooltips.addCustomerPayment') },
    { key: 'cash', label: t('customers.addCashTransaction'), tooltip: t('tooltips.addCashTransaction') },
    { key: 'commodity', label: t('customers.addCommodityTransaction'), tooltip: t('tooltips.addCommodityTransaction') },
    { key: 'orders', label: t('customers.viewOrders'), tooltip: t('tooltips.viewOrders') },
    { key: 'payments', label: t('customers.viewPaymentHistory'), tooltip: t('tooltips.viewPayments') },
    { key: 'statement', label: t('customers.printStatement'), tooltip: t('tooltips.printPdf') },
  ];
  const formWindowTitles = {
    payment: t('customers.addPayment'),
    cash: t('customers.addCashTransaction'),
    commodity: t('customers.addCommodityTransaction'),
  };
  const formWindowDescriptions = {
    payment: t('customers.customerPaymentSubtitle'),
    cash: t('customers.cashAccountSubtitle'),
    commodity: t('customers.commodityAccountSubtitle'),
  };
  const isFormSection = ['payment', 'cash', 'commodity'].includes(activeSection);
  const paymentDirty = activeSection === 'payment' && JSON.stringify({ ...paymentForm, idempotencyKey: '' }) !== JSON.stringify({ ...createPaymentForm(), idempotencyKey: '' });
  const cashDirty = activeSection === 'cash' && JSON.stringify(cashForm) !== JSON.stringify(createCashForm(customer.name));
  const commodityDirty = activeSection === 'commodity' && JSON.stringify(commodityForm) !== JSON.stringify(createCommodityForm(customer.name, products));

  function openSection(section) {
    setActiveSection(section);
    setCashErrors([]);
    setPaymentErrors([]);
    setPaymentMessage('');
    setCommodityErrors([]);
    if (section === 'cash') setCashForm(createCashForm(customer.name));
    if (section === 'payment') {
      setPaymentForm(createPaymentForm());
      loadUnpaidInvoices();
    }
    if (section === 'commodity') setCommodityForm(createCommodityForm(customer.name, products));
    if (section === 'orders') loadCustomerOrders();
    if (section === 'statement') onLoadStatement?.();
  }

  async function loadUnpaidInvoices() {
    setIsLoadingInvoices(true);
    try {
      const response = await getInvoices({ customer: customer.id, payment_status: 'unpaid', status: 'issued', page_size: 100 });
      setUnpaidInvoices(Array.isArray(response) ? response : response.results || []);
    } catch {
      setUnpaidInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  }

  async function loadCustomerOrders() {
    setIsLoadingOrders(true);
    setOrderError('');
    try {
      const response = await getOrders({ customer: customer.id, page_size: 100, ordering: '-created_at' });
      setOrderRows(Array.isArray(response) ? response : response.results || []);
    } catch (error) {
      setOrderError(error.message || t('orders.apiError'));
    } finally {
      setIsLoadingOrders(false);
    }
  }

  function closeSection() {
    setActiveSection('');
    setCashErrors([]);
    setPaymentErrors([]);
    setCommodityErrors([]);
  }

  function handleCashChange(event) {
    const { name, value } = event.target;
    setCashForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'type' && value === 'payment_owed') next.paymentMethod = '';
      if (name === 'type' && value !== 'payment_owed' && !next.paymentMethod) next.paymentMethod = 'cash';
      return next;
    });
  }

  function handlePaymentChange(event) {
    const { name, value } = event.target;
    setPaymentForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'paymentPurpose' && value !== 'invoice_payment') {
        next.invoiceId = '';
        if (current.paymentPurpose === 'invoice_payment') next.amount = '';
      }
      if (name === 'invoiceId') {
        const invoice = unpaidInvoices.find((row) => String(row.id) === String(value));
        next.amount = invoice ? String(invoice.outstanding_amount || invoice.total_amount || '') : '';
      }
      return next;
    });
  }

  function handleCommodityChange(event) {
    const { name, value } = event.target;
    setCommodityForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCashSubmit(event) {
    event.preventDefault();
    setCashErrors([]);
    try {
      await onAddCashTransaction({
        transaction_type: cashForm.type,
        payment_method: cashForm.type === 'payment_owed' ? '' : cashForm.paymentMethod,
        amount: cashForm.amount,
        description: cashForm.description,
      });
      setCashForm(createCashForm(customer.name));
      closeSection();
    } catch (error) {
      setCashErrors(String(error.message || error).split('\n'));
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    setPaymentErrors([]);
    setPaymentMessage('');
    try {
      await onAddPayment({
        amount: paymentForm.amount,
        payment_method: paymentForm.paymentMethod,
        payment_purpose: paymentForm.paymentPurpose,
        invoice_id: paymentForm.invoiceId || null,
        description: paymentForm.description,
        idempotency_key: paymentForm.idempotencyKey,
      });
      setPaymentForm(createPaymentForm());
      closeSection();
    } catch (error) {
      setPaymentErrors(String(error.message || error).split('\n'));
    }
  }

  async function handleCommoditySubmit(event) {
    event.preventDefault();
    setCommodityErrors([]);
    try {
      await onAddCommodityTransaction({
        transaction_type: commodityForm.transactionType,
        product_id: commodityForm.productId,
        quantity: commodityForm.quantity,
        unit: commodityForm.unit,
        estimated_value: commodityForm.estimatedValue || null,
        description: commodityForm.description,
      });
      setCommodityForm(createCommodityForm(customer.name, products));
      closeSection();
    } catch (error) {
      setCommodityErrors(String(error.message || error).split('\n'));
    }
  }

  function renderActiveSection() {
    if (activeSection === 'payment') {
      return (
        <Card title={t('customers.addPayment')} subtitle={t('customers.customerPaymentSubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          {paymentMessage && <div className="form-success">{paymentMessage}</div>}
          <CustomerPaymentForm
            form={paymentForm}
            errors={paymentErrors}
            customer={customer}
            unpaidInvoices={unpaidInvoices}
            isLoadingInvoices={isLoadingInvoices}
            onChange={handlePaymentChange}
            onSubmit={handlePaymentSubmit}
            onCancel={closeSection}
            isSaving={isSavingPayment}
            t={t}
          />
          <CashAccountTable transactions={cashTransactions} emptyMessage={t('customers.noCashTransactions')} />
        </Card>
      );
    }

    if (activeSection === 'cash') {
      return (
        <Card title={t('customers.addCashTransaction')} subtitle={t('customers.cashAccountSubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <CustomerCashTransactionForm
            form={cashForm}
            errors={cashErrors}
            customerName={customer.name}
            onChange={handleCashChange}
            onSubmit={handleCashSubmit}
            onCancel={closeSection}
            isSaving={isSavingCash}
            t={t}
          />
          <CashAccountTable transactions={cashTransactions} emptyMessage={t('customers.noCashTransactions')} />
        </Card>
      );
    }

    if (activeSection === 'commodity') {
      return (
        <Card title={t('customers.addCommodityTransaction')} subtitle={t('customers.commodityAccountSubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <CustomerCommodityTransactionForm
            form={commodityForm}
            errors={commodityErrors}
            customerName={customer.name}
            products={products}
            units={[]}
            isArabic={isArabic}
            onChange={handleCommodityChange}
            onSubmit={handleCommoditySubmit}
            onCancel={closeSection}
            isSaving={isSavingCommodity}
            t={t}
          />
          <CommodityAccountTable transactions={commodityTransactions} emptyMessage={t('customers.noCommodityTransactions')} />
        </Card>
      );
    }

    if (activeSection === 'orders') {
      return (
        <Card title={t('customers.orderHistory')} subtitle={t('customers.orderHistorySubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          {orderError && (
            <div className="form-error">
              <p>{orderError}</p>
              <Button variant="secondary" onClick={loadCustomerOrders}>{t('retry')}</Button>
            </div>
          )}
          {isLoadingOrders ? (
            <p className="muted-text">{t('orders.loading')}</p>
          ) : (
            <Table
              columns={[
                { key: 'order_number', label: t('orders.orderNumber') },
                { key: 'product_summary', label: t('orders.productSummary') },
                { key: 'item_count', label: t('orders.itemCount') },
                { key: 'total_amount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.total_amount) },
                { key: 'created_date', label: t('common.date') },
                { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={t(`orders.statusLabels.${row.status}`)} /> },
              ]}
              rows={orderRows}
              emptyMessage={t('orders.noOrders')}
            />
          )}
        </Card>
      );
    }

    if (activeSection === 'payments') {
      return (
        <Card title={t('customers.paymentHistory')} subtitle={t('customers.paymentSubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <Table columns={paymentColumns} rows={payments} emptyMessage={t('customers.noPaymentHistory')} />
        </Card>
      );
    }

    if (activeSection === 'statement') {
      return (
        <Card title={t('customers.customerStatement')} subtitle={t('customers.balanceSummary')}>
          <div className="customer-section-header">
            <Button onClick={onPrint}>{t('customers.printStatement')}</Button>
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <CustomerStatement
            customer={customer}
            cashTransactions={cashTransactions}
            commodityTransactions={commodityTransactions}
            statement={statement}
            visible
            adminName={adminName}
          />
        </Card>
      );
    }

    return null;
  }

  return (
    <>
      <Card title={t('customers.profileTitle')} subtitle={isLoadingProfile ? t('customers.loadingProfile') : t('customers.profileSubtitle')}>
        <div className="customer-profile-header">
          <div className="customer-profile-identity">
            <div className="customer-avatar customer-avatar--large">{avatar}</div>
            <div>
              <h3>{customer.name}</h3>
              <p>{customer.code}</p>
              <p>{customer.phone}</p>
              <p>{customer.address}</p>
            </div>
          </div>
          <div className="customer-profile-header__actions">
            <Button variant="secondary" onClick={onClose}>{t('customers.closeProfile')}</Button>
          </div>
        </div>

        <div className="detail-panel customer-profile-summary">
          <div>
            <span>{t('customers.customerType')}</span>
            <strong>{customerTypeLabel(customer.customer_type || customer.customerType, isArabic)}</strong>
          </div>
          <div>
            <span>{t('customers.cashBalance')}</span>
            <strong>{formatCurrency(Math.abs(Number(customer.cash_balance || 0)))}</strong>
          </div>
          <div>
            <span>{t('customers.debtStatus')}</span>
            <StatusBadge status={customer.cash_status || 'Balanced'} />
          </div>
          <div>
            <span>{t('customers.commodityBalance')}</span>
            <strong>{commoditySummary(customer, isArabic)}</strong>
          </div>
          <div>
            <span>{t('customers.totalDebits')}</span>
            <strong>{formatCurrency(customer.total_debits || 0)}</strong>
          </div>
          <div>
            <span>{t('customers.totalCredits')}</span>
            <strong>{formatCurrency(customer.total_credits || 0)}</strong>
          </div>
        </div>

        <p className="customer-notes">{customer.notes || t('warehouse.noNotes')}</p>

        <div className="note-grid customer-profile-history">
          <div>
            <strong>{t('customers.paymentHistory')}</strong>
            <p>{payments.length > 0 ? `${payments.length} ${t('customers.paymentRecords')}` : t('customers.noPaymentHistory')}</p>
          </div>
          <div>
            <strong>{t('customers.orderHistory')}</strong>
            <p>{orderRows.length > 0 ? `${orderRows.length} ${t('orders.totalOrders')}` : t('orders.noOrders')}</p>
          </div>
        </div>

        <div className="customer-profile-tabs">
          {profileSections.map((section) => (
            <Tooltip key={section.key} content={section.tooltip}>
              <button
                type="button"
                className={`customer-profile-tabs__button ${activeSection === section.key ? 'is-active' : ''}`}
                onClick={() => openSection(section.key)}
                ref={['payment', 'cash', 'commodity'].includes(section.key) ? activeSectionButtonRef : undefined}
              >
                {section.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </Card>

      {isFormSection ? (
        <AppWindow
          id={`customer-profile-${activeSection}`}
          title={formWindowTitles[activeSection]}
          description={formWindowDescriptions[activeSection]}
          isOpen={isFormSection}
          isDirty={paymentDirty || cashDirty || commodityDirty}
          isSubmitting={isSavingPayment || isSavingCash || isSavingCommodity}
          defaultSize="large"
          openerRef={activeSectionButtonRef}
          onClose={closeSection}
        >
          {renderActiveSection()}
        </AppWindow>
      ) : (
        renderActiveSection()
      )}

      <CustomerStatement
        customer={customer}
        cashTransactions={cashTransactions}
        commodityTransactions={commodityTransactions}
        statement={statement}
        adminName={adminName}
      />
    </>
  );
}
