export const dashboardSummary = [
  { labelKey: 'dashboard.dailyCashBalance', value: 'SDG 1,245,000', noteKey: 'dashboard.dailyCashBalanceNote' },
  { labelKey: 'dashboard.totalInventory', value: '4,870 bags', noteKey: 'dashboard.totalInventoryNote' },
  { labelKey: 'dashboard.customerDebts', value: 'SDG 620,000', noteKey: 'dashboard.customerDebtsNote' },
  { labelKey: 'dashboard.pendingOrders', value: '8', noteKey: 'dashboard.pendingOrdersNote' },
  { labelKey: 'dashboard.pendingShipments', value: '5', noteKey: 'dashboard.pendingShipmentsNote' },
  { labelKey: 'dashboard.totalSales', value: 'SDG 3,850,000', noteKey: 'dashboard.totalSalesNote' },
];

export const warehouses = [
  {
    id: 1,
    name: 'Main Warehouse',
    warehouseName: 'Main Warehouse',
    location: 'Market Road',
    capacity: 3000,
    capacityUnit: 'Qintar',
    productType: 'White Sesame',
    managerName: 'Mohamed Ahmed',
    guardName: 'Hassan Ali',
    notes: 'Primary sesame storage near the market.',
    currentStock: 2460,
    status: 'Good',
    storedProducts: [
      { id: 1, productName: 'White Sesame', category: 'Commodity', quantity: 1800, unit: 'Qintar', minimumThreshold: 120 },
      { id: 2, productName: 'Red Sesame', category: 'Commodity', quantity: 660, unit: 'Qintar', minimumThreshold: 100 },
    ],
  },
  {
    id: 2,
    name: 'North Store',
    warehouseName: 'North Store',
    location: 'Truck Yard',
    capacity: 1500,
    capacityUnit: 'Large Bag',
    productType: 'Corn',
    managerName: 'Ibrahim Musa',
    guardName: 'Adam Bashir',
    notes: 'Used for corn received from northern farms.',
    currentStock: 1210,
    status: 'Good',
    storedProducts: [
      { id: 3, productName: 'Corn', category: 'Commodity', quantity: 1210, unit: 'Large Bag', minimumThreshold: 150 },
    ],
  },
  {
    id: 3,
    name: 'Spare Store',
    warehouseName: 'Spare Store',
    location: 'Old Depot',
    capacity: 1200,
    capacityUnit: 'Bale',
    productType: 'Sacks / Khaysh',
    managerName: 'Osman Yousif',
    guardName: 'Sami Khalid',
    notes: 'Packaging materials and emergency overflow space.',
    currentStock: 430,
    status: 'Low Activity',
    storedProducts: [
      { id: 4, productName: 'Sacks / Khaysh', category: 'Packaging', quantity: 390, unit: 'Bale', minimumThreshold: 50 },
      { id: 5, productName: 'Dabara', category: 'Packaging', quantity: 40, unit: 'Piece', minimumThreshold: 60 },
    ],
  },
];

export const inventoryMovementHistory = [
  {
    id: 1,
    warehouseId: 1,
    warehouseName: 'Main Warehouse',
    type: 'Add Stock',
    product: 'White Sesame',
    quantity: 120,
    unit: 'Qintar',
    date: '2026-06-01',
    time: '10:30 AM',
    adminName: 'Admin',
    driverName: 'Hassan Adam',
    notes: 'Received sesame from morning delivery.',
  },
  {
    id: 2,
    warehouseId: 1,
    warehouseName: 'Main Warehouse',
    type: 'Withdraw Stock',
    product: 'Red Sesame',
    quantity: 25,
    unit: 'Qintar',
    date: '2026-06-01',
    time: '11:00 AM',
    adminName: 'Admin',
    driverName: '',
    notes: 'Withdrawn for customer order preparation.',
  },
  {
    id: 3,
    warehouseId: 2,
    warehouseName: 'North Store',
    type: 'Add Stock',
    product: 'Corn',
    quantity: 80,
    unit: 'Large Bag',
    date: '2026-06-01',
    time: '09:45 AM',
    adminName: 'Admin',
    driverName: 'Musa Ali',
    notes: 'Corn received from northern farms.',
  },
];

export const productUnitOptionsByProduct = {
  'White Sesame': [{ value: 'Qintar', label: 'Qintar (قنطار)' }],
  'Red Sesame': [{ value: 'Qintar', label: 'Qintar (قنطار)' }],
  Corn: [
    { value: 'Large Bag', label: 'Large Bag (جوال كبير)' },
    { value: 'Small Bag', label: 'Small Bag (جوال صغير)' },
  ],
  'Sacks / Khaysh': [
    { value: 'Bale', label: 'Bale (بالة)' },
    { value: 'Number of Sacks', label: 'Number of Sacks (عدد جوالات)' },
  ],
  Plastic: [
    { value: 'Bale', label: 'Bale (بالة)' },
    { value: 'Roll', label: 'Roll (لفة)' },
    { value: 'Meter', label: 'Meter (متر)' },
  ],
  Dabara: [{ value: 'Piece', label: 'Piece (حبة)' }],
};

export const warehouseUnitOptionsByProduct = {
  ...productUnitOptionsByProduct,
  Plastic: [
    { value: 'Bale', label: 'Bale (بالة)' },
  ],
};

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
  {
    id: 1,
    name: 'Al-Noor Trading',
    phone: '+249 91 222 1100',
    address: 'Omdurman Central Market',
    customerType: 'Exporter',
    cashAccount: 420000,
    commodityAccount: 'White Sesame 60 Qintar',
    commodityBalance: '60 Qintar White Sesame',
    debtBalance: 180000,
    paidAmount: 280000,
    remainingBalance: 180000,
    status: 'Debtor',
    lastTransactionDate: '2026-05-17',
    notes: 'Regular sesame buyer with active export orders.',
  },
  {
    id: 2,
    name: 'Blue Nile Stores',
    phone: '+249 92 830 7711',
    address: 'Blue Nile Wholesale Area',
    customerType: 'Investor',
    cashAccount: 0,
    commodityAccount: 'Corn 120 Large Bag',
    commodityBalance: '120 Large Bag Corn',
    debtBalance: 0,
    paidAmount: 5040000,
    remainingBalance: 0,
    status: 'Balanced',
    lastTransactionDate: '2026-05-17',
    notes: 'Keeps corn stock in warehouse until market price improves.',
  },
  {
    id: 3,
    name: 'Hamad Agro Supply',
    phone: '+249 90 441 6520',
    address: 'Khartoum North Industrial Road',
    customerType: 'Supplier',
    cashAccount: -95000,
    commodityAccount: 'Plastic 18 Roll',
    commodityBalance: '18 Roll Plastic',
    debtBalance: 95000,
    paidAmount: 120000,
    remainingBalance: 95000,
    status: 'Creditor',
    lastTransactionDate: '2026-05-15',
    notes: 'Packaging material supplier for plastic and sacks.',
  },
  {
    id: 4,
    name: 'Central Market Buyer',
    phone: '+249 99 118 2005',
    address: 'Central Crop Market',
    customerType: 'Consumer',
    cashAccount: 70000,
    commodityAccount: 'Red Sesame 25 Qintar',
    commodityBalance: '25 Qintar Red Sesame',
    debtBalance: 70000,
    paidAmount: 1200000,
    remainingBalance: 70000,
    status: 'Debtor',
    lastTransactionDate: '2026-05-16',
    notes: 'Buys small and medium commodity quantities from warehouse.',
  },
];

export const companyWorkers = [
  {
    id: 1,
    name: 'Ahmed Hassan',
    phone: '+249 91 445 2010',
    workerType: 'Weighing Worker',
    assignedWork: 'Truck weighing and scale recording',
    status: 'Available',
    notes: 'Responsible for morning weighing shifts.',
    paymentHistory: [
      { id: 1, date: '2026-06-02', time: '10:30 AM', warehouseName: 'Main Sesame Store', paymentMethod: 'Bag Based', numberOfBags: 120, pricePerBag: 150, totalPayment: 18000, adminName: 'Admin', notes: 'Morning weighing work' },
      { id: 2, date: '2026-06-01', time: '09:45 AM', warehouseName: 'Main Sesame Store', paymentMethod: 'Bag Based', numberOfBags: 100, pricePerBag: 150, totalPayment: 15000, adminName: 'Admin', notes: 'Truck unloading support' },
    ],
  },
  {
    id: 2,
    name: 'Musa Adam',
    phone: '+249 92 330 1180',
    workerType: 'General Worker',
    assignedWork: 'Loading sesame and corn bags',
    status: 'Available',
    notes: 'Works with the warehouse loading team.',
    paymentHistory: [
      { id: 3, date: '2026-06-02', time: '11:15 AM', warehouseName: 'Corn Storage Yard', paymentMethod: 'Daily Wage', dailyWage: 13500, totalPayment: 13500, workDescription: 'Supervised store operations and shipment checking', adminName: 'Admin', notes: 'General daily operational support' },
    ],
  },
  {
    id: 3,
    name: 'Osman Ali',
    phone: '+249 90 760 4412',
    workerType: 'Bag Carrying Workers',
    assignedWork: 'Carrying jowal between store and truck',
    status: 'Available',
    notes: 'Available for heavy bag movement.',
    paymentHistory: [],
  },
];

export const paymentHistory = [
  { id: 1, date: '2026-05-17', customer: 'Al-Noor Trading', amount: 280000, method: 'Cash', note: 'Partial settlement' },
  { id: 2, date: '2026-05-14', customer: 'Central Market Buyer', amount: 70000, method: 'Bank Transfer', note: 'Remaining balance' },
  { id: 3, date: '2026-05-11', customer: 'Blue Nile Stores', amount: 530000, method: 'Cash', note: 'Full payment' },
];

export const customerCashTransactions = [
  { id: 1, customer: 'Al-Noor Trading', date: '2026-05-17', type: 'Payment Received', amount: 280000, paidAmount: 280000, remainingBalance: 180000, lahuWaAlayh: 'Lahu', source: 'Daily Journal', description: 'Partial payment for sesame order' },
  { id: 2, customer: 'Al-Noor Trading', date: '2026-05-17', type: 'Payment Owed', amount: 180000, paidAmount: 0, remainingBalance: 180000, lahuWaAlayh: 'Lahu', source: 'Invoice INV-9001', description: 'Remaining balance after order payment' },
  { id: 3, customer: 'Blue Nile Stores', date: '2026-05-17', type: 'Payment Received', amount: 5040000, paidAmount: 5040000, remainingBalance: 0, lahuWaAlayh: 'Balanced', source: 'Invoice INV-9002', description: 'Full payment for corn order' },
  { id: 4, customer: 'Hamad Agro Supply', date: '2026-05-15', type: 'Payment Owed', amount: 95000, paidAmount: 120000, remainingBalance: 95000, lahuWaAlayh: 'Alayh', source: 'Supplier Account', description: 'Remaining packaging supplier balance' },
  { id: 5, customer: 'Central Market Buyer', date: '2026-05-16', type: 'Payment Owed', amount: 70000, paidAmount: 1200000, remainingBalance: 70000, lahuWaAlayh: 'Lahu', source: 'Invoice INV-9003', description: 'Remaining red sesame payment' },
];

export const customerCommodityTransactions = [
  { id: 1, customer: 'Al-Noor Trading', date: '2026-05-17', transactionType: 'Product Delivered', product: 'White Sesame', quantity: 60, unit: 'Qintar', warehouseName: 'Main Warehouse', lahuWaAlayh: 'Lahu', source: 'Order ORD-1001', description: 'White sesame delivered on account' },
  { id: 2, customer: 'Blue Nile Stores', date: '2026-05-17', transactionType: 'Product Stored', product: 'Corn', quantity: 120, unit: 'Large Bag', warehouseName: 'North Store', lahuWaAlayh: 'Alayh', source: 'Warehouse Entry', description: 'Corn reserved in warehouse for customer account' },
  { id: 3, customer: 'Hamad Agro Supply', date: '2026-05-15', transactionType: 'Product Received', product: 'Plastic', quantity: 18, unit: 'Roll', warehouseName: 'Spare Store', lahuWaAlayh: 'Alayh', source: 'Commodity Journal', description: 'Plastic received from supplier' },
  { id: 4, customer: 'Central Market Buyer', date: '2026-05-16', transactionType: 'Product Delivered', product: 'Red Sesame', quantity: 25, unit: 'Qintar', warehouseName: 'Main Warehouse', lahuWaAlayh: 'Lahu', source: 'Order ORD-1003', description: 'Red sesame withdrawn from warehouse' },
  { id: 5, customer: 'Al-Noor Trading', date: '2026-05-16', transactionType: 'Product Received', product: 'White Sesame', quantity: 50, unit: 'Qintar', warehouseName: 'Main Warehouse', lahuWaAlayh: 'Alayh', source: 'Warehouse Receipt', description: 'Customer supplied sesame for account adjustment' },
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
  {
    id: 1,
    invoiceNo: 'INV-SALE-2026-0001',
    invoiceType: 'Sales',
    personName: 'Al-Noor Trading',
    personRole: 'Buyer',
    phone: '+249 91 222 1100',
    productType: 'White Sesame',
    quantity: 60,
    unitPackaging: 'Quintal',
    date: '2026-05-17',
    time: '09:30',
    notes: 'Sales invoice for white sesame order.',
    adminName: 'Admin',
    status: 'Created',
    customer: 'Al-Noor Trading',
    orderNo: 'ORD-1001',
    totalAmount: 4920000,
    paidAmount: 280000,
  },
  {
    id: 2,
    invoiceNo: 'INV-PUR-2026-0001',
    invoiceType: 'Purchase',
    personName: 'Blue Nile Stores',
    personRole: 'Seller',
    phone: '+249 92 830 7711',
    productType: 'Corn',
    quantity: 120,
    unitPackaging: 'Sacks',
    date: '2026-05-17',
    time: '11:15',
    notes: 'Purchase record for corn received into North Store.',
    adminName: 'Admin',
    status: 'Printed',
    customer: 'Blue Nile Stores',
    orderNo: 'ORD-1002',
    totalAmount: 5040000,
    paidAmount: 5040000,
  },
  {
    id: 3,
    invoiceNo: 'INV-STO-2026-0001',
    invoiceType: 'Storage',
    personName: 'Central Market Buyer',
    personRole: 'Storage Owner',
    phone: '+249 99 118 2005',
    productType: 'Red Sesame',
    quantity: 25,
    unitPackaging: 'Quintal',
    date: '2026-05-16',
    time: '14:00',
    notes: 'Storage invoice for red sesame kept in Main Warehouse.',
    adminName: 'Admin',
    status: 'Completed',
    customer: 'Central Market Buyer',
    orderNo: 'ORD-1003',
    totalAmount: 1900000,
    paidAmount: 1200000,
  },
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
