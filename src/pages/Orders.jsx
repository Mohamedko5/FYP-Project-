import { useState } from 'react';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { orders, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Orders() {
  const { t } = useLanguage();
  const [selectedOrder, setSelectedOrder] = useState(orders[0]);

  const columns = [
    { key: 'orderNo', label: t('common.orderNo') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product') },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.totalAmount) },
    { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      label: t('common.detail'),
      render: (row) => (
        <button className="link-button" type="button" onClick={() => setSelectedOrder(row)}>
          {t('view')}
        </button>
      ),
    },
  ];

  return (
    <div className="page-grid">
      <Card title={t('orders.listTitle')} subtitle={t('orders.listSubtitle')}>
        <Table columns={columns} rows={orders} />
      </Card>

      <Card title={t('orders.detailTitle')} subtitle={t('orders.detailSubtitle')}>
        <div className="detail-panel">
          <div>
            <span>{t('common.orderNumber')}</span>
            <strong>{selectedOrder.orderNo}</strong>
          </div>
          <div>
            <span>{t('common.customer')}</span>
            <strong>{selectedOrder.customer}</strong>
          </div>
          <div>
            <span>{t('common.product')}</span>
            <strong>{selectedOrder.product}</strong>
          </div>
          <div>
            <span>{t('common.quantity')}</span>
            <strong>{selectedOrder.quantity}</strong>
          </div>
          <div>
            <span>{t('common.totalAmount')}</span>
            <strong>{formatCurrency(selectedOrder.totalAmount)}</strong>
          </div>
          <div>
            <span>{t('common.status')}</span>
            <StatusBadge status={selectedOrder.status} />
          </div>
        </div>
      </Card>
    </div>
  );
}
