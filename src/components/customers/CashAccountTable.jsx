import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CashAccountTable({ transactions }) {
  const { t } = useLanguage();

  const typeLabel = {
    'Payment Received': t('customers.paymentReceived'),
    'Payment Owed': t('customers.paymentOwed'),
    'Customer Expense': t('customers.customerExpense'),
  };

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'type', label: t('common.type'), render: (row) => typeLabel[row.type] || row.type },
    { key: 'customer', label: t('common.customerName') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'source', label: t('customers.linkedRecord') },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} />;
}
