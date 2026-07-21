import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Tooltip from './Tooltip.jsx';

export default function StatusBadge({ status }) {
  const { statusLabel, t } = useLanguage();
  const safeStatus = status == null || status === '' ? 'Unknown' : String(status);
  const className = safeStatus.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');
  const label = statusLabel(safeStatus);

  return (
    <Tooltip content={`${t('tooltips.statusBadge')}: ${label}`} className="tooltip--inline-flex">
      <span className={`status-badge status-badge--${className}`}>{label}</span>
    </Tooltip>
  );
}
