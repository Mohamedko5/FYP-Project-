import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import { reports } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Reports() {
  const { t } = useLanguage();
  const translatedReports = reports.map((report, index) => ({
    id: index + 1,
    title: t(report.titleKey),
    period: t(report.periodKey),
    value: t(report.valueKey),
    note: t(report.noteKey),
  }));

  const columns = [
    { key: 'title', label: t('reports.report') },
    { key: 'period', label: t('common.period') },
    { key: 'value', label: t('common.mainValue') },
    { key: 'note', label: t('reports.description') },
  ];

  return (
    <div className="page-grid">
      <div className="summary-grid summary-grid--three">
        {translatedReports.slice(0, 3).map((report) => (
          <Card key={report.title} className="summary-card">
            <p>{report.title}</p>
            <strong>{report.value}</strong>
            <small>{report.period}</small>
          </Card>
        ))}
      </div>

      <Card title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <Table columns={columns} rows={translatedReports} />
      </Card>

      <Card title={t('reports.sectionsTitle')} subtitle={t('reports.sectionsSubtitle')}>
        <div className="note-grid note-grid--three">
          <div><strong>{t('reports.salesReport')}</strong><p>{t('reports.salesText')}</p></div>
          <div><strong>{t('reports.inventoryReport')}</strong><p>{t('reports.inventoryText')}</p></div>
          <div><strong>{t('reports.financialSummary')}</strong><p>{t('reports.financialText')}</p></div>
          <div><strong>{t('reports.customerDebtReport')}</strong><p>{t('reports.customerDebtText')}</p></div>
          <div><strong>{t('reports.warehouseReport')}</strong><p>{t('reports.warehouseText')}</p></div>
          <div><strong>{t('reports.dailyJournalReport')}</strong><p>{t('reports.dailyJournalText')}</p></div>
        </div>
      </Card>
    </div>
  );
}
