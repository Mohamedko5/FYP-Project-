import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { shipments } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WeighingShipment() {
  const { t } = useLanguage();
  const [shipmentRows, setShipmentRows] = useState(shipments);

  function approveShipment(id) {
    setShipmentRows((current) =>
      current.map((shipment) =>
        shipment.id === id ? { ...shipment, status: 'Approved', tracking: t('shipments.approvedTracking') } : shipment
      )
    );
  }

  const columns = [
    { key: 'batchNo', label: t('shipments.batchNumber') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'grossWeight', label: t('shipments.grossWeight'), render: (row) => `${row.grossWeight.toLocaleString()} kg` },
    { key: 'tareWeight', label: t('shipments.tareWeight'), render: (row) => `${row.tareWeight.toLocaleString()} kg` },
    { key: 'netWeight', label: t('shipments.netWeight'), render: (row) => `${row.netWeight.toLocaleString()} kg` },
    { key: 'status', label: t('shipments.shipmentStatus'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'tracking', label: t('shipments.trackingStatus') },
    {
      key: 'approval',
      label: t('shipments.approval'),
      render: (row) => (
        <Button variant="secondary" onClick={() => approveShipment(row.id)}>
          {t('approve')}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-grid">
      <Card title={t('shipments.listTitle')} subtitle={t('shipments.listSubtitle')}>
        <Table columns={columns} rows={shipmentRows} />
      </Card>

      <Card title={t('shipments.trackingTitle')} subtitle={t('shipments.trackingSubtitle')}>
        <div className="timeline">
          <div><strong>{t('shipments.step1Title')}</strong><span>{t('shipments.step1Text')}</span></div>
          <div><strong>{t('shipments.step2Title')}</strong><span>{t('shipments.step2Text')}</span></div>
          <div><strong>{t('shipments.step3Title')}</strong><span>{t('shipments.step3Text')}</span></div>
          <div><strong>{t('shipments.step4Title')}</strong><span>{t('shipments.step4Text')}</span></div>
        </div>
      </Card>
    </div>
  );
}
