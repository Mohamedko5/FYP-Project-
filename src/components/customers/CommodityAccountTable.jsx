import Table from '../ui/Table.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { productLabel, unitLabel } from './customerHelpers.js';

export default function CommodityAccountTable({ transactions, emptyMessage }) {
  const { t, isArabic } = useLanguage();

  const transactionLabel = {
    product_received: t('customers.productReceived'),
    product_delivered: t('customers.productDelivered'),
    product_stored: t('customers.productStored'),
    warehouse_withdrawal: t('customers.productWithdrawn'),
  };

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time'), render: (row) => row.time || '-' },
    { key: 'transactionType', label: t('common.type'), render: (row) => transactionLabel[row.transactionType || row.transaction_type] || row.transactionType || row.transaction_type },
    { key: 'customer', label: t('common.customerName'), render: (row) => row.customer || row.customer_name },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product || row.product_detail?.name_en, isArabic) },
    { key: 'quantity', label: t('common.quantity'), render: (row) => Number(row.quantity).toLocaleString() },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit, isArabic) },
    { key: 'warehouseName', label: t('customers.warehouseName'), render: (row) => row.warehouseName || row.warehouse_name || '-' },
    { key: 'source', label: t('customers.linkedRecord'), render: (row) => row.source || row.source_reference || '-' },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} emptyMessage={emptyMessage} />;
}
