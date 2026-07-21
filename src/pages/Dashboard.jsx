import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  ModulePageHeader,
  StatGrid,
  SummaryCard,
} from '../components/ui/ModuleInterface.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getDailyJournalSummary, listJournalTransactions } from '../services/dailyJournalApi.js';
import { getInventoryMovements, getInventorySummary, getWarehouses } from '../services/inventoryApi.js';
import { getInvoiceSummary, getInvoices } from '../services/invoicesApi.js';
import { getOrderSummary, getOrders } from '../services/ordersApi.js';
import { getShipmentSummary, getShipments } from '../services/shipmentsApi.js';

const copy = {
  en: {
    title: 'Dashboard',
    description: 'Executive overview for cash, orders, invoices, shipments, inventory, and alerts.',
    welcome: 'Welcome back. Values below come from live ERP modules where available.',
    refresh: 'Refresh',
    lastRefresh: 'Last refresh',
    currentDate: 'Interface date',
    cash: 'Current Cash Balance',
    income: "Today's Income",
    expenses: "Today's Expenses",
    net: 'Net Movement',
    activeOrders: 'Active Orders',
    unpaidInvoices: 'Unpaid Invoices',
    readyShipments: 'Ready for Shipment',
    processingShipments: 'Processing Shipments',
    activeWarehouses: 'Active Warehouses',
    lowStock: 'Low Stock Items',
    inventoryOverview: 'Inventory Overview',
    warehouseAttention: 'Warehouses needing attention',
    workflow: 'Order and Shipment Workflow',
    recentActivity: 'Recent Activity',
    alerts: 'Alerts and Attention',
    noAlerts: 'No urgent alerts.',
    noActivity: 'No recent activity found.',
    partial: 'Some modules could not load. Available data is still shown.',
    latest: 'Latest live records',
    stockNote: 'Grouped by product and unit',
  },
  ar: {
    title: 'لوحة التحكم',
    description: 'نظرة تنفيذية على النقد والطلبات والفواتير والشحنات والمخزون والتنبيهات.',
    welcome: 'مرحبا بك. القيم المعروضة تأتي من وحدات النظام الحقيقية عند توفرها.',
    refresh: 'تحديث',
    lastRefresh: 'آخر تحديث',
    currentDate: 'تاريخ الواجهة',
    cash: 'الرصيد النقدي الحالي',
    income: 'دخل اليوم',
    expenses: 'مصروفات اليوم',
    net: 'صافي الحركة',
    activeOrders: 'الطلبات النشطة',
    unpaidInvoices: 'الفواتير غير المدفوعة',
    readyShipments: 'جاهزة للشحن',
    processingShipments: 'الشحن قيد التنفيذ',
    activeWarehouses: 'المخازن النشطة',
    lowStock: 'عناصر مخزون منخفض',
    inventoryOverview: 'نظرة على المخزون',
    warehouseAttention: 'مخازن تحتاج متابعة',
    workflow: 'مسار الطلب والشحن',
    recentActivity: 'آخر النشاطات',
    alerts: 'التنبيهات والمتابعة',
    noAlerts: 'لا توجد تنبيهات عاجلة.',
    noActivity: 'لا توجد نشاطات حديثة.',
    partial: 'بعض الوحدات لم يتم تحميلها، وتم عرض البيانات المتوفرة.',
    latest: 'آخر السجلات الحية',
    stockNote: 'مجمعة حسب المنتج والوحدة',
  },
};

function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(value, unit = '') {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

function statusText(value) {
  const labels = {
    income: 'Income',
    expense: 'Expense',
    pending: 'Pending',
    received: 'Received',
    invoiced: 'Invoiced',
    ready_for_shipment: 'Ready for Shipment',
    processing: 'Processing',
    completed: 'Completed',
    paid: 'Paid',
    unpaid: 'Unpaid',
    shipment_out: 'Withdraw Stock',
    add_stock: 'Add Stock',
    Low: 'Low Stock',
    'Almost Full': 'Almost Full',
    Full: 'Full',
  };
  return labels[value] || value || '-';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { t, isArabic } = useLanguage();
  const label = copy[isArabic ? 'ar' : 'en'];
  const [data, setData] = useState({
    journalSummary: null,
    orderSummary: null,
    invoiceSummary: null,
    shipmentSummary: null,
    inventorySummary: null,
    warehouses: [],
    journalRows: [],
    orders: [],
    invoices: [],
    shipments: [],
    movements: [],
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const requests = [
      ['journalSummary', getDailyJournalSummary({ date: today() })],
      ['orderSummary', getOrderSummary()],
      ['invoiceSummary', getInvoiceSummary()],
      ['shipmentSummary', getShipmentSummary()],
      ['inventorySummary', getInventorySummary()],
      ['warehouses', getWarehouses({ is_active: true, page_size: 100 })],
      ['journalRows', listJournalTransactions({ ordering: '-created_at', page_size: 6 })],
      ['orders', getOrders({ ordering: '-created_at', page_size: 4 })],
      ['invoices', getInvoices({ ordering: '-issued_at', page_size: 4 })],
      ['shipments', getShipments({ page_size: 4 })],
      ['movements', getInventoryMovements({ ordering: '-created_at', page_size: 4 })],
    ];
    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const next = {};
    const nextErrors = [];
    results.forEach((result, index) => {
      const key = requests[index][0];
      if (result.status === 'fulfilled') {
        next[key] = ['warehouses', 'journalRows', 'orders', 'invoices', 'shipments', 'movements'].includes(key)
          ? unwrap(result.value)
          : result.value;
      } else {
        nextErrors.push(`${key}: ${result.reason?.message || 'Unable to load data.'}`);
      }
    });
    setData((current) => ({ ...current, ...next }));
    setErrors(nextErrors);
    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeOrders = (data.orderSummary?.pending_orders || 0) + (data.orderSummary?.received_orders || 0) + (data.orderSummary?.invoiced_orders || 0);
  const readyShipments = data.shipmentSummary?.ready_count || 0;
  const processingShipments = data.shipmentSummary?.processing_count || 0;
  const cash = data.journalSummary?.cash || {};

  const recentActivity = useMemo(() => [
    ...data.journalRows.map((row) => ({
      id: `journal-${row.id}`,
      type: 'Daily Journal',
      title: row.source_reference || row.party,
      description: `${row.description} / ${money(row.amount)}`,
      date: `${row.date || ''} ${row.time || ''}`.trim(),
      status: row.cash_type || row.journal_type,
      path: '/daily-journal',
    })),
    ...data.orders.map((row) => ({
      id: `order-${row.id}`,
      type: 'Order',
      title: row.order_number,
      description: `${row.customer?.name || '-'} / ${row.product_summary || '-'}`,
      date: `${row.created_date || ''} ${row.created_time || ''}`.trim(),
      status: row.status,
      path: '/orders',
    })),
    ...data.invoices.map((row) => ({
      id: `invoice-${row.id}`,
      type: 'Invoice',
      title: row.invoice_number,
      description: `${row.customer_name || '-'} / ${money(row.total_amount, row.currency)}`,
      date: `${row.issued_date || ''} ${row.issued_time || ''}`.trim(),
      status: row.payment_status,
      path: '/invoices',
    })),
    ...data.shipments.map((row) => ({
      id: `shipment-${row.id}`,
      type: 'Shipment',
      title: row.shipment_number,
      description: `${row.customer_name || '-'} / ${row.product_summary || '-'}`,
      date: `${row.created_date || ''} ${row.created_time || ''}`.trim(),
      status: row.status,
      path: '/weighing-shipment',
    })),
    ...data.movements.map((row) => ({
      id: `movement-${row.id}`,
      type: 'Inventory',
      title: row.source_reference || row.product_name,
      description: `${row.warehouse_name || '-'} / ${qty(row.quantity, row.unit)}`,
      date: `${row.date || ''} ${row.time || ''}`.trim(),
      status: row.movement_type,
      path: '/warehouse-inventory',
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8), [data]);

  const warehouseAlerts = data.warehouses.filter((warehouse) => ['Almost Full', 'Full'].includes(warehouse.status));
  const alerts = [
    ...warehouseAlerts.map((warehouse) => ({
      id: `warehouse-${warehouse.id}`,
      title: warehouse.warehouse_name,
      description: `${warehouse.usage_percent}% capacity`,
      status: warehouse.status,
    })),
    ...(Number(data.inventorySummary?.low_stock_items || 0) > 0 ? [{
      id: 'low-stock',
      title: label.lowStock,
      description: `${data.inventorySummary.low_stock_items} items`,
      status: 'Low Stock',
    }] : []),
    ...(Number(data.invoiceSummary?.unpaid_invoices || 0) > 0 ? [{
      id: 'unpaid-invoices',
      title: label.unpaidInvoices,
      description: money(data.invoiceSummary.total_outstanding_value),
      status: 'Unpaid',
    }] : []),
    ...(Number(data.orderSummary?.received_orders || 0) > 0 ? [{
      id: 'orders-waiting',
      title: 'Orders waiting for invoice',
      description: `${data.orderSummary.received_orders} orders`,
      status: 'Received',
    }] : []),
  ];

  const workflow = [
    ['Received Orders', data.orderSummary?.received_orders || 0],
    ['Invoiced', data.orderSummary?.invoiced_orders || 0],
    ['Ready for Shipment', readyShipments],
    ['Processing', processingShipments],
    ['Completed', data.orderSummary?.completed_orders || 0],
  ];
  const maxWorkflow = Math.max(...workflow.map(([, value]) => value), 1);

  return (
    <div className="module-page dashboard-page">
      <ModulePageHeader
        title={label.title}
        description={label.description}
        meta={`${label.currentDate}: ${new Date().toLocaleDateString()}`}
        actions={<Button variant="secondary" onClick={loadDashboard}>{label.refresh}</Button>}
      />

      <Card className="module-card-flat">
        <FilterToolbar actions={lastRefresh && <span className="module-muted">{label.lastRefresh}: {lastRefresh}</span>}>
          <p className="dashboard-welcome">{label.welcome}</p>
        </FilterToolbar>
        {loading && <LoadingState message={t('orders.loading')} />}
        {errors.length > 0 && <ErrorState errors={[label.partial, ...errors.slice(0, 3)]} onRetry={loadDashboard} retryLabel={t('retry')} />}
      </Card>

      <section className="dashboard-financial-card">
        <div>
          <span>{label.cash}</span>
          <strong>{money(cash.closing_balance)}</strong>
        </div>
        <StatGrid>
          <SummaryCard label={label.income} value={money(cash.total_income)} note={today()} tone="good" />
          <SummaryCard label={label.expenses} value={money(cash.total_expenses)} note={today()} tone="warning" />
          <SummaryCard label={label.net} value={money(cash.net)} note="Daily Journal" />
        </StatGrid>
      </section>

      <StatGrid>
        <SummaryCard icon="O" label={label.activeOrders} value={activeOrders} note="Pending, received, invoiced" />
        <SummaryCard icon="I" label={label.unpaidInvoices} value={data.invoiceSummary?.unpaid_invoices ?? 0} note={money(data.invoiceSummary?.total_outstanding_value)} tone="warning" />
        <SummaryCard icon="S" label={label.readyShipments} value={readyShipments} note="Paid invoices ready" />
        <SummaryCard icon="P" label={label.processingShipments} value={processingShipments} note="Inventory not deducted yet" />
        <SummaryCard icon="W" label={label.activeWarehouses} value={data.inventorySummary?.active_warehouses ?? 0} note="Available storage" />
        <SummaryCard icon="L" label={label.lowStock} value={data.inventorySummary?.low_stock_items ?? 0} note="Needs review" tone={data.inventorySummary?.low_stock_items ? 'warning' : 'good'} />
      </StatGrid>

      <div className="dashboard-grid-two">
        <Card title={label.inventoryOverview} subtitle={label.stockNote}>
          <div className="dashboard-inventory-list">
            {(data.inventorySummary?.inventory_groups || []).length === 0 ? <EmptyState title={t('emptyMessage')} /> : data.inventorySummary.inventory_groups.map((group) => (
              <div key={`${group.product_id}-${group.unit}`}>
                <span>{group.product_name}</span>
                <strong>{qty(group.quantity, group.unit)}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title={label.warehouseAttention} subtitle="Usage is shown per warehouse capacity">
          <div className="dashboard-warehouse-list">
            {data.warehouses.length === 0 ? <EmptyState title={t('emptyMessage')} /> : data.warehouses.slice(0, 6).map((warehouse) => (
              <div key={warehouse.id} className="dashboard-warehouse-row">
                <div>
                  <strong>{warehouse.warehouse_name}</strong>
                  <span>{qty(warehouse.used_capacity, warehouse.capacity_unit)} / {qty(warehouse.capacity, warehouse.capacity_unit)}</span>
                </div>
                <div className="module-progress" aria-label={`${warehouse.usage_percent}%`}>
                  <span style={{ width: `${Math.min(Number(warehouse.usage_percent || 0), 100)}%` }} />
                </div>
                <StatusBadge status={warehouse.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={label.workflow} subtitle="Order Received -> Invoice Paid -> Shipment Completed">
        <div className="dashboard-workflow">
          {workflow.map(([name, value]) => (
            <div key={name}>
              <span>{name}</span>
              <strong>{value}</strong>
              <div className="module-progress"><span style={{ width: `${(value / maxWorkflow) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <div className="dashboard-grid-two">
        <Card title={label.recentActivity} subtitle={label.latest}>
          <div className="module-activity-list">
            {recentActivity.length === 0 ? <EmptyState title={label.noActivity} /> : recentActivity.map((activity) => (
              <Link className="module-activity-row" key={activity.id} to={activity.path}>
                <div>
                  <span>{activity.type}</span>
                  <strong>{activity.title}</strong>
                  <small>{activity.description}</small>
                </div>
                <div>
                  <small>{activity.date || '-'}</small>
                  <StatusBadge status={statusText(activity.status)} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card title={label.alerts} subtitle="Important items first">
          <div className="module-activity-list">
            {alerts.length === 0 ? <EmptyState title={label.noAlerts} /> : alerts.map((alert) => (
              <div className="module-activity-row" key={alert.id}>
                <div>
                  <span>{alert.title}</span>
                  <strong>{alert.description}</strong>
                </div>
                <StatusBadge status={statusText(alert.status)} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
