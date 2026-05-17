import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import { formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import CashAccountTable from './CashAccountTable.jsx';
import CommodityAccountTable from './CommodityAccountTable.jsx';
import CustomerStatement from './CustomerStatement.jsx';
import { customerTypeLabel } from './customerHelpers.js';

export default function CustomerProfile({ customer, cashTransactions, commodityTransactions, orders, payments, onPrint }) {
  const { t, isArabic } = useLanguage();

  if (!customer) return null;

  const orderColumns = [
    { key: 'orderNo', label: t('common.orderNo') },
    { key: 'product', label: t('common.product') },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'totalAmount', label: t('common.totalAmount'), render: (row) => formatCurrency(row.totalAmount) },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  const paymentColumns = [
    { key: 'date', label: t('common.date') },
    { key: 'amount', label: t('common.amount'), render: (row) => formatCurrency(row.amount) },
    { key: 'method', label: t('common.method') },
    { key: 'note', label: t('common.note') },
  ];

  return (
    <>
      <Card title={t('customers.profileTitle')} subtitle={t('customers.profileSubtitle')}>
        <div className="customer-profile-header">
          <div>
            <h3>{customer.name}</h3>
            <p>{customer.phone}</p>
            <p>{customer.address}</p>
          </div>
          <StatusBadge status={customer.status} />
        </div>

        <div className="detail-panel customer-profile-summary">
          <div>
            <span>{t('customers.customerType')}</span>
            <strong>{customerTypeLabel(customer.customerType, isArabic)}</strong>
          </div>
          <div>
            <span>{t('customers.cashBalance')}</span>
            <strong>{formatCurrency(Math.abs(customer.cashAccount))}</strong>
          </div>
          <div>
            <span>{t('customers.commodityBalance')}</span>
            <strong>{customer.commodityBalance}</strong>
          </div>
          <div>
            <span>{t('customers.debtBalance')}</span>
            <strong>{formatCurrency(customer.debtBalance)}</strong>
          </div>
          <div>
            <span>{t('common.paidAmount')}</span>
            <strong>{formatCurrency(customer.paidAmount)}</strong>
          </div>
          <div>
            <span>{t('common.remainingBalance')}</span>
            <strong>{formatCurrency(customer.remainingBalance)}</strong>
          </div>
        </div>

        <p className="customer-notes">{customer.notes}</p>

        <div className="table-actions customer-profile-actions">
          <Button variant="secondary">{t('customers.addCashTransaction')}</Button>
          <Button variant="secondary">{t('customers.addCommodityTransaction')}</Button>
          <Button variant="secondary">{t('customers.viewOrders')}</Button>
          <Button variant="secondary">{t('customers.viewPaymentHistory')}</Button>
          <Button onClick={onPrint}>{t('customers.printStatement')}</Button>
        </div>
      </Card>

      <div className="two-column">
        <Card title={t('customers.cashAccount')} subtitle={t('customers.cashAccountSubtitle')}>
          <CashAccountTable transactions={cashTransactions} />
        </Card>

        <Card title={t('customers.commodityAccount')} subtitle={t('customers.commodityAccountSubtitle')}>
          <CommodityAccountTable transactions={commodityTransactions} />
        </Card>
      </div>

      <div className="two-column">
        <Card title={t('customers.orderHistory')} subtitle={t('customers.orderHistorySubtitle')}>
          <Table columns={orderColumns} rows={orders} />
        </Card>

        <Card title={t('customers.paymentHistory')} subtitle={t('customers.paymentSubtitle')}>
          <Table columns={paymentColumns} rows={payments} />
        </Card>
      </div>

      <CustomerStatement
        customer={customer}
        cashTransactions={cashTransactions}
        commodityTransactions={commodityTransactions}
      />
    </>
  );
}
