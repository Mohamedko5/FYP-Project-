import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel } from './customerHelpers.js';

export default function CustomerList({ customers, selectedCustomerId, onSelect }) {
  const { t, isArabic } = useLanguage();

  function avatarContent(customer) {
    if (customer.photoUrl) return <img src={customer.photoUrl} alt={customer.name} />;
    return <span>{customer.name.slice(0, 1).toUpperCase()}</span>;
  }

  const columns = [
    {
      key: 'avatar',
      label: t('customers.photo'),
      render: (row) => <div className="customer-avatar customer-avatar--small">{avatarContent(row)}</div>,
    },
    { key: 'name', label: t('common.customerName') },
    { key: 'phone', label: t('common.phone') },
    {
      key: 'customerType',
      label: t('customers.customerType'),
      render: (row) => <span className="status-badge status-badge--neutral">{customerTypeLabel(row.customerType, isArabic)}</span>,
    },
    { key: 'cashAccount', label: t('customers.cashBalance'), render: (row) => formatCurrency(Math.abs(row.cashAccount)) },
    { key: 'commodityBalance', label: t('customers.commodityBalance') },
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
