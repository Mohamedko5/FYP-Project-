import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import CashAccountTable from './CashAccountTable.jsx';
import CommodityAccountTable from './CommodityAccountTable.jsx';
import CustomerCashTransactionForm from './CustomerCashTransactionForm.jsx';
import CustomerCommodityTransactionForm from './CustomerCommodityTransactionForm.jsx';
import CustomerStatement from './CustomerStatement.jsx';
import { customerTypeLabel } from './customerHelpers.js';

const today = new Date().toISOString().slice(0, 10);
const currentTime = () => new Date().toTimeString().slice(0, 5);

function createCashForm(customerName = '') {
  return {
    date: today,
    time: currentTime(),
    type: 'Payment Received',
    customer: customerName,
    amount: '',
    description: '',
  };
}

function createCommodityForm(customerName = '', product = 'White Sesame') {
  return {
    date: today,
    time: currentTime(),
    transactionType: 'Product Received',
    product,
    quantity: '',
    unit: 'Qintar',
    customer: customerName,
    description: '',
  };
}

export default function CustomerProfile({
  customer,
  cashTransactions,
  commodityTransactions,
  orders,
  payments,
  products,
  units,
  onAddCashTransaction,
  onAddCommodityTransaction,
  onPrint,
  onClose,
}) {
  const { t, isArabic } = useLanguage();
  const [activeSection, setActiveSection] = useState('');
  const [cashForm, setCashForm] = useState(createCashForm(customer?.name));
  const [commodityForm, setCommodityForm] = useState(createCommodityForm(customer?.name, products?.[0]?.name));
  const [cashErrors, setCashErrors] = useState([]);
  const [commodityErrors, setCommodityErrors] = useState([]);

  useEffect(() => {
    if (!customer) return;
    setActiveSection('');
    setCashForm(createCashForm(customer.name));
    setCommodityForm(createCommodityForm(customer.name, products?.[0]?.name));
    setCashErrors([]);
    setCommodityErrors([]);
  }, [customer?.id, products]);

  if (!customer) return null;

  const orderColumns = [
    { key: 'orderNo', label: t('common.orderNo') },
    { key: 'product', label: t('common.product') },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.totalAmount) },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  const paymentColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'method', label: t('common.method') },
    { key: 'note', label: t('common.note') },
  ];
  const avatar = customer.photoUrl
    ? <img src={customer.photoUrl} alt={customer.name} />
    : <span>{customer.name.slice(0, 1).toUpperCase()}</span>;
  const profileSections = [
    { key: 'cash', label: t('customers.addCashTransaction'), tooltip: t('tooltips.addCashTransaction') },
    { key: 'commodity', label: t('customers.addCommodityTransaction'), tooltip: t('tooltips.addCommodityTransaction') },
    { key: 'orders', label: t('customers.viewOrders'), tooltip: t('tooltips.viewOrders') },
    { key: 'payments', label: t('customers.viewPaymentHistory'), tooltip: t('tooltips.viewPayments') },
    { key: 'statement', label: t('customers.printStatement'), tooltip: t('tooltips.printPdf') },
  ];

  function openSection(section) {
    setActiveSection(section);
    setCashErrors([]);
    setCommodityErrors([]);
    if (section === 'cash') setCashForm(createCashForm(customer.name));
    if (section === 'commodity') setCommodityForm(createCommodityForm(customer.name, products?.[0]?.name));
  }

  function closeSection() {
    setActiveSection('');
    setCashErrors([]);
    setCommodityErrors([]);
  }

  function handleCashChange(event) {
    const { name, value } = event.target;
    setCashForm((current) => ({ ...current, [name]: value }));
  }

  function handleCommodityChange(event) {
    const { name, value } = event.target;
    setCommodityForm((current) => ({ ...current, [name]: value }));
  }

  function handleCashSubmit(event) {
    event.preventDefault();
    const errors = [];
    const amount = Number(cashForm.amount);

    if (!cashForm.date || !cashForm.time || !cashForm.type || !cashForm.customer || !cashForm.description.trim()) {
      errors.push(t('customers.transactionRequiredFieldsError'));
    }
    if (!cashForm.amount || amount <= 0) errors.push(t('customers.amountPositiveError'));

    if (errors.length > 0) {
      setCashErrors(errors);
      return;
    }

    const paidAmount = cashForm.type === 'Payment Received' ? amount : 0;
    onAddCashTransaction({
      id: Date.now(),
      customer: customer.name,
      date: cashForm.date,
      time: cashForm.time,
      type: cashForm.type,
      amount,
      paidAmount,
      remainingBalance: Math.max(amount - paidAmount, 0),
      lahuWaAlayh: cashForm.type === 'Payment Owed' ? 'Lahu' : 'Balanced',
      source: 'Customer Profile',
      description: cashForm.description,
    });
    setCashForm(createCashForm(customer.name));
    closeSection();
  }

  function handleCommoditySubmit(event) {
    event.preventDefault();
    const errors = [];
    const quantity = Number(commodityForm.quantity);

    if (
      !commodityForm.date ||
      !commodityForm.time ||
      !commodityForm.transactionType ||
      !commodityForm.product ||
      !commodityForm.unit ||
      !commodityForm.customer ||
      !commodityForm.description.trim()
    ) {
      errors.push(t('customers.transactionRequiredFieldsError'));
    }
    if (!commodityForm.quantity || quantity <= 0) errors.push(t('journal.negativeQuantityError'));

    if (errors.length > 0) {
      setCommodityErrors(errors);
      return;
    }

    onAddCommodityTransaction({
      id: Date.now(),
      customer: customer.name,
      date: commodityForm.date,
      time: commodityForm.time,
      transactionType: commodityForm.transactionType,
      product: commodityForm.product,
      quantity,
      unit: commodityForm.unit,
      warehouseName: '-',
      lahuWaAlayh: 'Balanced',
      source: 'Customer Profile',
      description: commodityForm.description,
    });
    setCommodityForm(createCommodityForm(customer.name, products?.[0]?.name));
    closeSection();
  }

  function renderActiveSection() {
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
            t={t}
          />
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
            units={units}
            isArabic={isArabic}
            onChange={handleCommodityChange}
            onSubmit={handleCommoditySubmit}
            onCancel={closeSection}
            t={t}
          />
        </Card>
      );
    }

    if (activeSection === 'orders') {
      return (
        <Card title={t('customers.orderHistory')} subtitle={t('customers.orderHistorySubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <Table columns={orderColumns} rows={orders} />
        </Card>
      );
    }

    if (activeSection === 'payments') {
      return (
        <Card title={t('customers.paymentHistory')} subtitle={t('customers.paymentSubtitle')}>
          <div className="customer-section-header">
            <Button variant="secondary" onClick={closeSection}>{t('customers.closeSection')}</Button>
          </div>
          <Table columns={paymentColumns} rows={payments} />
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
            visible
          />
        </Card>
      );
    }

    return null;
  }

  return (
    <>
      <Card title={t('customers.profileTitle')} subtitle={t('customers.profileSubtitle')}>
        <div className="customer-profile-header">
          <div className="customer-profile-identity">
            <div className="customer-avatar customer-avatar--large">{avatar}</div>
            <div>
              <h3>{customer.name}</h3>
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
            <strong>{customerTypeLabel(customer.customerType, isArabic)}</strong>
          </div>
          <div>
            <span>{t('customers.cashBalance')}</span>
            <strong>{formatCurrency(Math.abs(customer.cashAccount))}</strong>
          </div>
          <div>
            <span>{t('customers.commodityBalance')}</span>
            <strong>{customer.commodityBalance}</strong>
          </div>
          <div>
            <span>{t('customers.debtBalance')}</span>
            <strong>{formatCurrency(customer.debtBalance)}</strong>
          </div>
          <div>
            <span>{t('common.paidAmount')}</span>
            <strong>{formatCurrency(customer.paidAmount)}</strong>
          </div>
          <div>
            <span>{t('common.remainingBalance')}</span>
            <strong>{formatCurrency(customer.remainingBalance)}</strong>
          </div>
        </div>

        <p className="customer-notes">{customer.notes}</p>

        <div className="note-grid customer-profile-history">
          <div>
            <strong>{t('customers.paymentHistory')}</strong>
            <p>{payments.length > 0 ? `${payments.length} ${t('customers.paymentRecords')}` : t('customers.noPaymentHistory')}</p>
          </div>
          <div>
            <strong>{t('customers.orderHistory')}</strong>
            <p>{orders.length > 0 ? `${orders.length} ${t('customers.orderRecords')}` : t('customers.noOrderHistory')}</p>
          </div>
        </div>

        <div className="customer-profile-tabs">
          {profileSections.map((section) => (
            <Tooltip key={section.key} content={section.tooltip}>
              <button
                type="button"
                className={`customer-profile-tabs__button ${activeSection === section.key ? 'is-active' : ''}`}
                onClick={() => openSection(section.key)}
              >
                {section.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </Card>

      {renderActiveSection()}

      <CustomerStatement
        customer={customer}
        cashTransactions={cashTransactions}
        commodityTransactions={commodityTransactions}
      />
    </>
  );
}
