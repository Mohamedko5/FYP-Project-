import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { inventoryMovementHistory, orders, shipments, warehouses } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const orderStorageKey = 'bayadGeneratedOrders';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function currentTimestamp() {
  return {
    date: today(),
    time: currentTime(),
  };
}

function readStoredOrders() {
  try {
    const stored = JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeStoredOrders(rows) {
  localStorage.setItem(orderStorageKey, JSON.stringify(rows));
}

function updateStoredOrderFromShipment(orderNo, updates) {
  const currentOrders = readStoredOrders();
  if (currentOrders.length === 0) return;

  writeStoredOrders(currentOrders.map((order) => (
    order.orderNo === orderNo ? { ...order, ...updates } : order
  )));
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

function averageBagWeight(numberOfBags, totalWeight) {
  const bags = Number(numberOfBags || 0);
  const weight = Number(totalWeight || 0);
  return bags > 0 && weight > 0 ? Number((weight / bags).toFixed(2)) : 0;
}

function isSesame(product) {
  return ['White Sesame', 'Red Sesame'].includes(product);
}

function isCorn(product) {
  return product === 'Corn';
}

function productShipmentUnit(product) {
  if (isSesame(product)) return 'Qintar';
  if (isCorn(product)) return 'kg';
  if (product === 'Plastic') return 'Bale';
  if (product === 'Sacks / Khaysh') return 'Bale';
  if (product === 'Dabara') return 'Piece';
  return '';
}

function shipmentQuantityLabel(shipment) {
  const unit = productShipmentUnit(shipment.product);
  const value = Number(shipment.totalWeight || shipment.quantity || 0);
  return unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
}

function shipmentAverageLabel(shipment) {
  if (!shipment.averageBagWeight) return '-';
  if (isSesame(shipment.product)) return `${shipment.averageBagWeight.toLocaleString()} Qintar`;
  if (isCorn(shipment.product)) return `${shipment.averageBagWeight.toLocaleString()} kg`;
  return '-';
}

function stockDeductionQuantity(shipment) {
  return isSesame(shipment.product)
    ? Number(shipment.totalWeight || 0)
    : Number(shipment.numberOfBags || shipment.quantity || shipment.totalWeight || 0);
}

function normalizeShipment(shipment) {
  const order = orderForShipment(shipment);
  const warehouse = warehouseForProduct(order.product);
  const numberOfBags = shipment.numberOfBags || quantityNumber(order.quantity);
  const totalWeight = shipment.totalWeight || shipment.netWeight || 0;
  const averageWeight = shipment.averageBagWeight || averageBagWeight(numberOfBags, totalWeight);
  return {
    date: shipment.date || today(),
    time: shipment.time || currentTime(),
    shipmentId: shipment.batchNo,
    product: shipment.product || order.product || 'White Sesame',
    warehouseName: shipment.warehouseName || warehouse?.warehouseName || '',
    numberOfBags,
    totalWeight,
    driverName: shipment.driverName || '',
    notes: shipment.notes || shipment.tracking || '',
    ...shipment,
    averageBagWeight: shipment.averageBagWeight || averageWeight,
  };
}

function createShipmentForm(shipment) {
  return {
    id: shipment.id,
    orderNo: shipment.orderNo,
    customer: shipment.customer,
    product: shipment.product,
    warehouseName: shipment.warehouseName,
    numberOfBags: shipment.numberOfBags || '',
    totalWeight: shipment.totalWeight || shipment.netWeight || '',
    driverName: shipment.driverName || '',
    approvalStatus: 'Weighed',
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
  const [activeShipmentTab, setActiveShipmentTab] = useState('completed');
  const [errors, setErrors] = useState([]);

  const pendingShipments = shipmentRows.filter((shipment) => !['Completed', 'Shipped'].includes(shipment.status));
  const completedShipments = shipmentRows.filter((shipment) => ['Completed', 'Shipped'].includes(shipment.status));
  const historyShipments = shipmentRows.filter((shipment) => shipment.status !== 'Pending Approval');

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
    const totalWeight = Number(shipmentForm.totalWeight);
    const calculatedAverageWeight = averageBagWeight(numberOfBags, totalWeight);
    const formErrors = [];

    if (!numberOfBags || numberOfBags <= 0) formErrors.push(t('shipments.bagsRequired'));
    if (!totalWeight || totalWeight <= 0) formErrors.push(t('shipments.totalWeightRequired'));
    if (!shipmentForm.driverName.trim()) formErrors.push(t('shipments.driverRequired'));

    if (formErrors.length > 0) {
      setErrors(formErrors);
      return;
    }

    const timestamp = currentTimestamp();
    setShipmentRows((current) =>
      current.map((shipment) =>
        shipment.id === shipmentForm.id
          ? {
              ...shipment,
              ...shipmentForm,
              date: timestamp.date,
              time: timestamp.time,
              numberOfBags,
              totalWeight,
              netWeight: totalWeight,
              averageBagWeight: calculatedAverageWeight,
              status: shipmentForm.approvalStatus,
              tracking: t('shipments.weighedTracking'),
            }
          : shipment
      )
    );
    closeShipmentForm();
  }

  function approveShipment(shipment) {
    const timestamp = currentTimestamp();
    setShipmentRows((current) =>
      current.map((row) =>
        row.id === shipment.id
          ? { ...row, ...timestamp, status: 'Approved', tracking: t('shipments.approvedTracking') }
          : row
      )
    );

    setWarehouseRows((current) =>
      current.map((warehouse) => {
        if (warehouse.warehouseName !== shipment.warehouseName) return warehouse;
        return {
          ...warehouse,
          currentStock: Math.max(warehouse.currentStock - stockDeductionQuantity(shipment), 0),
          storedProducts: warehouse.storedProducts.map((product) =>
            product.productName === shipment.product
              ? { ...product, quantity: Math.max(product.quantity - stockDeductionQuantity(shipment), 0) }
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
        quantity: stockDeductionQuantity(shipment),
        unit: productShipmentUnit(shipment.product) || 'Unit',
        date: timestamp.date,
        time: timestamp.time,
        adminName: t('admin'),
        driverName: shipment.driverName,
        notes: shipment.notes || t('shipments.approvedTracking'),
      },
      ...current,
    ]);

    updateStoredOrderFromShipment(shipment.orderNo, {
      status: 'Shipped',
      shipmentStatus: 'Shipped',
      statusUpdatedDate: timestamp.date,
      statusUpdatedTime: timestamp.time,
    });
  }

  function completeShipment(shipment) {
    const timestamp = currentTimestamp();
    setShipmentRows((current) =>
      current.map((row) =>
        row.id === shipment.id ? { ...row, ...timestamp, status: 'Completed', tracking: t('shipments.completedTracking') } : row
      )
    );
    updateStoredOrderFromShipment(shipment.orderNo, {
      status: 'Completed',
      shipmentStatus: 'Completed',
      statusUpdatedDate: timestamp.date,
      statusUpdatedTime: timestamp.time,
    });
  }

  const shipmentColumns = [
    { key: 'shipmentId', label: t('shipments.shipmentId') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product') },
    { key: 'warehouseName', label: t('warehouse.warehouse') },
    { key: 'numberOfBags', label: t('shipments.numberOfBags') },
    { key: 'totalWeight', label: t('shipments.totalQuantity'), render: (row) => shipmentQuantityLabel(row) },
    { key: 'averageBagWeight', label: t('shipments.averageUnitPerBag'), render: (row) => shipmentAverageLabel(row) },
    { key: 'driverName', label: t('warehouse.driverName'), render: (row) => row.driverName || '-' },
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
    { key: 'totalWeight', label: t('shipments.totalQuantity'), render: (row) => shipmentQuantityLabel(row) },
    { key: 'averageBagWeight', label: t('shipments.averageUnitPerBag'), render: (row) => shipmentAverageLabel(row) },
    { key: 'driverName', label: t('warehouse.driverName') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  const formAverageBagWeight = shipmentForm ? averageBagWeight(shipmentForm.numberOfBags, shipmentForm.totalWeight) : 0;

  return (
    <div className="page-grid workflow-page">
      <div className="summary-grid summary-grid--four">
        <Card className="summary-card"><p>{t('shipments.pendingWeighing')}</p><strong>{pendingShipments.length}</strong></Card>
        <Card className="summary-card"><p>{t('shipments.approvedShipments')}</p><strong>{shipmentRows.filter((shipment) => shipment.status === 'Approved').length}</strong></Card>
        <Card className="summary-card"><p>{t('shipments.completedShipments')}</p><strong>{completedShipments.length}</strong></Card>
        <Card className="summary-card"><p>{t('dashboard.pendingShipments')}</p><strong>{pendingShipments.length}</strong></Card>
      </div>

      <Card title={t('shipments.pendingTitle')} subtitle={t('shipments.pendingSubtitle')}>
        <Table columns={shipmentColumns} rows={pendingShipments} />
      </Card>

      {processingShipment && shipmentForm && (
        <Card title={t('shipments.processShipment')} subtitle={processingShipment.shipmentId}>
          <form className="form-grid" onSubmit={saveShipment}>
            {errors.length > 0 && <div className="form-error form-grid__wide">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <label>{t('common.orderNumber')}<input name="orderNo" value={shipmentForm.orderNo} readOnly /></label>
            <label>{t('common.customerName')}<input name="customer" value={shipmentForm.customer} readOnly /></label>
            <label>{t('common.product')}<input name="product" value={shipmentForm.product} readOnly /></label>
            <label>{t('warehouse.warehouse')}<select name="warehouseName" value={shipmentForm.warehouseName} onChange={handleFormChange}>{warehouseRows.map((warehouse) => <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>)}</select></label>
            <label>{t('shipments.numberOfBags')}<input name="numberOfBags" type="number" min="0" value={shipmentForm.numberOfBags} onChange={handleFormChange} /></label>
            <label>{isSesame(shipmentForm.product) ? t('shipments.totalQintar') : t('shipments.totalWeight')}<input name="totalWeight" type="number" min="0" value={shipmentForm.totalWeight} onChange={handleFormChange} /></label>
            <label>{t('shipments.averageUnitPerBag')}<input value={formAverageBagWeight ? `${formAverageBagWeight.toLocaleString()} ${isSesame(shipmentForm.product) ? 'Qintar' : 'kg'}` : '-'} readOnly /></label>
            <label>{t('warehouse.driverName')}<input name="driverName" value={shipmentForm.driverName} onChange={handleFormChange} /></label>
            <label>{t('shipments.approvalStatus')}<select name="approvalStatus" value={shipmentForm.approvalStatus} onChange={handleFormChange}>
              <option value="Weighed">{t('status.Weighed')}</option>
              <option value="Approved">{t('status.Approved')}</option>
            </select></label>
            <label className="form-grid__wide">{t('warehouse.notes')}<textarea name="notes" value={shipmentForm.notes} onChange={handleFormChange} /></label>
            <div className="form-grid__actions form-grid__actions--split">
              <Button type="submit">{t('shipments.saveWeighing')}</Button>
              <Button type="button" variant="secondary" onClick={closeShipmentForm}>{t('cancel')}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={activeShipmentTab === 'completed' ? t('shipments.completedTitle') : t('shipments.historyTitle')} subtitle={activeShipmentTab === 'completed' ? t('shipments.completedSubtitle') : t('shipments.historySubtitle')}>
        <div className="customer-module-tabs shipment-tabs">
          <button
            className={`customer-module-tabs__button ${activeShipmentTab === 'completed' ? 'is-active' : ''}`}
            onClick={() => setActiveShipmentTab('completed')}
          >
            {t('shipments.completedTitle')}
          </button>
          <button
            className={`customer-module-tabs__button ${activeShipmentTab === 'history' ? 'is-active' : ''}`}
            onClick={() => setActiveShipmentTab('history')}
          >
            {t('shipments.historyTitle')}
          </button>
        </div>
        <div className="section-spacer">
          <Table columns={historyColumns} rows={activeShipmentTab === 'completed' ? completedShipments : historyShipments} />
        </div>
      </Card>
    </div>
  );
}
