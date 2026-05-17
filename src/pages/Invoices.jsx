import { useState } from 'react';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { invoices, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Invoices() {
  const { t } = useLanguage();
  const [selectedInvoice, setSelectedInvoice] = useState(invoices[0]);

  const columns = [
    { key: 'invoiceNo', label: t('common.invoiceNumber') },
    { key: 'customer', label: t('common.customer') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.totalAmount) },
    { key: 'paidAmount', label: t('common.paidAmount'), render: (row) => formatCurrency(row.paidAmount) },
    { key: 'remaining', label: t('common.remainingBalance'), render: (row) => formatCurrency(row.totalAmount - row.paidAmount) },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'preview',
      label: t('common.preview'),
      render: (row) => (
        <button className="link-button" type="button" onClick={() => setSelectedInvoice(row)}>
          {t('open')}
        </button>
      ),
    },
  ];

  return (
    <div className="page-grid">
      <Card title={t('invoices.listTitle')} subtitle={t('invoices.listSubtitle')}>
        <Table columns={columns} rows={invoices} />
      </Card>

      <Card title={t('invoices.previewTitle')} subtitle={t('invoices.previewSubtitle')}>
        <div className="invoice-preview">
          <div className="invoice-preview__header">
            <div>
              <strong>{t('companyName')}</strong>
              <span>{t('invoices.systemName')}</span>
            </div>
            <div>
              <strong>{selectedInvoice.invoiceNo}</strong>
              <span>{selectedInvoice.orderNo}</span>
            </div>
          </div>
          <div className="detail-panel">
            <div><span>{t('common.customer')}</span><strong>{selectedInvoice.customer}</strong></div>
            <div><span>{t('common.totalAmount')}</span><strong>{formatCurrency(selectedInvoice.totalAmount)}</strong></div>
            <div><span>{t('common.paidAmount')}</span><strong>{formatCurrency(selectedInvoice.paidAmount)}</strong></div>
            <div><span>{t('common.remainingBalance')}</span><strong>{formatCurrency(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}</strong></div>
            <div><span>{t('common.status')}</span><StatusBadge status={selectedInvoice.status} /></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
