import { useMemo, useState } from 'react';
import Card from '../components/ui/Card.jsx';
import CustomerForm from '../components/customers/CustomerForm.jsx';
import CustomerList from '../components/customers/CustomerList.jsx';
import CustomerProfile from '../components/customers/CustomerProfile.jsx';
import {
  customerCashTransactions,
  customerCommodityTransactions,
  customers,
  orders,
  paymentHistory,
} from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function createCustomerForm() {
  return {
    name: '',
    phone: '',
    address: '',
    customerType: 'Farmer',
    notes: '',
  };
}

export default function Customers() {
  const { t } = useLanguage();
  const [customerList, setCustomerList] = useState(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [customerForm, setCustomerForm] = useState(createCustomerForm());
  const [formErrors, setFormErrors] = useState([]);

  const selectedCustomer = useMemo(
    () => customerList.find((customer) => String(customer.id) === String(selectedCustomerId)),
    [customerList, selectedCustomerId]
  );

  const selectedCashTransactions = customerCashTransactions.filter(
    (transaction) => transaction.customer === selectedCustomer?.name
  );

  const selectedCommodityTransactions = customerCommodityTransactions.filter(
    (transaction) => transaction.customer === selectedCustomer?.name
  );

  const selectedOrders = orders.filter((order) => order.customer === selectedCustomer?.name);
  const selectedPayments = paymentHistory.filter((payment) => payment.customer === selectedCustomer?.name);

  function handleChange(event) {
    const { name, value } = event.target;
    setCustomerForm((current) => ({ ...current, [name]: value }));
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
      cashAccount: 0,
      commodityAccount: 'None',
      commodityBalance: 'None',
      debtBalance: 0,
      paidAmount: 0,
      remainingBalance: 0,
      status: 'Balanced',
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      notes: customerForm.notes || t('warehouse.noNotes'),
    };

    setCustomerList((current) => [...current, newCustomer]);
    setSelectedCustomerId(newCustomer.id);
    setCustomerForm(createCustomerForm());
    setFormErrors([]);
  }

  function handlePrintStatement() {
    window.print();
  }

  return (
    <div className="page-grid customers-page">
      <Card title={t('customers.listTitle')} subtitle={t('customers.listSubtitle')}>
        <CustomerList
          customers={customerList}
          selectedCustomerId={selectedCustomerId}
          onSelect={setSelectedCustomerId}
        />
      </Card>

      <div className="two-column customers-top-section">
        <Card title={t('customers.formTitle')} subtitle={t('customers.formSubtitle')}>
          <CustomerForm
            form={customerForm}
            errors={formErrors}
            onChange={handleChange}
            onSubmit={handleAddCustomer}
          />
        </Card>

        <Card title={t('customers.accountLogicTitle')} subtitle={t('customers.accountLogicSubtitle')}>
          <div className="customer-ledger-notes">
            <p><strong>{t('status.Lahu') || 'Lahu'}:</strong> {t('customers.lahuMeaning')}</p>
            <p><strong>{t('status.Alayh') || 'Alayh'}:</strong> {t('customers.alayhMeaning')}</p>
            <p>{t('customers.integrationNote')}</p>
          </div>
        </Card>
      </div>

      <CustomerProfile
        customer={selectedCustomer}
        cashTransactions={selectedCashTransactions}
        commodityTransactions={selectedCommodityTransactions}
        orders={selectedOrders}
        payments={selectedPayments}
        onPrint={handlePrintStatement}
      />
    </div>
  );
}
