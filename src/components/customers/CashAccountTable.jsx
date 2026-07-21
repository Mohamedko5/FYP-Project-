import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CashAccountTable({ transactions, emptyMessage }) {
  const { t } = useLanguage();

  const typeLabel = {
    payment_received: t('customers.paymentReceived'),
    payment_owed: t('customers.paymentOwed'),
    customer_expense: t('customers.customerExpense'),
    opening_debt: t('customers.customerOwesCompany'),
    opening_credit: t('customers.companyOwesCustomer'),
  };

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'type', label: t('common.type'), render: (row) => typeLabel[row.type || row.transaction_type] || row.type || row.transaction_type },
    { key: 'customer', label: t('common.customerName'), render: (row) => row.customer || row.customer_name },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'source', label: t('customers.linkedRecord'), render: (row) => row.source || row.source_reference || '-' },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} emptyMessage={emptyMessage} />;
}
