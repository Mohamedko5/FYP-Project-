import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel } from './workerHelpers.js';

export default function WorkerList({ workers, selectedWorkerId, onSelect, emptyMessage }) {
  const { t, isArabic } = useLanguage();

  function avatarContent(worker) {
    if (worker.photoUrl || worker.photo_url) return <img src={worker.photoUrl || worker.photo_url} alt={worker.name} />;
    return <span>{worker.name.slice(0, 1).toUpperCase()}</span>;
  }

  const columns = [
    {
      key: 'avatar',
      label: t('customers.photo'),
      render: (row) => <div className="customer-avatar customer-avatar--small">{avatarContent(row)}</div>,
    },
    { key: 'code', label: t('customers.workerCode') },
    { key: 'name', label: t('customers.workerName') },
    { key: 'phone', label: t('common.phone') },
    { key: 'workerType', label: t('customers.workerType'), render: (row) => workerTypeLabel(row.workerType || row.worker_type, isArabic) },
    { key: 'assignedWork', label: t('customers.assignedWork'), render: (row) => row.assignedWork || row.assigned_work },
    { key: 'unpaidWages', label: t('customers.unpaidWages'), render: (row) => formatCurrency(row.unpaid_wage_total || 0) },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={{ available: 'Available', working: 'Working', inactive: 'Inactive' }[row.status] || row.status || 'Available'} /> },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <Button variant={row.id === selectedWorkerId ? 'primary' : 'secondary'} onClick={() => onSelect(row.id)}>
          {t('customers.viewProfile')}
        </Button>
      ),
    },
  ];

  return <Table columns={columns} rows={workers} emptyMessage={emptyMessage} />;
}
