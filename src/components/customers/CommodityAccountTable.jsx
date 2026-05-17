import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { productLabel, unitLabel } from './customerHelpers.js';

export default function CommodityAccountTable({ transactions }) {
  const { t, isArabic } = useLanguage();

  const transactionLabel = {
    'Product Received': t('customers.productReceived'),
    'Product Delivered': t('customers.productDelivered'),
    'Product Stored': t('customers.productStored'),
    'Warehouse Withdrawal': t('customers.productWithdrawn'),
  };

  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'transactionType', label: t('common.type'), render: (row) => transactionLabel[row.transactionType] || row.transactionType },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product, isArabic) },
    { key: 'quantity', label: t('common.quantity'), render: (row) => Number(row.quantity).toLocaleString() },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit, isArabic) },
    { key: 'warehouseName', label: t('customers.warehouseName') },
    { key: 'lahuWaAlayh', label: t('journal.lahuAlayh'), render: (row) => <StatusBadge status={row.lahuWaAlayh} /> },
    { key: 'source', label: t('customers.linkedRecord') },
    { key: 'description', label: t('common.description') },
  ];

  return <Table columns={columns} rows={transactions} />;
}
