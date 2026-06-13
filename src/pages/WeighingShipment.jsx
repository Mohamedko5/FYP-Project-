import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import { inventoryMovementHistory, shipments, warehouses } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const orderStorageKey = 'bayadGeneratedOrders';
const shipmentStorageKey = 'bayadShipments';
const movementStorageKey = 'bayadInventoryMovementHistory';

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

function isSesame(product) {
  return ['White Sesame', 'Red Sesame'].includes(product);
}

function isCorn(product) {
  return product === 'Corn';
}

function productShipmentUnit(product, fallback = '') {
  if (isSesame(product)) return 'Qintar';
  if (isCorn(product)) return fallback || 'kg';
  if (product === 'Plastic') return 'Bale';
  if (product === 'Sacks / Khaysh') return 'Bale';
  if (product === 'Dabara') return 'Piece';
  return fallback || 'Unit';
}

function averageBagWeight(numberOfBags, totalWeight) {
  const bags = Number(numberOfBags || 0);
  const weight = Number(totalWeight || 0);
  return bags > 0 && weight > 0 ? Number((weight / bags).toFixed(2)) : 0;
}

function normalizeSeedShipment(shipment) {
  const statusMap = {
    Approved: 'Ready for Shipment',
    'Pending Approval': 'Ready for Shipment',
    Shipped: 'Completed',
  };

  return {
    id: shipment.id,
    shipmentId: shipment.batchNo || shipment.shipmentId,
    invoiceNo: shipment.invoiceNo || '',
    orderNo: shipment.orderNo,
    customer: shipment.customer,
    product: shipment.product,
    requestedQuantity: shipment.requestedQuantity || shipment.totalWeight || shipment.numberOfBags || 0,
    unit: productShipmentUnit(shipment.product),
    paymentStatus: 'Paid',
    status: statusMap[shipment.status] || shipment.status || 'Ready for Shipment',
    warehouseName: shipment.warehouseName || '',
    actualQuantity: shipment.actualQuantity || shipment.totalWeight || '',
    numberOfBags: shipment.numberOfBags || '',
    totalWeight: shipment.totalWeight || '',
    averageBagWeight: shipment.averageBagWeight || averageBagWeight(shipment.numberOfBags, shipment.totalWeight),
    driverName: shipment.driverName || '',
    notes: shipment.notes || shipment.tracking || '',
    date: shipment.date,
    time: shipment.time,
  };
}

function shipmentQuantityLabel(shipment) {
  const quantity = Number(shipment.actualQuantity || shipment.requestedQuantity || 0);
  return `${quantity.toLocaleString()} ${shipment.unit || productShipmentUnit(shipment.product)}`;
}

function updateStoredOrder(orderNo, updates) {
  const currentOrders = readStoredRows(orderStorageKey, []);
  if (currentOrders.length === 0) return;
  writeStoredRows(orderStorageKey, currentOrders.map((order) => (
    order.orderNo === orderNo ? { ...order, ...updates } : order
  )));
}

function createForm(shipment) {
  return {
    id: shipment.id,
    warehouseName: shipment.warehouseName || '',
    actualQuantity: shipment.actualQuantity || shipment.requestedQuantity || '',
    unit: shipment.unit || productShipmentUnit(shipment.product),
    numberOfBags: shipment.numberOfBags || '',
    totalWeight: shipment.totalWeight || '',
    driverName: shipment.driverName || '',
    notes: shipment.notes || '',
  };
}

export default function WeighingShipment() {
  const { t } = useLanguage();
  const [shipmentRows, setShipmentRows] = useState(() => readStoredRows(shipmentStorageKey, shipments).map(normalizeSeedShipment));
  const [warehouseRows, setWarehouseRows] = useState(warehouses);
  const [movementRows, setMovementRows] = useState(() => readStoredRows(movementStorageKey, inventoryMovementHistory));
  const [activeShipmentTab, setActiveShipmentTab] = useState('ready');
  const [processingShipmentId, setProcessingShipmentId] = useState('');
  const [shipmentForm, setShipmentForm] = useState(null);
  const [errors, setErrors] = useState([]);

  const processingShipment = shipmentRows.find((shipment) => String(shipment.id) === String(processingShipmentId));
  const formAverageBagWeight = shipmentForm ? averageBagWeight(shipmentForm.numberOfBags, shipmentForm.totalWeight) : 0;

  const tabRows = useMemo(() => {
    if (activeShipmentTab === 'processing') return shipmentRows.filter((shipment) => shipment.status === 'Processing');
    if (activeShipmentTab === 'completed') return shipmentRows.filter((shipment) => shipment.status === 'Completed');
    if (activeShipmentTab === 'history') return shipmentRows.filter((shipment) => ['Processing', 'Completed', 'Cancelled'].includes(shipment.status));
    return shipmentRows.filter((shipment) => shipment.status === 'Ready for Shipment');
  }, [activeShipmentTab, shipmentRows]);

  function updateShipments(nextRows) {
    setShipmentRows(nextRows);
    writeStoredRows(shipmentStorageKey, nextRows);
  }

  function openShipmentForm(shipment) {
    setErrors([]);
    setProcessingShipmentId(shipment.id);
    setShipmentForm(createForm(shipment));
  }

  function closeShipmentForm() {
    setErrors([]);
    setProcessingShipmentId('');
    setShipmentForm(null);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setShipmentForm((current) => ({ ...current, [name]: value }));
  }

  function saveProcessing(event) {
    event.preventDefault();
    const errorsList = [];
    const quantity = Number(shipmentForm.actualQuantity);

    if (!shipmentForm.warehouseName) errorsList.push(t('warehouse.selectWarehouseError'));
    if (!shipmentForm.driverName.trim()) errorsList.push(t('shipments.driverRequired'));
    if (!shipmentForm.actualQuantity || quantity <= 0) errorsList.push(t('warehouse.quantityPositive'));

    if (errorsList.length > 0) {
      setErrors(errorsList);
      return;
    }

    const timestamp = getCurrentDateTime();
    const nextRows = shipmentRows.map((shipment) => (
      shipment.id === shipmentForm.id
        ? {
            ...shipment,
            ...shipmentForm,
            actualQuantity: quantity,
            numberOfBags: Number(shipmentForm.numberOfBags || 0),
            totalWeight: Number(shipmentForm.totalWeight || 0),
            averageBagWeight: formAverageBagWeight,
            status: 'Processing',
            date: timestamp.date,
            time: timestamp.time,
          }
        : shipment
    ));
    updateShipments(nextRows);
    updateStoredOrder(processingShipment.orderNo, { status: 'Ready for Shipment', shipmentStatus: 'Processing' });
    closeShipmentForm();
    setActiveShipmentTab('processing');
  }

  function completeShipment(shipment) {
    const timestamp = getCurrentDateTime();
    const quantity = Number(shipment.actualQuantity || 0);
    const nextWarehouses = warehouseRows.map((warehouse) => {
      if (warehouse.warehouseName !== shipment.warehouseName) return warehouse;
      const hasExactUnit = warehouse.storedProducts.some((item) => item.productName === shipment.product && item.unit === shipment.unit);
      const storedProducts = warehouse.storedProducts.map((item) => (
        item.productName === shipment.product && (hasExactUnit ? item.unit === shipment.unit : true)
          ? { ...item, quantity: Math.max(Number(item.quantity) - quantity, 0) }
          : item
      ));
      return {
        ...warehouse,
        storedProducts,
        currentStock: storedProducts.reduce((sum, item) => sum + Number(item.quantity), 0),
      };
    });
    setWarehouseRows(nextWarehouses);

    const movement = {
      id: Date.now(),
      warehouseName: shipment.warehouseName,
      type: 'Withdraw Stock',
      product: shipment.product,
      quantity,
      unit: shipment.unit,
      date: timestamp.date,
      time: timestamp.time,
      adminName: t('admin'),
      driverName: shipment.driverName,
      notes: `${t('shipments.completedTracking')} - ${shipment.orderNo}`,
    };
    const nextMovements = [movement, ...movementRows];
    setMovementRows(nextMovements);
    writeStoredRows(movementStorageKey, nextMovements);

    const nextRows = shipmentRows.map((row) => (
      row.id === shipment.id ? { ...row, status: 'Completed', date: timestamp.date, time: timestamp.time } : row
    ));
    updateShipments(nextRows);
    updateStoredOrder(shipment.orderNo, { status: 'Completed', shipmentStatus: 'Completed', paymentStatus: 'Paid' });
    setActiveShipmentTab('completed');
  }

  function cancelShipment(shipment) {
    const nextRows = shipmentRows.map((row) => (row.id === shipment.id ? { ...row, status: 'Cancelled' } : row));
    updateShipments(nextRows);
    updateStoredOrder(shipment.orderNo, { shipmentStatus: 'Cancelled' });
  }

  const columns = [
    { key: 'shipmentId', label: t('shipments.shipmentId') },
    { key: 'orderNo', label: t('common.orderNumber') },
    { key: 'customer', label: t('common.customerName') },
    { key: 'product', label: t('common.product') },
    { key: 'requestedQuantity', label: t('shipments.requestedQuantity'), render: (row) => `${Number(row.requestedQuantity || 0).toLocaleString()} ${row.unit}` },
    { key: 'paymentStatus', label: t('orders.paymentStatus'), render: (row) => <StatusBadge status={row.paymentStatus} /> },
    { key: 'status', label: t('shipments.shipmentStatus'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          {row.status === 'Ready for Shipment' && <Button variant="secondary" onClick={() => openShipmentForm(row)}>{t('shipments.processShipment')}</Button>}
          {row.status === 'Processing' && <Button onClick={() => completeShipment(row)}>{t('shipments.markCompleted')}</Button>}
          {row.status !== 'Completed' && row.status !== 'Cancelled' && <Button variant="secondary" onClick={() => cancelShipment(row)}>{t('cancel')}</Button>}
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
    { key: 'actualQuantity', label: t('shipments.actualQuantity'), render: (row) => shipmentQuantityLabel(row) },
    { key: 'numberOfBags', label: t('shipments.numberOfBags'), render: (row) => row.numberOfBags || '-' },
    { key: 'totalWeight', label: t('shipments.totalWeight'), render: (row) => row.totalWeight ? `${Number(row.totalWeight).toLocaleString()} kg` : '-' },
    { key: 'averageBagWeight', label: t('shipments.averageBagWeight'), render: (row) => row.averageBagWeight ? `${Number(row.averageBagWeight).toLocaleString()} kg` : '-' },
    { key: 'driverName', label: t('warehouse.driverName') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="page-grid workflow-page">
      <Card title={t('shipments.listTitle')} subtitle={t('shipments.realWorkflowSubtitle')}>
        <div className="customer-module-tabs shipment-tabs">
          <button className={`customer-module-tabs__button ${activeShipmentTab === 'ready' ? 'is-active' : ''}`} onClick={() => setActiveShipmentTab('ready')}>{t('shipments.readyForShipment')}</button>
          <button className={`customer-module-tabs__button ${activeShipmentTab === 'processing' ? 'is-active' : ''}`} onClick={() => setActiveShipmentTab('processing')}>{t('status.Processing')}</button>
          <button className={`customer-module-tabs__button ${activeShipmentTab === 'completed' ? 'is-active' : ''}`} onClick={() => setActiveShipmentTab('completed')}>{t('shipments.completedTitle')}</button>
          <button className={`customer-module-tabs__button ${activeShipmentTab === 'history' ? 'is-active' : ''}`} onClick={() => setActiveShipmentTab('history')}>{t('shipments.historyTitle')}</button>
        </div>
        <Table columns={activeShipmentTab === 'history' ? historyColumns : columns} rows={tabRows} />
      </Card>

      {processingShipment && shipmentForm && (
        <Card title={t('shipments.processShipment')} subtitle={processingShipment.shipmentId}>
          <form className="form-grid" onSubmit={saveProcessing}>
            {errors.length > 0 && <div className="form-error form-grid__wide">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <label>{t('common.orderNumber')}<input value={processingShipment.orderNo} readOnly /></label>
            <label>{t('common.customerName')}<input value={processingShipment.customer} readOnly /></label>
            <label>{t('common.product')}<input value={processingShipment.product} readOnly /></label>
            <label>{t('warehouse.warehouse')}<select name="warehouseName" value={shipmentForm.warehouseName} onChange={handleFormChange}><option value="">{t('warehouse.selectWarehousePlaceholder')}</option>{warehouseRows.map((warehouse) => <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>)}</select></label>
            <label>{t('shipments.actualQuantity')}<input name="actualQuantity" type="number" min="0" value={shipmentForm.actualQuantity} onChange={handleFormChange} /></label>
            <label>{t('common.unit')}<input name="unit" value={shipmentForm.unit} onChange={handleFormChange} /></label>
            <label>{t('shipments.numberOfBags')}<input name="numberOfBags" type="number" min="0" value={shipmentForm.numberOfBags} onChange={handleFormChange} /></label>
            <label>{t('shipments.totalWeight')}<input name="totalWeight" type="number" min="0" value={shipmentForm.totalWeight} onChange={handleFormChange} /></label>
            <label>{t('shipments.averageBagWeight')}<input value={formAverageBagWeight ? `${formAverageBagWeight.toLocaleString()} kg` : '-'} readOnly /></label>
            <label>{t('warehouse.driverName')}<input name="driverName" value={shipmentForm.driverName} onChange={handleFormChange} /></label>
            <label className="form-grid__wide">{t('warehouse.notes')}<textarea name="notes" value={shipmentForm.notes} onChange={handleFormChange} /></label>
            <div className="form-grid__actions form-grid__actions--split">
              <Button type="submit">{t('shipments.saveProcessing')}</Button>
              <Button type="button" variant="secondary" onClick={closeShipmentForm}>{t('cancel')}</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
