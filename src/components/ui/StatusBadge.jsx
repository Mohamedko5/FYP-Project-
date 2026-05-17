import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function StatusBadge({ status }) {
  const { statusLabel } = useLanguage();
  const className = status.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');
  return <span className={`status-badge status-badge--${className}`}>{statusLabel(status)}</span>;
}
