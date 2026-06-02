import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { customers, formatCurrency, orders, products, warehouses } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createOrderForm() {
  return {
    customer: customers[0]?.name || '',
    product: products[0]?.name || '',
    quantity: '',
    unit: 'Qintar',
    warehouseName: warehouses[0]?.warehouseName || '',
    totalAmount: '',
    orderDate: today(),
    notes: '',
  };
}

function normalizeOrder(order) {
  const quantityParts = String(order.quantity || '').split(' ');
  return {
    unit: quantityParts.slice(1).join(' ') || 'Qintar',
    orderDate: order.orderDate || '2026-05-17',
    warehouseName: order.warehouseName || warehouses.find((warehouse) => warehouse.productType === order.product)?.warehouseName || warehouses[0]?.warehouseName,
    paymentStatus: order.paymentStatus || (order.status === 'Completed' ? 'Paid' : 'Pending'),
    shipmentStatus: order.shipmentStatus || (order.status === 'Shipped' ? 'Shipped' : 'Pending'),
    notes: order.notes || 'No notes recorded.',
    ...order,
  };
}

export default function Orders() {
  const { t } = useLanguage();
  const [orderRows, setOrderRows] = useState(orders.map(normalizeOrder));
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState(createOrderForm());
  const [errors, setErrors] = useState([]);

  const selectedOrder = orderRows.find((order) => String(order.id) === String(selectedOrderId));
  const statusCounts = {
    total: orderRows.length,
    pending: orderRows.filter((order) => order.status === 'Pending').length,
    approved: orderRows.filter((order) => order.status === 'Approved').length,
    completed: orderRows.filter((order) => order.status === 'Completed').length,
  };

  function handleFormChange(event) {
    const { name, value } = event.target;
    setOrderForm((current) => ({ ...current, [name]: value }));
  }

  function openOrderForm() {
    setErrors([]);
    setOrderForm(createOrderForm());
    setShowOrderForm(true);
  }

  function closeOrderForm() {
    setErrors([]);
    setOrderForm(createOrderForm());
    setShowOrderForm(false);
  }

  function handleAddOrder(event) {
    event.preventDefault();
    const formErrors = [];
    if (!orderForm.customer) formErrors.push(t('orders.customerRequired'));
    if (!orderForm.product) formErrors.push(t('orders.productRequired'));
    if (!Number(orderForm.quantity) || Number(orderForm.quantity) <= 0) formErrors.push(t('orders.quantityRequired'));
    if (!Number(orderForm.totalAmount) || Number(orderForm.totalAmount) <= 0) formErrors.push(t('orders.amountRequired'));

    if (formErrors.length > 0) {
      setErrors(formErrors);
      return;
    }

    const newOrder = normalizeOrder({
      id: Date.now(),
      orderNo: `ORD-${Date.now().toString().slice(-4)}`,
      customer: orderForm.customer,
      product: orderForm.product,
      quantity: `${Number(orderForm.quantity).toLocaleString()} ${orderForm.unit}`,
      unit: orderForm.unit,
      orderDate: orderForm.orderDate,
      warehouseName: orderForm.warehouseName,
      totalAmount: Number(orderForm.totalAmount),
      status: 'Pending',
      paymentStatus: 'Pending',
      shipmentStatus: 'Pending',
      notes: orderForm.notes || t('warehouse.noNotes'),
    });

    setOrderRows((current) => [newOrder, ...current]);
    setSelectedOrderId(newOrder.id);
    closeOrderForm();
  }

  function updateOrderStatus(orderId, status) {
    setOrderRows((current) =>
      current.map((order) => {
        if (String(order.id) !== String(orderId)) return order;
        return {
          ...order,
          status,
          shipmentStatus: status === 'Shipped' ? 'Shipped' : order.shipmentStatus,
          paymentStatus: status === 'Completed' ? 'Paid' : order.paymentStatus,
        };
      })
    );
  }

  function orderActions(order) {
    const actions = [];
    if (order.status === 'Pending') actions.push({ label: t('orders.approveOrder'), status: 'Approved' });
    if (order.status === 'Approved') actions.push({ label: t('orders.sendToShipment'), status: 'Processing' });
    if (['Processing', 'Approved'].includes(order.status)) actions.push({ label: t('orders.markCompleted'), status: 'Completed' });
    if (!['Completed', 'Cancelled'].includes(order.status)) actions.push({ label: t('orders.cancelOrder'), status: 'Cancelled', variant: 'secondary' });
    return actions;
  }

  const columns = [
    { key: 'orderNo', label: t('orders.orderId') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product') },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unit', label: t('common.unit') },
    { key: 'orderDate', label: t('orders.orderDate') },
    { key: 'status', label: t('orders.orderStatus'), render: (row) => <StatusBadge status={row.status} /> },
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
        <Card className="summary-card"><p>{t('orders.pendingOrders')}</p><strong>{statusCounts.pending}</strong></Card>
        <Card className="summary-card"><p>{t('orders.approvedOrders')}</p><strong>{statusCounts.approved}</strong></Card>
        <Card className="summary-card"><p>{t('orders.completedOrders')}</p><strong>{statusCounts.completed}</strong></Card>
      </div>

      <Card title={t('orders.listTitle')} subtitle={t('orders.listSubtitle')}>
        <div className="workflow-toolbar">
          {!showOrderForm && <Button onClick={openOrderForm}>{t('orders.addNewOrder')}</Button>}
        </div>
        <Table columns={columns} rows={orderRows} />
      </Card>

      {showOrderForm && (
        <Card title={t('orders.addOrderTitle')} subtitle={t('orders.addOrderSubtitle')}>
          <form className="form-grid" onSubmit={handleAddOrder}>
            {errors.length > 0 && <div className="form-error form-grid__wide">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <label>{t('common.customerName')}<select name="customer" value={orderForm.customer} onChange={handleFormChange}>{customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.name}</option>)}</select></label>
            <label>{t('common.product')}<select name="product" value={orderForm.product} onChange={handleFormChange}>{products.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}</select></label>
            <label>{t('common.quantity')}<input name="quantity" type="number" min="0" value={orderForm.quantity} onChange={handleFormChange} /></label>
            <label>{t('common.unit')}<input name="unit" value={orderForm.unit} onChange={handleFormChange} /></label>
            <label>{t('warehouse.warehouse')}<select name="warehouseName" value={orderForm.warehouseName} onChange={handleFormChange}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>)}</select></label>
            <label>{t('orders.orderDate')}<input name="orderDate" type="date" value={orderForm.orderDate} onChange={handleFormChange} /></label>
            <label>{t('common.totalAmount')}<input name="totalAmount" type="number" min="0" value={orderForm.totalAmount} onChange={handleFormChange} /></label>
            <label className="form-grid__wide">{t('warehouse.notes')}<textarea name="notes" value={orderForm.notes} onChange={handleFormChange} /></label>
            <div className="form-grid__actions form-grid__actions--split">
              <Button type="submit">{t('orders.saveOrder')}</Button>
              <Button type="button" variant="secondary" onClick={closeOrderForm}>{t('cancel')}</Button>
            </div>
          </form>
        </Card>
      )}

      {selectedOrder && (
        <Card title={t('orders.detailTitle')} subtitle={t('orders.detailSubtitle')}>
          <div className="detail-panel">
            <div><span>{t('common.customer')}</span><strong>{selectedOrder.customer}</strong></div>
            <div><span>{t('common.product')}</span><strong>{selectedOrder.product}</strong></div>
            <div><span>{t('common.quantity')}</span><strong>{selectedOrder.quantity}</strong></div>
            <div><span>{t('common.unit')}</span><strong>{selectedOrder.unit}</strong></div>
            <div><span>{t('warehouse.warehouse')}</span><strong>{selectedOrder.warehouseName}</strong></div>
            <div><span>{t('common.totalAmount')}</span><strong>{formatCurrency(selectedOrder.totalAmount)}</strong></div>
            <div><span>{t('orders.orderStatus')}</span><StatusBadge status={selectedOrder.status} /></div>
            <div><span>{t('orders.paymentStatus')}</span><StatusBadge status={selectedOrder.paymentStatus} /></div>
            <div><span>{t('orders.shipmentStatus')}</span><StatusBadge status={selectedOrder.shipmentStatus} /></div>
          </div>
          <p className="customer-notes">{selectedOrder.notes}</p>
          <div className="workflow-actions">
            {orderActions(selectedOrder).map((action) => (
              <Button key={action.label} variant={action.variant || 'primary'} onClick={() => updateOrderStatus(selectedOrder.id, action.status)}>
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
