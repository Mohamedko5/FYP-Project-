import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';

export default function JournalTable({ entries, onEdit, t }) {
  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={row.type} /> },
    { key: 'category', label: t('common.category') },
    { key: 'party', label: t('common.customerSupplier') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'source_type', label: t('journal.source'), render: (row) => row.source_type === 'customer' ? t('customers.customerPayment') : row.source_type || '-' },
    { key: 'source_reference', label: t('customers.paymentReference'), render: (row) => row.source_reference || '-' },
    { key: 'description', label: t('common.description') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => row.is_system_generated ? (
        <span className="muted-text">{t('customers.readOnly')}</span>
      ) : (
        <Button variant="secondary" onClick={() => onEdit(row)}>
          {t('edit')}
        </Button>
      ),
    },
  ];

  return <Table columns={columns} rows={entries} />;
}
