import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { customerTypeLabel, productLabel, unitLabel } from './customerHelpers.js';

function commoditySummary(customer, isArabic) {
  const balances = customer.commodityBalances || customer.commodity_balances || [];
  const positive = balances.filter((row) => Number(row.quantity) > 0);
  if (positive.length === 0) return '-';
  return positive.map((row) => `${productLabel(row.product_name, isArabic)} ${Number(row.quantity).toLocaleString()} ${unitLabel(row.unit, isArabic)}`).join(', ');
}

export default function CustomerList({ customers, selectedCustomerId, onSelect, emptyMessage }) {
  const { t, isArabic } = useLanguage();

  function avatarContent(customer) {
    if (customer.photoUrl || customer.photo_url) return <img src={customer.photoUrl || customer.photo_url} alt={customer.name} />;
    return <span>{customer.name.slice(0, 1).toUpperCase()}</span>;
  }

  const columns = [
    {
      key: 'avatar',
      label: t('customers.photo'),
      render: (row) => <div className="customer-avatar customer-avatar--small">{avatarContent(row)}</div>,
    },
    { key: 'code', label: t('customers.customerCode') },
    { key: 'name', label: t('common.customerName') },
    { key: 'phone', label: t('common.phone') },
    {
      key: 'customerType',
      label: t('customers.customerType'),
      render: (row) => <span className="status-badge status-badge--neutral">{customerTypeLabel(row.customerType, isArabic)}</span>,
    },
    { key: 'cashBalance', label: t('customers.cashBalance'), render: (row) => formatCurrency(Math.abs(Number(row.cashBalance ?? row.cash_balance ?? 0))) },
    { key: 'cashStatus', label: t('customers.debtStatus'), render: (row) => <StatusBadge status={row.cashStatus || row.cash_status || 'Balanced'} /> },
    { key: 'commodityBalance', label: t('customers.commodityBalance'), render: (row) => commoditySummary(row, isArabic) },
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

  return <Table columns={columns} rows={customers} emptyMessage={emptyMessage} />;
}
