import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { customers, paymentHistory, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Customers() {
  const { t, statusLabel } = useLanguage();
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    cashAccount: '',
    commodityAccount: '',
    debtBalance: '',
    status: 'Debtor',
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setCustomerForm((current) => ({ ...current, [name]: value }));
  }

  const customerColumns = [
    { key: 'name', label: t('common.customer') },
    { key: 'phone', label: t('common.phone') },
    { key: 'cashAccount', label: t('customers.cashAccount'), render: (row) => formatCurrency(Math.abs(row.cashAccount)) },
    { key: 'commodityAccount', label: t('customers.commodityAccount') },
    { key: 'debtBalance', label: t('customers.debtBalance'), render: (row) => formatCurrency(row.debtBalance) },
    { key: 'status', label: t('customers.lahuStatus'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  const paymentColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'customer', label: t('common.customer') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'method', label: t('common.method') },
    { key: 'note', label: t('common.note') },
  ];

  return (
    <div className="page-grid">
      <Card title={t('customers.listTitle')} subtitle={t('customers.listSubtitle')}>
        <Table columns={customerColumns} rows={customers} />
      </Card>

      <div className="two-column">
        <Card title={t('customers.formTitle')} subtitle={t('customers.formSubtitle')}>
          <form className="form-grid form-grid--single">
            <label>
              {t('common.customerName')}
              <input name="name" value={customerForm.name} onChange={handleChange} placeholder={t('customers.namePlaceholder')} />
            </label>
            <label>
              {t('common.phone')}
              <input name="phone" value={customerForm.phone} onChange={handleChange} placeholder="+249..." />
            </label>
            <label>
              {t('customers.cashAccount')}
              <input name="cashAccount" type="number" value={customerForm.cashAccount} onChange={handleChange} placeholder="0" />
            </label>
            <label>
              {t('customers.commodityAccount')}
              <input name="commodityAccount" value={customerForm.commodityAccount} onChange={handleChange} placeholder={t('customers.commodityPlaceholder')} />
            </label>
            <label>
              {t('customers.debtBalance')}
              <input name="debtBalance" type="number" value={customerForm.debtBalance} onChange={handleChange} placeholder="0" />
            </label>
            <label>
              {t('customers.debtorCreditorStatus')}
              <select name="status" value={customerForm.status} onChange={handleChange}>
                <option value="Debtor">{statusLabel('Debtor')}</option>
                <option value="Creditor">{statusLabel('Creditor')}</option>
                <option value="Balanced">{statusLabel('Balanced')}</option>
              </select>
            </label>
            <Button>{t('customers.saveCustomer')}</Button>
          </form>
        </Card>

        <Card title={t('customers.paymentHistory')} subtitle={t('customers.paymentSubtitle')}>
          <Table columns={paymentColumns} rows={paymentHistory} />
        </Card>
      </div>
    </div>
  );
}
