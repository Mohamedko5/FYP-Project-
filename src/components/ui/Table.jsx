import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function Table({ columns = [], rows = [], emptyMessage = 'No records found.', caption }) {
  const { t } = useLanguage();
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  return (
    <div className="table-wrap">
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {safeColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.length === 0 ? (
            <tr>
              <td colSpan={safeColumns.length || 1} className="table-empty">
                {emptyMessage === 'No records found.' ? t('emptyMessage') : emptyMessage}
              </td>
            </tr>
          ) : (
            safeRows.map((row, rowIndex) => (
              <tr key={row.id ?? row.code ?? row.number ?? rowIndex}>
                {safeColumns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
