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
    invoice_charge: t('customers.invoiceCharge'),
    adjustment_debit: t('customers.adjustmentDebit'),
    adjustment_credit: t('customers.adjustmentCredit'),
  };

  const columns = [
    { key: 'reference_number', label: t('customers.paymentReference'), render: (row) => row.reference_number || row.source_reference || '-' },
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'type', label: t('common.type'), render: (row) => typeLabel[row.type || row.transaction_type] || row.type || row.transaction_type },
    { key: 'payment_purpose', label: t('customers.paymentPurpose'), render: (row) => row.payment_purpose ? t(`customers.paymentPurposes.${row.payment_purpose}`) : '-' },
    { key: 'customer', label: t('common.customerName'), render: (row) => row.customer || row.customer_name },
    { key: 'payment_method', label: t('customers.paymentMethod'), render: (row) => row.payment_method ? t(`customers.paymentMethods.${row.payment_method}`) : '-' },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'invoice_number', label: t('common.invoiceNumber'), render: (row) => row.invoice_number || '-' },
    { key: 'source', label: t('customers.linkedJournalTransaction'), render: (row) => row.linked_journal_reference || row.source || row.source_reference || '-' },
    { key: 'administrator_name', label: t('customers.administrator'), render: (row) => row.administrator_name || '-' },
    { key: 'is_reversed', label: t('common.status'), render: (row) => row.is_reversed ? t('customers.paymentReversed') : t('customers.paymentActive') },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} emptyMessage={emptyMessage} />;
}
