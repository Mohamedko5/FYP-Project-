import StatusBadge from '../ui/StatusBadge.jsx';
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
    { key: 'type', label: t('common.type'), render: (row) => typeLabel[row.type] || row.type },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'paidAmount', label: t('common.paidAmount'), render: (row) => formatCurrency(row.paidAmount) },
    { key: 'remainingBalance', label: t('common.remainingBalance'), render: (row) => formatCurrency(row.remainingBalance) },
    { key: 'lahuWaAlayh', label: t('journal.lahuAlayh'), render: (row) => <StatusBadge status={row.lahuWaAlayh === 'Balanced' ? 'Balanced' : row.lahuWaAlayh} /> },
    { key: 'source', label: t('customers.linkedRecord') },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} />;
}
