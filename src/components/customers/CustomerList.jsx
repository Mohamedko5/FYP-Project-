import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel } from './customerHelpers.js';

export default function CustomerList({ customers, selectedCustomerId, onSelect }) {
  const { t, isArabic } = useLanguage();

  const columns = [
    { key: 'name', label: t('common.customerName') },
    { key: 'phone', label: t('common.phone') },
    { key: 'customerType', label: t('customers.customerType'), render: (row) => customerTypeLabel(row.customerType, isArabic) },
    { key: 'cashAccount', label: t('customers.cashBalance'), render: (row) => formatCurrency(Math.abs(row.cashAccount)) },
    { key: 'commodityBalance', label: t('customers.commodityBalance') },
    { key: 'status', label: t('customers.debtStatus'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'lastTransactionDate', label: t('customers.lastTransactionDate') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <Button variant={row.id === selectedCustomerId ? 'primary' : 'secondary'} onClick={() => onSelect(row.id)}>
          {t('customers.viewProfile')}
        </Button>
      ),
    },
  ];

  return <Table columns={columns} rows={customers} />;
}
