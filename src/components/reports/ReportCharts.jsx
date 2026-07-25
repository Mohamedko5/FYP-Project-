import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#4d6b4a', '#8a6c2f', '#7a6043', '#8a4b3f', '#4a6b68', '#684a6b', '#354b33', '#9c826b'];

const chartTitles = {
  en: {
    incomeVsExpenses: 'Income vs Expenses',
    balanceTrend: 'Daily Movement Trend',
    paymentMethods: 'Payment Methods Distribution',
    stockByWarehouse: 'Stock Quantity by Warehouse',
    topProducts: 'Top Products by Quantity',
    warehouseStockDistribution: 'Stock Distribution by Warehouse',
    invoicePaymentStatus: 'Paid vs Unpaid Invoices Count',
    invoiceValues: 'Invoice Totals & Outstanding Values',
    invoiceStatusDistribution: 'Invoice Status Distribution',
    paymentMethodsDistribution: 'Payment Methods Distribution',
    ordersByStatus: 'Orders Count by Status',
    ordersTrend: 'Orders Created Over Time',
    topCustomersByOrders: 'Top Customers by Orders Count',
    shipmentsByStatus: 'Shipments by Status',
    shipmentsByWarehouse: 'Shipments Quantity by Warehouse',
    topShippedProducts: 'Top Shipped Products',
    topCustomersByPurchases: 'Top Customers by Debits / Invoices',
    topCustomersByPayments: 'Top Customers by Payments Received',
    customerTypes: 'Customer Debt Status Distribution',
    workersByStatus: 'Workers Status Distribution',
    wagesPaidVsUnpaid: 'Wages Paid vs Unpaid by Worker',
    financialOverview: 'Financial Summary Overview',
    emptyData: 'No sufficient data to display the chart',
  },
  ar: {
    incomeVsExpenses: 'الإيرادات مقابل المصروفات',
    balanceTrend: 'اتجاه المعاملات اليومية',
    paymentMethods: 'توزيع طرق الدفع',
    stockByWarehouse: 'كميات المخزون حسب المخزن',
    topProducts: 'أعلى المنتجات حسب الكمية',
    warehouseStockDistribution: 'توزيع المخزون على المخازن',
    invoicePaymentStatus: 'عدد الفواتير المدفوعة مقابل غير المدفوعة',
    invoiceValues: 'إجمالي الفواتير والمبالغ المستحقة',
    invoiceStatusDistribution: 'توزيع حالات الفواتير',
    paymentMethodsDistribution: 'توزيع طرق الدفع للفواتير',
    ordersByStatus: 'عدد الطلبات حسب الحالة',
    ordersTrend: 'الطلبات المنشأة عبر الزمن',
    topCustomersByOrders: 'أعلى العملاء من حيث عدد الطلبات',
    shipmentsByStatus: 'الشحنات حسب الحالة',
    shipmentsByWarehouse: 'كميات الشحن حسب المخزن',
    topShippedProducts: 'أعلى المنتجات شحناً',
    topCustomersByPurchases: 'أعلى العملاء مديونية / فواتير',
    topCustomersByPayments: 'أعلى العملاء سداداً للمدفوعات',
    customerTypes: 'توزيع حالات ديون العملاء',
    workersByStatus: 'توزيع العمال حسب الحالة',
    wagesPaidVsUnpaid: 'الأجور المدفوعة مقابل غير المدفوعة',
    financialOverview: 'نظرة عامة على الملخص المالي',
    emptyData: 'لا توجد بيانات كافية لعرض الرسم البياني',
  },
};

function ChartContainer({ title, children, hasData, emptyText }) {
  return (
    <div className="report-chart-card">
      {title && <h3 className="report-chart-card__title">{title}</h3>}
      {!hasData ? (
        <div className="report-chart-empty">
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="report-chart-wrapper">
          <ResponsiveContainer width="100%" height={260}>
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ReportCharts({ reportId, summary, rows = [], isArabic = false }) {
  const titles = chartTitles[isArabic ? 'ar' : 'en'];

  if (!reportId) return null;

  // 1. DAILY JOURNAL CHARTS
  if (reportId === 'daily-journal') {
    const income = Number(summary?.total_income || 0);
    const expenses = Number(summary?.total_expenses || 0);
    const hasIncExp = income > 0 || expenses > 0;
    const incExpData = [
      { name: isArabic ? 'الإيرادات' : 'Income', value: income, fill: '#4d6b4a' },
      { name: isArabic ? 'المصروفات' : 'Expenses', value: expenses, fill: '#8a4b3f' },
    ];

    const cashTot = Number(summary?.cash_total || 0);
    const onlineTot = Number(summary?.online_total || 0);
    const hasPayMethod = cashTot > 0 || onlineTot > 0;
    const payMethodData = [
      { name: isArabic ? 'نقداً' : 'Cash', value: cashTot },
      { name: isArabic ? 'إلكتروني' : 'Electronic / Online', value: onlineTot },
    ].filter((d) => d.value > 0);

    const dateMap = {};
    (rows || []).forEach((row) => {
      const d = row.date ? row.date.split('T')[0] : 'Unknown';
      if (!dateMap[d]) dateMap[d] = { date: d, income: 0, expense: 0 };
      const amt = Number(row.amount || 0);
      if (row.type === 'income') dateMap[d].income += amt;
      else dateMap[d].expense += amt;
    });
    const trendData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    const hasTrend = trendData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.incomeVsExpenses} hasData={hasIncExp} emptyText={titles.emptyData}>
          <BarChart data={incExpData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(value) => [`SDG ${Number(value).toLocaleString()}`, '']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {incExpData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.paymentMethods} hasData={hasPayMethod} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={payMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(entry) => `${entry.name}: SDG ${Number(entry.value).toLocaleString()}`}>
              {payMethodData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value) => [`SDG ${Number(value).toLocaleString()}`, '']} />
            <Legend />
          </PieChart>
        </ChartContainer>

        <ChartContainer title={titles.balanceTrend} hasData={hasTrend} emptyText={titles.emptyData}>
          <LineChart data={trendData}>
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip formatter={(value) => [`SDG ${Number(value).toLocaleString()}`, '']} />
            <Legend />
            <Line type="monotone" dataKey="income" name={isArabic ? 'الإيرادات' : 'Income'} stroke="#4d6b4a" strokeWidth={2} />
            <Line type="monotone" dataKey="expense" name={isArabic ? 'المصروفات' : 'Expenses'} stroke="#8a4b3f" strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </div>
    );
  }

  // 2. INVENTORY REPORT CHARTS
  if (reportId === 'inventory') {
    const whDist = (summary?.warehouse_distribution || []).map((w) => ({
      name: w.warehouse_name,
      quantity: Number(w.quantity || 0),
    }));
    const hasWhDist = whDist.some((d) => d.quantity > 0);

    const topProd = (summary?.groups || []).map((g) => ({
      name: `${g.product_name} (${g.unit})`,
      quantity: Number(g.quantity || 0),
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const hasTopProd = topProd.some((d) => d.quantity > 0);

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.stockByWarehouse} hasData={hasWhDist} emptyText={titles.emptyData}>
          <BarChart data={whDist}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(value) => [Number(value).toLocaleString(), isArabic ? 'الكمية' : 'Quantity']} />
            <Bar dataKey="quantity" fill="#4d6b4a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.topProducts} hasData={hasTopProd} emptyText={titles.emptyData}>
          <BarChart data={topProd} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} />
            <RechartsTooltip formatter={(value) => [Number(value).toLocaleString(), isArabic ? 'الكمية' : 'Quantity']} />
            <Bar dataKey="quantity" fill="#7a6043" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.warehouseStockDistribution} hasData={hasWhDist} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={whDist} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => e.name}>
              {whDist.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value) => [Number(value).toLocaleString(), '']} />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 3. INVOICES REPORT CHARTS
  if (reportId === 'invoices') {
    const paidCnt = Number(summary?.paid_count || 0);
    const unpaidCnt = Number(summary?.unpaid_count || 0);
    const cancCnt = Number(summary?.cancelled_count || 0);
    const hasPayStatus = paidCnt > 0 || unpaidCnt > 0;

    const payStatusData = [
      { name: isArabic ? 'مدفوعة' : 'Paid', value: paidCnt, fill: '#4d6b4a' },
      { name: isArabic ? 'غير مدفوعة' : 'Unpaid', value: unpaidCnt, fill: '#8a6c2f' },
      { name: isArabic ? 'ملغاة' : 'Cancelled', value: cancCnt, fill: '#8a4b3f' },
    ].filter((d) => d.value > 0);

    const paidVal = Number(summary?.total_paid_value || 0);
    const outVal = Number(summary?.total_outstanding_value || 0);
    const hasValues = paidVal > 0 || outVal > 0;
    const valueData = [
      { name: isArabic ? 'المبالغ المدفوعة' : 'Paid Value', amount: paidVal, fill: '#4d6b4a' },
      { name: isArabic ? 'المبالغ المستحقة' : 'Outstanding Value', amount: outVal, fill: '#8a6c2f' },
    ];

    const methodCounts = summary?.payment_method_counts || {};
    const methodData = Object.entries(methodCounts).map(([k, v]) => ({
      name: k === 'cash' ? (isArabic ? 'نقداً' : 'Cash') : k === 'online' ? (isArabic ? 'إلكتروني' : 'Online') : (k || (isArabic ? 'غير محدد' : 'Unspecified')),
      value: v,
    })).filter((d) => d.value > 0);
    const hasMethodData = methodData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.invoicePaymentStatus} hasData={hasPayStatus} emptyText={titles.emptyData}>
          <BarChart data={payStatusData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {payStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.invoiceValues} hasData={hasValues} emptyText={titles.emptyData}>
          <BarChart data={valueData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(val) => [`SDG ${Number(val).toLocaleString()}`, '']} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {valueData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.paymentMethodsDistribution} hasData={hasMethodData} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => `${e.name}: ${e.value}`}>
              {methodData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 4. ORDERS REPORT CHARTS
  if (reportId === 'orders') {
    const statusCounts = summary?.status_counts || {};
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      count,
    }));
    const hasStatus = statusData.length > 0;

    const custMap = {};
    (rows || []).forEach((row) => {
      const c = row.customer || 'Unknown';
      custMap[c] = (custMap[c] || 0) + 1;
    });
    const topCustData = Object.entries(custMap)
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);
    const hasCust = topCustData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.ordersByStatus} hasData={hasStatus} emptyText={titles.emptyData}>
          <BarChart data={statusData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Bar dataKey="count" fill="#4d6b4a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.topCustomersByOrders} hasData={hasCust} emptyText={titles.emptyData}>
          <BarChart data={topCustData} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={110} />
            <RechartsTooltip />
            <Bar dataKey="orders" fill="#7a6043" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.ordersByStatus} hasData={hasStatus} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={statusData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => `${e.name}: ${e.count}`}>
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 5. SHIPMENTS REPORT CHARTS
  if (reportId === 'shipments') {
    const statusCounts = summary?.status_counts || {};
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      count,
    }));
    const hasStatus = statusData.length > 0;

    const shippedGroups = (summary?.completed_item_groups || []).map((g) => ({
      name: `${g.product_name} (${g.unit})`,
      quantity: Number(g.quantity || 0),
    }));
    const hasGroups = shippedGroups.length > 0;

    const whMap = {};
    (rows || []).forEach((r) => {
      const wh = r.warehouse || 'Unassigned';
      const qty = Number(r.actual_quantity || 0);
      whMap[wh] = (whMap[wh] || 0) + qty;
    });
    const whData = Object.entries(whMap).map(([name, quantity]) => ({ name, quantity }));
    const hasWh = whData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.shipmentsByStatus} hasData={hasStatus} emptyText={titles.emptyData}>
          <BarChart data={statusData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Bar dataKey="count" fill="#4a6b68" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.topShippedProducts} hasData={hasGroups} emptyText={titles.emptyData}>
          <BarChart data={shippedGroups} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={110} />
            <RechartsTooltip />
            <Bar dataKey="quantity" fill="#4d6b4a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.shipmentsByWarehouse} hasData={hasWh} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={whData} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => e.name}>
              {whData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 6. CUSTOMER ACCOUNTS CHARTS
  if (reportId === 'customer-accounts') {
    const topDebits = (rows || [])
      .map((r) => ({ name: r.customer_name, debits: Number(r.total_debits || 0) }))
      .sort((a, b) => b.debits - a.debits)
      .slice(0, 8);
    const hasDebits = topDebits.some((d) => d.debits > 0);

    const topPayments = (rows || [])
      .map((r) => ({ name: r.customer_name, payments: Number(r.total_payments_received || 0) }))
      .sort((a, b) => b.payments - a.payments)
      .slice(0, 8);
    const hasPayments = topPayments.some((d) => d.payments > 0);

    const statusCounts = {};
    (rows || []).forEach((r) => {
      const st = r.cash_status || 'Balanced';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    const hasStatus = statusData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.topCustomersByPurchases} hasData={hasDebits} emptyText={titles.emptyData}>
          <BarChart data={topDebits} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={110} />
            <RechartsTooltip formatter={(v) => [`SDG ${Number(v).toLocaleString()}`, '']} />
            <Bar dataKey="debits" fill="#8a6c2f" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.topCustomersByPayments} hasData={hasPayments} emptyText={titles.emptyData}>
          <BarChart data={topPayments} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={110} />
            <RechartsTooltip formatter={(v) => [`SDG ${Number(v).toLocaleString()}`, '']} />
            <Bar dataKey="payments" fill="#4d6b4a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.customerTypes} hasData={hasStatus} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => `${e.name}: ${e.value}`}>
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 7. WORKERS REPORT CHARTS
  if (reportId === 'workers') {
    const workerWages = (rows || [])
      .map((r) => ({
        name: r.worker_name,
        paid: Number(r.paid_wages || 0),
        unpaid: Number(r.unpaid_wages || 0),
      }))
      .slice(0, 10);
    const hasWages = workerWages.some((w) => w.paid > 0 || w.unpaid > 0);

    const typeCounts = {};
    (rows || []).forEach((r) => {
      const tp = r.worker_type || 'General';
      typeCounts[tp] = (typeCounts[tp] || 0) + 1;
    });
    const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
    const hasTypes = typeData.length > 0;

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.wagesPaidVsUnpaid} hasData={hasWages} emptyText={titles.emptyData}>
          <BarChart data={workerWages}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(v) => [`SDG ${Number(v).toLocaleString()}`, '']} />
            <Legend />
            <Bar dataKey="paid" name={isArabic ? 'مدفوعة' : 'Paid'} fill="#4d6b4a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="unpaid" name={isArabic ? 'غير مدفوعة' : 'Unpaid'} fill="#8a6c2f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={titles.workersByStatus} hasData={hasTypes} emptyText={titles.emptyData}>
          <PieChart>
            <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => `${e.name}: ${e.value}`}>
              {typeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  // 8. FINANCIAL SUMMARY CHARTS
  if (reportId === 'financial-summary') {
    const cashInc = Number(summary?.cash?.income || 0);
    const cashExp = Number(summary?.cash?.expenses || 0);
    const invPaid = Number(summary?.invoices?.paid_value || 0);
    const invOut = Number(summary?.invoices?.outstanding_value || 0);
    const custDebt = Number(summary?.customers?.total_debt || 0);
    const workerUnpaid = Number(summary?.workers?.unpaid_wages || 0);

    const finData = [
      { name: isArabic ? 'إيرادات النقد' : 'Cash Income', value: cashInc, fill: '#4d6b4a' },
      { name: isArabic ? 'مصروفات النقد' : 'Cash Expenses', value: cashExp, fill: '#8a4b3f' },
      { name: isArabic ? 'فواتير مدفوعة' : 'Paid Invoices', value: invPaid, fill: '#354b33' },
      { name: isArabic ? 'فواتير مستحقة' : 'Outstanding Invoices', value: invOut, fill: '#8a6c2f' },
      { name: isArabic ? 'ديون العملاء' : 'Customer Debts', value: custDebt, fill: '#7a6043' },
      { name: isArabic ? 'أجور عمال مستحقة' : 'Unpaid Worker Wages', value: workerUnpaid, fill: '#9c826b' },
    ];
    const hasFinData = finData.some((d) => d.value > 0);

    return (
      <div className="report-charts-grid">
        <ChartContainer title={titles.financialOverview} hasData={hasFinData} emptyText={titles.emptyData}>
          <BarChart data={finData}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(v) => [`SDG ${Number(v).toLocaleString()}`, '']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {finData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    );
  }

  return null;
}
