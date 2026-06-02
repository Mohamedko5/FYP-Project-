import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { inventoryMovementHistory, orders, shipments, warehouses } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const bagWeights = [50, 60, 70];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function quantityNumber(quantity) {
  return Number(String(quantity || '').match(/\d+/)?.[0] || 0);
}

function orderForShipment(shipment) {
  return orders.find((order) => order.orderNo === shipment.orderNo) || {};
}

function warehouseForProduct(product) {
  return warehouses.find((warehouse) => warehouse.productType === product || warehouse.storedProducts.some((item) => item.productName === product)) || warehouses[0];
}

function normalizeShipment(shipment) {
  const order = orderForShipment(shipment);
  const warehouse = warehouseForProduct(order.product);
  const numberOfBags = shipment.numberOfBags || quantityNumber(order.quantity);
  const totalWeight = shipment.totalWeight || shipment.netWeight || 0;
  const bagWeight = shipment.bagWeight || (numberOfBags ? Math.round(totalWeight / numberOfBags) : 50);
  return {
    date: shipment.date || today(),
    time: shipment.time || currentTime(),
    shipmentId: shipment.batchNo,
    product: shipment.product || order.product || 'White Sesame',
    warehouseName: shipment.warehouseName || warehouse?.warehouseName || '',
    numberOfBags,
    bagWeight,
    totalWeight,
    driverName: shipment.driverName || '',
    notes: shipment.notes || shipment.tracking || '',
    ...shipment,
  };
}

function createShipmentForm(shipment) {
  return {
    id: shipment.id,
    date: today(),
    time: currentTime(),
    orderNo: shipment.orderNo,
    customer: shipment.customer,
    product: shipment.product,
    warehouseName: shipment.warehouseName,
    numberOfBags: shipment.numberOfBags || '',
    bagWeight: 50,
    driverName: '',
    notes: '',
  };
}

export default function WeighingShipment() {
  const { t } = useLanguage();
  const [shipmentRows, setShipmentRows] = useState(shipments.map(normalizeShipment));
  const [warehouseRows, setWarehouseRows] = useState(warehouses);
  const [movementRows, setMovementRows] = useState(inventoryMovementHistory);
  const [processingShipment, setProcessingShipment] = useState(null);
  const [shipmentForm, setShipmentForm] = useState(null);
  const [errors, setErrors] = useState([]);

  const pendingShipments = shipmentRows.filter((shipment) => !['Completed', 'Shipped'].includes(shipment.status));
  const completedShipments = shipmentRows.filter((shipment) => ['Completed', 'Shipped'].includes(shipment.status));
  const totalShipmentWeight = shipmentRows.reduce((total, shipment) => total + Number(shipment.totalWeight || shipment.netWeight || 0), 0);

  function openShipmentForm(shipment) {
    setErrors([]);
    setProcessingShipment(shipment);
    setShipmentForm(createShipmentForm(shipment));
  }

  function closeShipmentForm() {
    setErrors([]);
    setProcessingShipment(null);
    setShipmentForm(null);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setShipmentForm((current) => ({ ...current, [name]: value }));
  }

  function saveShipment(event) {
    event.preventDefault();
    const numberOfBags = Number(shipmentForm.numberOfBags);
    const bagWeight = Number(shipmentForm.bagWeight);
    const formErrors = [];

    if (!shipmentForm.date || !shipmentForm.time) formErrors.push(t('shipments.dateTimeRequired'));
    if (!numberOfBags || numberOfBags <= 0) formErrors.push(t('shipments.bagsRequired'));
    if (!shipmentForm.driverName.trim()) formErrors.push(t('shipments.driverRequired'));

    if (formErrors.length > 0) {
      setErrors(formErrors);
      return;
    }

    setShipmentRows((current) =>
      current.map((shipment) =>
        shipment.id === shipmentForm.id
          ? {
              ...shipment,
              ...shipmentForm,
              numberOfBags,
              bagWeight,
              totalWeight: numberOfBags * bagWeight,
              netWeight: numberOfBags * bagWeight,
              status: 'Weighed',
              tracking: t('shipments.weighedTracking'),
            }
          : shipment
      )
    );
    closeShipmentForm();
  }

  function approveShipment(shipment) {
    setShipmentRows((current) =>
      current.map((row) =>
        row.id === shipment.id
          ? { ...row, status: 'Approved', tracking: t('shipments.approvedTracking') }
          : row
      )
    );

    setWarehouseRows((current) =>
      current.map((warehouse) => {
        if (warehouse.warehouseName !== shipment.warehouseName) return warehouse;
        return {
          ...warehouse,
          currentStock: Math.max(warehouse.currentStock - shipment.numberOfBags, 0),
          storedProducts: warehouse.storedProducts.map((product) =>
            product.productName === shipment.product
              ? { ...product, quantity: Math.max(product.quantity - shipment.numberOfBags, 0) }
              : product
          ),
        };
      })
    );

    setMovementRows((current) => [
      {
        id: Date.now(),
        warehouseName: shipment.warehouseName,
        type: 'Withdraw Stock',
        product: shipment.product,
        quantity: shipment.numberOfBags,
        unit: 'Bag',
        date: shipment.date,
        time: shipment.time,
        adminName: t('admin'),
        driverName: shipment.driverName,
        notes: shipment.notes || t('shipments.approvedTracking'),
      },
      ...current,
    ]);
  }

  function completeShipment(shipment) {
    setShipmentRows((current) =>
      current.map((row) =>
        row.id === shipment.id ? { ...row, status: 'Completed', tracking: t('shipments.completedTracking') } : row
      )
    );
  }

  const shipmentColumns = [
    { key: 'shipmentId', label: t('shipments.shipmentId') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product') },
    { key: 'warehouseName', label: t('warehouse.warehouse') },
    { key: 'numberOfBags', label: t('shipments.numberOfBags') },
    { key: 'bagWeight', label: t('shipments.bagWeight'), render: (row) => `${row.bagWeight} kg` },
    { key: 'totalWeight', label: t('shipments.totalWeight'), render: (row) => `${Number(row.totalWeight || row.netWeight || 0).toLocaleString()} kg` },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          {row.status === 'Pending Approval' && <Button variant="secondary" onClick={() => openShipmentForm(row)}>{t('shipments.processShipment')}</Button>}
          {row.status === 'Weighed' && <Button onClick={() => approveShipment(row)}>{t('shipments.approveShipment')}</Button>}
          {row.status === 'Approved' && <Button variant="secondary" onClick={() => completeShipment(row)}>{t('shipments.markCompleted')}</Button>}
        </div>
      ),
    },
  ];

  const historyColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'time', label: t('common.time') },
    { key: 'shipmentId', label: t('shipments.shipmentId') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'product', label: t('common.product') },
    { key: 'warehouseName', label: t('warehouse.warehouse') },
    { key: 'numberOfBags', label: t('shipments.numberOfBags') },
    { key: 'bagWeight', label: t('shipments.bagWeight'), render: (row) => `${row.bagWeight} kg` },
    { key: 'totalWeight', label: t('shipments.totalWeight'), render: (row) => `${Number(row.totalWeight || 0).toLocaleString()} kg` },
    { key: 'driverName', label: t('warehouse.driverName') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="page-grid workflow-page">
      <div className="summary-grid summary-grid--four">
        <Card className="summary-card"><p>{t('shipments.pendingWeighing')}</p><strong>{pendingShipments.length}</strong></Card>
        <Card className="summary-card"><p>{t('shipments.approvedShipments')}</p><strong>{shipmentRows.filter((shipment) => shipment.status === 'Approved').length}</strong></Card>
        <Card className="summary-card"><p>{t('shipments.completedShipments')}</p><strong>{completedShipments.length}</strong></Card>
        <Card className="summary-card"><p>{t('shipments.totalShipmentWeight')}</p><strong>{totalShipmentWeight.toLocaleString()} kg</strong></Card>
      </div>

      <Card title={t('shipments.pendingTitle')} subtitle={t('shipments.pendingSubtitle')}>
        <Table columns={shipmentColumns} rows={pendingShipments} />
      </Card>

      {processingShipment && shipmentForm && (
        <Card title={t('shipments.processShipment')} subtitle={processingShipment.shipmentId}>
          <form className="form-grid" onSubmit={saveShipment}>
            {errors.length > 0 && <div className="form-error form-grid__wide">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <label>{t('common.date')}<input name="date" type="date" value={shipmentForm.date} onChange={handleFormChange} /></label>
            <label>{t('common.time')}<input name="time" type="time" value={shipmentForm.time} onChange={handleFormChange} /></label>
            <label>{t('common.orderNumber')}<input name="orderNo" value={shipmentForm.orderNo} readOnly /></label>
            <label>{t('common.customerName')}<input name="customer" value={shipmentForm.customer} readOnly /></label>
            <label>{t('common.product')}<input name="product" value={shipmentForm.product} readOnly /></label>
            <label>{t('warehouse.warehouse')}<select name="warehouseName" value={shipmentForm.warehouseName} onChange={handleFormChange}>{warehouseRows.map((warehouse) => <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>)}</select></label>
            <label>{t('shipments.numberOfBags')}<input name="numberOfBags" type="number" min="0" value={shipmentForm.numberOfBags} onChange={handleFormChange} /></label>
            <label>{t('shipments.bagWeight')}<select name="bagWeight" value={shipmentForm.bagWeight} onChange={handleFormChange}>{bagWeights.map((weight) => <option key={weight} value={weight}>{weight} kg</option>)}</select></label>
            <label>{t('shipments.totalWeight')}<input value={`${(Number(shipmentForm.numberOfBags || 0) * Number(shipmentForm.bagWeight || 0)).toLocaleString()} kg`} readOnly /></label>
            <label>{t('warehouse.driverName')}<input name="driverName" value={shipmentForm.driverName} onChange={handleFormChange} /></label>
            <label className="form-grid__wide">{t('warehouse.notes')}<textarea name="notes" value={shipmentForm.notes} onChange={handleFormChange} /></label>
            <div className="form-grid__actions form-grid__actions--split">
              <Button type="submit">{t('shipments.saveWeighing')}</Button>
              <Button type="button" variant="secondary" onClick={closeShipmentForm}>{t('cancel')}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={t('shipments.completedTitle')} subtitle={t('shipments.completedSubtitle')}>
        <Table columns={historyColumns} rows={completedShipments} />
      </Card>

      <Card title={t('shipments.historyTitle')} subtitle={t('shipments.historySubtitle')}>
        <Table columns={historyColumns} rows={shipmentRows.filter((shipment) => shipment.status !== 'Pending Approval')} />
      </Card>
    </div>
  );
}
