import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';

export default function CashJournalTable({ entries, openingBalanceEntryId, onEdit, onDelete, t, emptyMessage }) {
  const columns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    {
      key: 'type',
      label: t('common.type'),
      render: (row) => (
        row.id === openingBalanceEntryId
          ? <span className="status-badge">{t('journal.openingBalance')}</span>
          : <StatusBadge status={row.type} />
      ),
    },
    { key: 'party', label: t('common.customerSupplier') },
    {
      key: 'amount',
      label: t('common.amount'),
      render: (row) => (
        <span>{formatCurrency(row.amount)}</span>
      ),
    },
    { key: 'description', label: t('common.description') },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-actions">
          <Button variant="secondary" onClick={() => onEdit(row)}>{t('edit')}</Button>
          <Button variant="secondary" onClick={() => onDelete(row.id)}>{t('delete')}</Button>
        </div>
      ),
    },
  ];

  return <Table columns={columns} rows={entries} emptyMessage={emptyMessage} />;
}
