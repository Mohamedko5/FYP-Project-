import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { workerTypeLabel } from './workerHelpers.js';

export default function WorkerList({ workers, selectedWorkerId, onSelect }) {
  const { t, isArabic } = useLanguage();

  function avatarContent(worker) {
    if (worker.photoUrl) return <img src={worker.photoUrl} alt={worker.name} />;
    return <span>{worker.name.slice(0, 1).toUpperCase()}</span>;
  }

  const columns = [
    {
      key: 'avatar',
      label: t('customers.photo'),
      render: (row) => <div className="customer-avatar customer-avatar--small">{avatarContent(row)}</div>,
    },
    { key: 'name', label: t('customers.workerName') },
    { key: 'phone', label: t('common.phone') },
    { key: 'workerType', label: t('customers.workerType'), render: (row) => workerTypeLabel(row.workerType, isArabic) },
    { key: 'assignedWork', label: t('customers.assignedWork') },
    { key: 'notes', label: t('customers.workNotes') },
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

  return <Table columns={columns} rows={workers} />;
}
