import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';

export default function CashJournalTable({ entries, onEdit, t, emptyMessage }) {
  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={row.type} /> },
    { key: 'party', label: t('common.customerSupplier') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'description', label: t('common.description') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-actions">
          <Button variant="secondary" onClick={() => onEdit(row)}>{t('edit')}</Button>
        </div>
      ),
    },
  ];

  return <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />;
}
