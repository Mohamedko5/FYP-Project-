import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import {
  customerCashTransactions,
  customerCommodityTransactions,
  customers,
  formatCurrency,
  journalEntries,
  orders,
  shipments,
  warehouses,
} from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const reportTypes = [
  { id: 'daily-journal', titleKey: 'reports.dailyJournalReport', descriptionKey: 'reports.dailyJournalText' },
  { id: 'inventory', titleKey: 'reports.inventoryReport', descriptionKey: 'reports.inventoryText' },
  { id: 'customer-account', titleKey: 'reports.customerAccountReport', descriptionKey: 'reports.customerAccountText' },
  { id: 'orders', titleKey: 'reports.ordersReport', descriptionKey: 'reports.ordersText' },
  { id: 'shipment', titleKey: 'reports.shipmentReport', descriptionKey: 'reports.shipmentText' },
  { id: 'financial-summary', titleKey: 'reports.financialSummary', descriptionKey: 'reports.financialText' },
];

function inDateRange(record, filters) {
  const date = record.date || record.orderDate || '2026-05-17';
  return (!filters.fromDate || date >= filters.fromDate) && (!filters.toDate || date <= filters.toDate);
}

function calculateJournalSummary(rows) {
  const incomeRows = rows.filter((entry) => entry.type === 'Income');
  const opening = incomeRows[0]?.amount || 0;
  const income = incomeRows.slice(1).reduce((total, entry) => total + entry.amount, 0);
  const expenses = rows.filter((entry) => entry.type === 'Expense').reduce((total, entry) => total + entry.amount, 0);
  return { opening, income, expenses, closing: opening + income - expenses };
}

export default function Reports() {
  const { t } = useLanguage();
  const [selectedReportId, setSelectedReportId] = useState('');
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    customer: '',
    warehouse: '',
    product: '',
    status: '',
  });

  const selectedReport = reportTypes.find((report) => report.id === selectedReportId);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetReport() {
    setSelectedReportId('');
  }

  const reportContent = useMemo(() => {
    const filteredJournal = journalEntries.filter((entry) => inDateRange(entry, filters));
    const journalSummary = calculateJournalSummary(filteredJournal);
    const inventoryRows = warehouses.flatMap((warehouse) =>
      warehouse.storedProducts.map((product) => ({
        id: `${warehouse.id}-${product.id}`,
        product: product.productName,
        warehouse: warehouse.warehouseName,
        quantity: product.quantity,
        unit: product.unit,
        availableCapacity: Math.max(warehouse.capacity - warehouse.currentStock, 0),
      }))
    ).filter((row) => (!filters.warehouse || row.warehouse === filters.warehouse) && (!filters.product || row.product === filters.product));
    const customerRows = customers
      .filter((customer) => !filters.customer || customer.name === filters.customer)
      .map((customer) => ({
        ...customer,
        payments: customerCashTransactions.filter((transaction) => transaction.customer === customer.name).length,
        orders: orders.filter((order) => order.customer === customer.name).length,
        statement: customerCommodityTransactions.filter((transaction) => transaction.customer === customer.name).length,
      }));
    const orderRows = orders
      .filter((order) => (!filters.customer || order.customer === filters.customer) && (!filters.product || order.product === filters.product) && (!filters.status || order.status === filters.status))
      .map((order) => ({ ...order, date: order.orderDate || '2026-05-17' }))
      .filter((order) => inDateRange(order, filters));
    const shipmentRows = shipments
      .map((shipment) => {
        const order = orders.find((item) => item.orderNo === shipment.orderNo) || {};
        return {
          ...shipment,
          shipmentId: shipment.batchNo,
          product: order.product,
          warehouse: warehouses.find((warehouse) => warehouse.productType === order.product)?.warehouseName || warehouses[0]?.warehouseName,
          numberOfBags: Number(String(order.quantity || '').match(/\d+/)?.[0] || 0),
          totalWeight: shipment.netWeight,
          driver: shipment.driverName || '',
          date: shipment.date || '2026-05-17',
        };
      })
      .filter((shipment) => (!filters.customer || shipment.customer === filters.customer) && (!filters.product || shipment.product === filters.product) && (!filters.status || shipment.status === filters.status))
      .filter((shipment) => inDateRange(shipment, filters));
    const totalIncome = journalEntries.filter((entry) => entry.type === 'Income').reduce((total, entry) => total + entry.amount, 0);
    const totalExpenses = journalEntries.filter((entry) => entry.type === 'Expense').reduce((total, entry) => total + entry.amount, 0);
    const paymentsReceived = customerCashTransactions.filter((transaction) => transaction.type === 'Payment Received').reduce((total, transaction) => total + transaction.amount, 0);
    const customerDebts = customers.reduce((total, customer) => total + Math.max(customer.remainingBalance || 0, 0), 0);

    return {
      filteredJournal,
      journalSummary,
      inventoryRows,
      customerRows,
      orderRows,
      shipmentRows,
      financialRows: [
        { label: t('reports.totalIncome'), value: formatCurrency(totalIncome) },
        { label: t('reports.totalExpenses'), value: formatCurrency(totalExpenses) },
        { label: t('reports.netBalance'), value: formatCurrency(totalIncome - totalExpenses) },
        { label: t('reports.customerDebts'), value: formatCurrency(customerDebts) },
        { label: t('reports.paymentsReceived'), value: formatCurrency(paymentsReceived) },
      ],
    };
  }, [filters, t]);

  const columnsByReport = {
    'daily-journal': [
      { key: 'date', label: t('common.date') },
      { key: 'type', label: t('common.type'), render: (row) => <StatusBadge status={row.type} /> },
      { key: 'category', label: t('common.category') },
      { key: 'party', label: t('common.customerSupplier') },
      { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
      { key: 'description', label: t('common.description') },
    ],
    inventory: [
      { key: 'product', label: t('common.product') },
      { key: 'warehouse', label: t('warehouse.warehouse') },
      { key: 'quantity', label: t('common.quantity') },
      { key: 'unit', label: t('common.unit') },
      { key: 'availableCapacity', label: t('warehouse.availableCapacity') },
    ],
    'customer-account': [
      { key: 'name', label: t('common.customerName') },
      { key: 'cashAccount', label: t('customers.cashBalance'), render: (row) => formatCurrency(row.cashAccount) },
      { key: 'commodityBalance', label: t('customers.commodityBalance') },
      { key: 'payments', label: t('customers.paymentHistory') },
      { key: 'orders', label: t('customers.orderHistory') },
      { key: 'statement', label: t('customers.customerStatement') },
    ],
    orders: [
      { key: 'orderNo', label: t('orders.orderId') },
      { key: 'customer', label: t('common.customer') },
      { key: 'product', label: t('common.product') },
      { key: 'quantity', label: t('common.quantity') },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
      { key: 'date', label: t('common.date') },
    ],
    shipment: [
      { key: 'shipmentId', label: t('shipments.shipmentId') },
      { key: 'orderNo', label: t('common.orderNumber') },
      { key: 'customer', label: t('common.customer') },
      { key: 'product', label: t('common.product') },
      { key: 'warehouse', label: t('warehouse.warehouse') },
      { key: 'numberOfBags', label: t('shipments.numberOfBags') },
      { key: 'totalWeight', label: t('shipments.totalWeight'), render: (row) => `${row.totalWeight.toLocaleString()} kg` },
      { key: 'driver', label: t('warehouse.driverName') },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    ],
    'financial-summary': [
      { key: 'label', label: t('reports.report') },
      { key: 'value', label: t('common.mainValue') },
    ],
  };

  function selectedRows() {
    if (selectedReportId === 'daily-journal') return reportContent.filteredJournal;
    if (selectedReportId === 'inventory') return reportContent.inventoryRows;
    if (selectedReportId === 'customer-account') return reportContent.customerRows;
    if (selectedReportId === 'orders') return reportContent.orderRows;
    if (selectedReportId === 'shipment') return reportContent.shipmentRows;
    if (selectedReportId === 'financial-summary') return reportContent.financialRows;
    return [];
  }

  return (
    <div className="page-grid workflow-page">
      {!selectedReport && (
        <Card title={t('reports.title')} subtitle={t('reports.subtitle')}>
          <div className="report-card-grid">
            {reportTypes.map((report) => (
              <div className="report-category-card" key={report.id}>
                <div>
                  <strong>{t(report.titleKey)}</strong>
                  <p>{t(report.descriptionKey)}</p>
                </div>
                <Button variant="secondary" onClick={() => setSelectedReportId(report.id)}>{t('reports.viewReport')}</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {selectedReport && (
        <Card title={t(selectedReport.titleKey)} subtitle={t(selectedReport.descriptionKey)}>
          <div className="workflow-toolbar workflow-toolbar--split">
            <Button variant="secondary" onClick={resetReport}>{t('reports.backToReports')}</Button>
            <div className="workflow-actions">
              <Button variant="secondary" onClick={() => window.print()}>{t('reports.printReport')}</Button>
              <Button variant="secondary" onClick={() => window.print()}>{t('reports.exportPdf')}</Button>
            </div>
          </div>

          <div className="report-filter-grid">
            <label>{t('reports.fromDate')}<input name="fromDate" type="date" value={filters.fromDate} onChange={handleFilterChange} /></label>
            <label>{t('reports.toDate')}<input name="toDate" type="date" value={filters.toDate} onChange={handleFilterChange} /></label>
            <label>{t('common.customer')}<select name="customer" value={filters.customer} onChange={handleFilterChange}><option value="">{t('reports.all')}</option>{customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.name}</option>)}</select></label>
            <label>{t('warehouse.warehouse')}<select name="warehouse" value={filters.warehouse} onChange={handleFilterChange}><option value="">{t('reports.all')}</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.warehouseName}>{warehouse.warehouseName}</option>)}</select></label>
            <label>{t('common.product')}<select name="product" value={filters.product} onChange={handleFilterChange}><option value="">{t('reports.all')}</option>{[...new Set(orders.map((order) => order.product))].map((product) => <option key={product} value={product}>{product}</option>)}</select></label>
            <label>{t('common.status')}<select name="status" value={filters.status} onChange={handleFilterChange}><option value="">{t('reports.all')}</option>{['Pending', 'Approved', 'Completed', 'Cancelled', 'Pending Approval', 'In Transit'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </div>

          {selectedReportId === 'daily-journal' && (
            <div className="summary-grid summary-grid--four">
              <Card className="summary-card"><p>{t('journal.openingBalance')}</p><strong>{formatCurrency(reportContent.journalSummary.opening)}</strong></Card>
              <Card className="summary-card"><p>{t('journal.totalIncome')}</p><strong>{formatCurrency(reportContent.journalSummary.income)}</strong></Card>
              <Card className="summary-card"><p>{t('journal.totalExpenses')}</p><strong>{formatCurrency(reportContent.journalSummary.expenses)}</strong></Card>
              <Card className="summary-card"><p>{t('journal.closingBalance')}</p><strong>{formatCurrency(reportContent.journalSummary.closing)}</strong></Card>
            </div>
          )}

          <Table columns={columnsByReport[selectedReportId]} rows={selectedRows()} />
        </Card>
      )}
    </div>
  );
}
