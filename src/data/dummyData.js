export const dashboardSummary = [
  { labelKey: 'dashboard.dailyCashBalance', value: 'SDG 1,245,000', noteKey: 'dashboard.dailyCashBalanceNote' },
  { labelKey: 'dashboard.totalInventory', value: '4,870 bags', noteKey: 'dashboard.totalInventoryNote' },
  { labelKey: 'dashboard.customerDebts', value: 'SDG 620,000', noteKey: 'dashboard.customerDebtsNote' },
  { labelKey: 'dashboard.pendingOrders', value: '8', noteKey: 'dashboard.pendingOrdersNote' },
  { labelKey: 'dashboard.pendingShipments', value: '5', noteKey: 'dashboard.pendingShipmentsNote' },
  { labelKey: 'dashboard.totalSales', value: 'SDG 3,850,000', noteKey: 'dashboard.totalSalesNote' },
];

export const warehouses = [
  { id: 1, name: 'Main Warehouse', location: 'Market Road', capacity: '3,000 bags', currentStock: 2460, status: 'Good' },
  { id: 2, name: 'North Store', location: 'Truck Yard', capacity: '1,500 bags', currentStock: 1210, status: 'Good' },
  { id: 3, name: 'Spare Store', location: 'Old Depot', capacity: '1,200 bags', currentStock: 430, status: 'Low Activity' },
];

export const products = [
  { id: 1, name: 'White Sesame', category: 'Commodity', unit: 'Bag / Jowal', price: 82000, stock: 1280, status: 'Available' },
  { id: 2, name: 'Red Sesame', category: 'Commodity', unit: 'Bag / Jowal', price: 76000, stock: 940, status: 'Available' },
  { id: 3, name: 'Corn', category: 'Commodity', unit: 'Bag / Jowal', price: 42000, stock: 1980, status: 'Available' },
  { id: 4, name: 'Sacks / Khaysh', category: 'Packaging', unit: 'Piece', price: 1100, stock: 420, status: 'Low Stock' },
  { id: 5, name: 'Plastic', category: 'Packaging', unit: 'Roll', price: 18500, stock: 85, status: 'Available' },
  { id: 6, name: 'Dabara', category: 'Packaging', unit: 'Bundle', price: 7200, stock: 33, status: 'Low Stock' },
];

export const commodityUnits = [
  { value: 'Qintar', englishLabel: 'Qintar (قنطار)', arabicLabel: 'قنطار' },
  { value: 'Large Bag', englishLabel: 'Large Bag (جوال كبير)', arabicLabel: 'جوال كبير' },
  { value: 'Small Bag', englishLabel: 'Small Bag (جوال صغير)', arabicLabel: 'جوال صغير' },
  { value: 'Piece', englishLabel: 'Piece (حبة)', arabicLabel: 'حبة' },
  { value: 'Bale', englishLabel: 'Bale (بالة)', arabicLabel: 'بالة' },
  { value: 'Number of Sacks', englishLabel: 'Number of Sacks (عدد جوالات)', arabicLabel: 'عدد جوالات' },
  { value: 'Roll', englishLabel: 'Roll (لفة)', arabicLabel: 'لفة' },
  { value: 'Meter', englishLabel: 'Meter (متر)', arabicLabel: 'متر' },
];

export const commodityProductLabels = {
  'White Sesame': { en: 'White Sesame', ar: 'سمسم أبيض' },
  'Red Sesame': { en: 'Red Sesame', ar: 'سمسم أحمر' },
  Corn: { en: 'Corn', ar: 'ذرة' },
  'Sacks / Khaysh': { en: 'Sacks / Khaysh', ar: 'خيش / جوالات' },
  Plastic: { en: 'Plastic', ar: 'بلاستيك' },
  Dabara: { en: 'Dabara', ar: 'دبارة' },
};

export const journalEntries = [
  { id: 1, date: '2026-05-17', time: '09:20', type: 'Income', category: 'Sales Payment', amount: 280000, description: 'Partial payment for sesame order', party: 'Al-Noor Trading' },
  { id: 2, date: '2026-05-17', time: '11:45', type: 'Expense', category: 'Transport', amount: 45000, description: 'Truck loading to central market', party: 'Hassan Transport' },
  { id: 3, date: '2026-05-16', time: '10:10', type: 'Income', category: 'Cash Sale', amount: 190000, description: 'Corn cash sale', party: 'Omdurman Buyer' },
  { id: 4, date: '2026-05-16', time: '15:30', type: 'Expense', category: 'Warehouse Labor', amount: 25000, description: 'Daily loading workers', party: 'Warehouse Team' },
];

export const commodityJournalEntries = [
  { id: 101, date: '2026-05-17', product: 'White Sesame', quantity: 60, unit: 'Qintar', party: 'Al-Noor Trading', lahuWaAlayh: 'Lahu', estimatedValue: 4920000, description: 'Sesame delivered on account' },
  { id: 102, date: '2026-05-17', product: 'Corn', quantity: 120, unit: 'Large Bag', party: 'Blue Nile Stores', lahuWaAlayh: 'Alayh', estimatedValue: 5040000, description: 'Corn reserved for pending balance' },
  { id: 103, date: '2026-05-16', product: 'Red Sesame', quantity: 25, unit: 'Qintar', party: 'Central Market Buyer', lahuWaAlayh: 'Lahu', estimatedValue: 1900000, description: 'Red sesame customer account entry' },
  { id: 104, date: '2026-05-16', product: 'Dabara', quantity: 12, unit: 'Piece', party: 'Warehouse Team', lahuWaAlayh: 'Alayh', estimatedValue: 86400, description: 'Dabara issued for shipment preparation' },
  { id: 105, date: '2026-05-15', product: 'Sacks / Khaysh', quantity: 6, unit: 'Bale', party: 'Packaging Supplier', lahuWaAlayh: 'Alayh', estimatedValue: 330000, description: 'Khaysh packaging received on account' },
  { id: 106, date: '2026-05-15', product: 'Plastic', quantity: 18, unit: 'Roll', party: 'Hamad Agro Supply', lahuWaAlayh: 'Lahu', estimatedValue: 333000, description: 'Plastic rolls recorded for commodity account' },
];

export const customers = [
  { id: 1, name: 'Al-Noor Trading', phone: '+249 91 222 1100', cashAccount: 420000, commodityAccount: 'White Sesame 60 bags', debtBalance: 180000, status: 'Debtor' },
  { id: 2, name: 'Blue Nile Stores', phone: '+249 92 830 7711', cashAccount: 0, commodityAccount: 'Corn 120 bags', debtBalance: 0, status: 'Balanced' },
  { id: 3, name: 'Hamad Agro Supply', phone: '+249 90 441 6520', cashAccount: -95000, commodityAccount: 'Red Sesame 25 bags', debtBalance: 95000, status: 'Creditor' },
  { id: 4, name: 'Central Market Buyer', phone: '+249 99 118 2005', cashAccount: 70000, commodityAccount: 'None', debtBalance: 70000, status: 'Debtor' },
];

export const paymentHistory = [
  { id: 1, date: '2026-05-17', customer: 'Al-Noor Trading', amount: 280000, method: 'Cash', note: 'Partial settlement' },
  { id: 2, date: '2026-05-14', customer: 'Central Market Buyer', amount: 70000, method: 'Bank Transfer', note: 'Remaining balance' },
  { id: 3, date: '2026-05-11', customer: 'Blue Nile Stores', amount: 530000, method: 'Cash', note: 'Full payment' },
];

export const orders = [
  { id: 1, orderNo: 'ORD-1001', customer: 'Al-Noor Trading', product: 'White Sesame', quantity: '60 bags', totalAmount: 4920000, status: 'Pending' },
  { id: 2, orderNo: 'ORD-1002', customer: 'Blue Nile Stores', product: 'Corn', quantity: '120 bags', totalAmount: 5040000, status: 'Approved' },
  { id: 3, orderNo: 'ORD-1003', customer: 'Central Market Buyer', product: 'Red Sesame', quantity: '25 bags', totalAmount: 1900000, status: 'Shipped' },
  { id: 4, orderNo: 'ORD-1004', customer: 'Hamad Agro Supply', product: 'Sacks / Khaysh', quantity: '300 pieces', totalAmount: 330000, status: 'Completed' },
  { id: 5, orderNo: 'ORD-1005', customer: 'Omdurman Buyer', product: 'Corn', quantity: '40 bags', totalAmount: 1680000, status: 'Cancelled' },
];

export const shipments = [
  { id: 1, batchNo: 'BAT-501', orderNo: 'ORD-1001', customer: 'Al-Noor Trading', grossWeight: 6120, tareWeight: 320, netWeight: 5800, status: 'Pending Approval', tracking: 'At warehouse gate' },
  { id: 2, batchNo: 'BAT-502', orderNo: 'ORD-1002', customer: 'Blue Nile Stores', grossWeight: 12450, tareWeight: 450, netWeight: 12000, status: 'Approved', tracking: 'Loaded on truck' },
  { id: 3, batchNo: 'BAT-503', orderNo: 'ORD-1003', customer: 'Central Market Buyer', grossWeight: 2600, tareWeight: 180, netWeight: 2420, status: 'In Transit', tracking: 'On route to customer' },
];

export const invoices = [
  { id: 1, invoiceNo: 'INV-9001', customer: 'Al-Noor Trading', orderNo: 'ORD-1001', totalAmount: 4920000, paidAmount: 280000, status: 'Partially Paid' },
  { id: 2, invoiceNo: 'INV-9002', customer: 'Blue Nile Stores', orderNo: 'ORD-1002', totalAmount: 5040000, paidAmount: 5040000, status: 'Paid' },
  { id: 3, invoiceNo: 'INV-9003', customer: 'Central Market Buyer', orderNo: 'ORD-1003', totalAmount: 1900000, paidAmount: 1200000, status: 'Unpaid' },
];

export const reports = [
  { titleKey: 'reports.salesReport', periodKey: 'reports.may2026', valueKey: 'reports.salesReportValue', noteKey: 'reports.salesReportNote' },
  { titleKey: 'reports.inventoryReport', periodKey: 'reports.today', valueKey: 'reports.inventoryReportValue', noteKey: 'reports.inventoryReportNote' },
  { titleKey: 'reports.financialSummary', periodKey: 'reports.today', valueKey: 'reports.financialSummaryValue', noteKey: 'reports.financialSummaryNote' },
  { titleKey: 'reports.customerDebtReport', periodKey: 'reports.may2026', valueKey: 'reports.customerDebtValue', noteKey: 'reports.customerDebtNote' },
  { titleKey: 'reports.warehouseReport', periodKey: 'reports.today', valueKey: 'reports.warehouseReportValue', noteKey: 'reports.warehouseReportNote' },
  { titleKey: 'reports.dailyJournalReport', periodKey: 'reports.today', valueKey: 'reports.dailyJournalValue', noteKey: 'reports.dailyJournalNote' },
];

export function formatCurrency(value) {
  return `SDG ${value.toLocaleString()}`;
}
