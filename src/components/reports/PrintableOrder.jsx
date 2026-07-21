import { useLanguage } from '../../i18n/LanguageContext.jsx';

function money(value, currency = 'SDG') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PrintableOrder({ order }) {
  const { t, isArabic } = useLanguage();
  if (!order) return null;

  return (
    <div className="print-area">
      <article className="print-report">
        <header className="print-report__header">
          <h1>{t('companyName')}</h1>
          <p>{t('orders.printTitle')}</p>
          <h2>{order.order_number}</h2>
        </header>

        <section className="print-report__meta">
          <div><span>{t('common.date')}</span><strong>{order.created_date}</strong></div>
          <div><span>{t('common.time')}</span><strong>{order.created_time}</strong></div>
          <div><span>{t('orders.orderStatus')}</span><strong>{t(`orders.statusLabels.${order.status}`)}</strong></div>
          <div><span>{t('customers.customerCode')}</span><strong>{order.customer?.code}</strong></div>
          <div><span>{t('common.customerName')}</span><strong>{order.customer?.name}</strong></div>
          <div><span>{t('common.phone')}</span><strong>{order.customer?.phone || '-'}</strong></div>
          <div><span>{t('orders.customerReference')}</span><strong>{order.customer_reference || '-'}</strong></div>
          <div><span>{t('orders.administrator')}</span><strong>{order.administrator_name || '-'}</strong></div>
          <div><span>{t('orders.stockAvailability')}</span><strong>{t(`orders.availabilityLabels.${order.stock_availability_status}`)}</strong></div>
        </section>

        <section className="print-report__section">
          <h3>{t('orders.orderItems')}</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t('common.product')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('common.unit')}</th>
                <th>{t('orders.unitPrice')}</th>
                <th>{t('orders.lineTotal')}</th>
                <th>{t('orders.stockAvailability')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td>{isArabic ? item.product_name_ar_snapshot : item.product_name_en_snapshot}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit_snapshot}</td>
                  <td>{money(item.unit_price, order.currency)}</td>
                  <td>{money(item.line_total, order.currency)}</td>
                  <td>{t(`orders.availabilityLabels.${item.availability?.availability_status}`)} / {item.availability?.shortage_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-report__summary">
          <div><span>{t('orders.subtotal')}</span><strong>{money(order.subtotal, order.currency)}</strong></div>
          <div><span>{t('orders.discount')}</span><strong>{money(order.discount_amount, order.currency)}</strong></div>
          <div><span>{t('common.totalAmount')}</span><strong>{money(order.total_amount, order.currency)}</strong></div>
        </section>

        <section className="print-report__section">
          <h3>{t('common.note')}</h3>
          <p>{order.customer_notes || order.internal_notes || '-'}</p>
          {!order.overall_stock_sufficient && <p>{t('orders.stockRecheckMessage')}</p>}
        </section>
      </article>
    </div>
  );
}
