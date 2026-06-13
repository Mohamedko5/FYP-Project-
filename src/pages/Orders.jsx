import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { invoices } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const orderStorageKey = 'bayadGeneratedOrders';

function readStoredOrders() {
  try {
    const stored = JSON.parse(localStorage.getItem(orderStorageKey) || 'null');
    if (Array.isArray(stored) && stored.length > 0) return stored.map(normalizeOrder);
  } catch {
    // Use invoice-seeded orders below when localStorage is not readable.
  }

  return invoices.map((invoice, index) => ({
    id: invoice.id,
    orderNo: invoice.orderNo || `ORD-${String(index + 1).padStart(4, '0')}`,
    invoiceNo: invoice.invoiceNo,
    customer: invoice.customerName || invoice.personName || invoice.customer,
    phone: invoice.phone,
    product: invoice.product || invoice.productType,
    quantity: invoice.quantity,
    unit: invoice.unit || invoice.unitPackaging,
    orderSource: invoice.orderSource || 'Admin Invoice',
    status: invoice.status === 'Completed' ? 'Completed' : 'Pending',
    paymentStatus: invoice.paymentStatus || 'Pending',
    shipmentStatus: 'Pending',
    orderDate: invoice.date,
    totalAmount: invoice.totalAmount || 0,
    notes: invoice.notes || '',
  }));
}

function normalizeOrder(order) {
  const statusMap = {
    Created: 'Pending',
    Approved: 'Confirmed',
    'Sent to Weighing': 'Processing',
    'In Transit': 'Shipped',
  };

  return {
    ...order,
    status: statusMap[order.status] || order.status || 'Pending',
  };
}

function writeStoredOrders(rows) {
  localStorage.setItem(orderStorageKey, JSON.stringify(rows));
}

function getCurrentDateTime() {
  const now = new Date();
  return {
    statusUpdatedDate: now.toISOString().slice(0, 10),
    statusUpdatedTime: now.toTimeString().slice(0, 5),
  };
}

export default function Orders() {
  const { t } = useLanguage();
  const [orderRows, setOrderRows] = useState(readStoredOrders);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const selectedOrder = orderRows.find((order) => String(order.id) === String(selectedOrderId));
  const statusCounts = {
    total: orderRows.length,
    created: orderRows.filter((order) => order.status === 'Pending').length,
    approved: orderRows.filter((order) => order.status === 'Confirmed').length,
    completed: orderRows.filter((order) => order.status === 'Completed').length,
  };

  const productLabel = (value) => t(`invoices.productTypes.${value}`) || value;
  const unitLabel = (value) => t(`invoices.unitPackagingOptions.${value}`) || value;
  const sourceLabel = (value) => t(`orders.sources.${value}`) || value;

  function updateOrder(orderId, updates) {
    const timestamp = getCurrentDateTime();
    const nextRows = orderRows.map((order) => (
      String(order.id) === String(orderId) ? { ...order, ...updates, ...timestamp } : order
    ));
    setOrderRows(nextRows);
    writeStoredOrders(nextRows);
  }

  function approveOrder(order) {
    updateOrder(order.id, { status: 'Confirmed' });
  }

  function sendToWeighing(order) {
    updateOrder(order.id, {
      status: 'Processing',
      shipmentStatus: 'Pending Weighing',
    });
  }

  function markShipped(order) {
    updateOrder(order.id, {
      status: 'Shipped',
      shipmentStatus: 'Shipped',
    });
  }

  function markCompleted(order) {
    updateOrder(order.id, {
      status: 'Completed',
      shipmentStatus: order.shipmentStatus === 'Pending' ? 'Completed' : order.shipmentStatus,
      paymentStatus: order.paymentStatus === 'Pending' ? 'Paid' : order.paymentStatus,
    });
  }

  function cancelOrder(order) {
    updateOrder(order.id, { status: 'Cancelled' });
  }

  function orderActions(order) {
    const actions = [];
    if (order.status === 'Pending') actions.push({ label: t('orders.approveOrder'), onClick: () => approveOrder(order) });
    if (order.status === 'Confirmed') actions.push({ label: t('orders.sendToShipment'), onClick: () => sendToWeighing(order) });
    if (order.status === 'Processing') actions.push({ label: t('orders.markShipped'), onClick: () => markShipped(order) });
    if (['Processing', 'Shipped'].includes(order.status)) actions.push({ label: t('orders.markCompleted'), onClick: () => markCompleted(order) });
    if (!['Completed', 'Cancelled'].includes(order.status)) actions.push({ label: t('orders.cancelOrder'), onClick: () => cancelOrder(order), variant: 'secondary' });
    return actions;
  }

  const columns = [
    { key: 'orderNo', label: t('orders.orderId') },
    { key: 'invoiceNo', label: t('common.invoiceNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'orderSource', label: t('orders.orderSource'), render: (row) => sourceLabel(row.orderSource) },
    { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'paymentStatus', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
    { key: 'shipmentStatus', label: t('orders.shipmentStatus'), render: (row) => <StatusBadge status={row.shipmentStatus} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <Button variant="secondary" onClick={() => setSelectedOrderId(row.id)}>
          {t('orders.viewOrder')}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-grid workflow-page">
      <div className="summary-grid summary-grid--four">
        <Card className="summary-card"><p>{t('orders.totalOrders')}</p><strong>{statusCounts.total}</strong></Card>
        <Card className="summary-card"><p>{t('orders.createdOrders')}</p><strong>{statusCounts.created}</strong></Card>
        <Card className="summary-card"><p>{t('orders.approvedOrders')}</p><strong>{statusCounts.approved}</strong></Card>
        <Card className="summary-card"><p>{t('orders.completedOrders')}</p><strong>{statusCounts.completed}</strong></Card>
      </div>

      <Card title={t('orders.listTitle')} subtitle={t('orders.invoiceGeneratedSubtitle')}>
        <Table columns={columns} rows={orderRows} emptyMessage={t('orders.noInvoiceOrders')} />
      </Card>

      {selectedOrder && (
        <Card title={t('orders.detailTitle')} subtitle={t('orders.detailSubtitle')}>
          <div className="detail-panel">
            <div><span>{t('common.customer')}</span><strong>{selectedOrder.customer}</strong></div>
            <div><span>{t('common.phone')}</span><strong>{selectedOrder.phone || '-'}</strong></div>
            <div><span>{t('common.invoiceNumber')}</span><strong>{selectedOrder.invoiceNo}</strong></div>
            <div><span>{t('orders.orderSource')}</span><strong>{sourceLabel(selectedOrder.orderSource)}</strong></div>
            <div><span>{t('common.product')}</span><strong>{productLabel(selectedOrder.product)}</strong></div>
            <div><span>{t('common.quantity')}</span><strong>{selectedOrder.quantity}</strong></div>
            <div><span>{t('common.unit')}</span><strong>{unitLabel(selectedOrder.unit)}</strong></div>
            <div><span>{t('orders.orderStatus')}</span><StatusBadge status={selectedOrder.status} /></div>
            <div><span>{t('orders.paymentStatus')}</span><StatusBadge status={selectedOrder.paymentStatus} /></div>
            <div><span>{t('orders.shipmentStatus')}</span><StatusBadge status={selectedOrder.shipmentStatus} /></div>
          </div>
          <p className="customer-notes">{selectedOrder.notes || t('warehouse.noNotes')}</p>
          <div className="workflow-actions">
            {orderActions(selectedOrder).map((action) => (
              <Button key={action.label} variant={action.variant || 'primary'} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setSelectedOrderId('')}>{t('customers.closeSection')}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
