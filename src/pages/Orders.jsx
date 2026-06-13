import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { formatCurrency, orders } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const orderStorageKey = 'bayadGeneratedOrders';

function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

function readStoredRows(key, fallback = []) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(stored) && stored.length > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredRows(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function normalizeOrder(order, index = 0) {
  const statusMap = {
    Created: 'Pending',
    Approved: 'Pending',
    Confirmed: 'Pending',
    Processing: 'Ready for Shipment',
    Shipped: 'Completed',
  };
  const timestamp = getCurrentDateTime();

  return {
    id: order.id || Date.now() + index,
    orderNo: order.orderNo || `ORD-${String(index + 1).padStart(4, '0')}`,
    invoiceNo: order.invoiceNo || '',
    customer: order.customer || order.customerName || order.personName || '',
    phone: order.phone || '',
    product: order.product || order.productType || '',
    quantity: Number(String(order.quantity || '').match(/\d+/)?.[0] || order.quantity || 0),
    unit: order.unit || order.unitPackaging || 'Qintar',
    orderDate: order.orderDate || order.date || timestamp.date,
    orderTime: order.orderTime || order.time || timestamp.time,
    status: statusMap[order.status] || order.status || 'Pending',
    paymentStatus: order.paymentStatus || 'Unpaid',
    shipmentStatus: order.shipmentStatus || 'Not Ready',
    totalAmount: Number(order.totalAmount || 0),
    notes: order.notes || order.customerNote || '',
  };
}

function seedOrders() {
  return orders.map(normalizeOrder);
}

export default function Orders() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orderRows, setOrderRows] = useState(() => readStoredRows(orderStorageKey, seedOrders()).map(normalizeOrder));
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const selectedOrder = orderRows.find((order) => String(order.id) === String(selectedOrderId));
  const productLabel = (value) => t(`invoices.productTypes.${value}`) || value;
  const unitLabel = (value) => t(`invoices.unitPackagingOptions.${value}`) || value;
  const canCreateInvoice = (order) => !['Paid', 'Ready for Shipment', 'Completed', 'Cancelled'].includes(order.status);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'paid') return orderRows.filter((order) => order.status === 'Paid' || order.status === 'Ready for Shipment');
    if (activeTab === 'completed') return orderRows.filter((order) => order.status === 'Completed');
    return orderRows.filter((order) => !['Paid', 'Ready for Shipment', 'Completed', 'Cancelled'].includes(order.status));
  }, [activeTab, orderRows]);

  function updateOrders(nextRows) {
    setOrderRows(nextRows);
    writeStoredRows(orderStorageKey, nextRows);
  }

  function openInvoiceDraft(order) {
    writeStoredRows(orderStorageKey, orderRows);
    navigate('/invoices', { state: { orderForInvoice: order } });
  }

  const columns = [
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product'), render: (row) => productLabel(row.product) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'orderDate', label: t('common.date') },
    { key: 'orderTime', label: t('common.time') },
    { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          <Button variant="secondary" onClick={() => setSelectedOrderId(row.id)}>{t('orders.viewOrder')}</Button>
          {canCreateInvoice(row) && (
            <Button onClick={() => openInvoiceDraft(row)}>{t('invoices.createInvoice')}</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid workflow-page">
      <Card title={t('orders.listTitle')} subtitle={t('orders.customerOrderSubtitle')}>
        <div className="customer-module-tabs shipment-tabs">
          <button className={`customer-module-tabs__button ${activeTab === 'pending' ? 'is-active' : ''}`} onClick={() => setActiveTab('pending')}>{t('orders.pendingOrders')}</button>
          <button className={`customer-module-tabs__button ${activeTab === 'paid' ? 'is-active' : ''}`} onClick={() => setActiveTab('paid')}>{t('orders.paidOrders')}</button>
          <button className={`customer-module-tabs__button ${activeTab === 'completed' ? 'is-active' : ''}`} onClick={() => setActiveTab('completed')}>{t('orders.completedOrders')}</button>
        </div>
        <Table columns={columns} rows={filteredOrders} emptyMessage={t('orders.noOrders')} />
      </Card>

      {selectedOrder && (
        <Card title={t('orders.detailTitle')} subtitle={selectedOrder.orderNo}>
          <div className="detail-panel">
            <div><span>{t('common.customerName')}</span><strong>{selectedOrder.customer}</strong></div>
            <div><span>{t('common.product')}</span><strong>{productLabel(selectedOrder.product)}</strong></div>
            <div><span>{t('common.quantity')}</span><strong>{selectedOrder.quantity}</strong></div>
            <div><span>{t('common.unit')}</span><strong>{unitLabel(selectedOrder.unit)}</strong></div>
            <div><span>{t('common.date')}</span><strong>{selectedOrder.orderDate}</strong></div>
            <div><span>{t('common.time')}</span><strong>{selectedOrder.orderTime}</strong></div>
            <div><span>{t('orders.orderStatus')}</span><StatusBadge status={selectedOrder.status} /></div>
            <div><span>{t('common.invoiceNumber')}</span><strong>{selectedOrder.invoiceNo || '-'}</strong></div>
            <div><span>{t('common.totalAmount')}</span><strong>{formatCurrency(selectedOrder.totalAmount)}</strong></div>
          </div>
          <p className="customer-notes">{selectedOrder.notes || t('warehouse.noNotes')}</p>
          <div className="workflow-actions">
            {canCreateInvoice(selectedOrder) && (
              <Button onClick={() => openInvoiceDraft(selectedOrder)}>{t('invoices.createInvoice')}</Button>
            )}
            <Button variant="secondary" onClick={() => setSelectedOrderId('')}>{t('customers.closeSection')}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
