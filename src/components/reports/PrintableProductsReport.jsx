import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function PrintableProductsReport({ products, summary, generatedAt }) {
  const { isArabic, t, statusLabel } = useLanguage();
  const label = isArabic ? {
    report: 'تقرير إدارة المنتجات',
    title: 'المنتجات والوحدات والأسعار وحالة المخزون',
    generatedAt: 'تاريخ الإنشاء',
    totalProducts: 'إجمالي المنتجات',
    activeProducts: 'المنتجات النشطة',
    commodityProducts: 'منتجات السلع',
    supplyProducts: 'منتجات المستلزمات',
    lowOutStock: 'منخفض / نافد المخزون',
    register: 'سجل المنتجات',
    code: 'الرمز',
    product: 'المنتج',
    category: 'التصنيف',
    units: 'الوحدات',
    stock: 'المخزون',
    status: 'الحالة',
    notStocked: 'غير مخزن',
    preparedBy: 'أعد بواسطة',
    reviewedBy: 'راجع بواسطة',
    signature: 'التوقيع',
    admin: 'المسؤول',
    manager: 'المدير',
  } : {
    report: 'Product Management Report',
    title: 'Products, Units, Prices, and Stock Position',
    generatedAt: 'Generated At',
    totalProducts: 'Total Products',
    activeProducts: 'Active Products',
    commodityProducts: 'Commodity Products',
    supplyProducts: 'Supply Products',
    lowOutStock: 'Low / Out Stock',
    register: 'Product Register',
    code: 'Code',
    product: 'Product',
    category: 'Category',
    units: 'Units',
    stock: 'Stock',
    status: 'Status',
    notStocked: 'Not stocked',
    preparedBy: 'Prepared By',
    reviewedBy: 'Reviewed By',
    signature: 'Signature',
    admin: 'Admin',
    manager: 'Manager',
  };
  const categoryLabel = (category) => {
    if (!isArabic) return category;
    return category === 'commodity' ? 'سلعة' : category === 'supply' ? 'مستلزم' : category;
  };

  return (
    <div className="print-area">
      <article className="print-report" dir={isArabic ? 'rtl' : 'ltr'}>
        <header className="print-report__header">
          <h1>{t('companyName')}</h1>
          <p>{label.report}</p>
          <h2>{label.title}</h2>
        </header>

        <section className="print-report__meta">
          <div><span>{label.generatedAt}</span><strong>{generatedAt}</strong></div>
          <div><span>{label.totalProducts}</span><strong>{summary?.total_products ?? products.length}</strong></div>
          <div><span>{label.activeProducts}</span><strong>{summary?.active_products ?? 0}</strong></div>
          <div><span>{label.commodityProducts}</span><strong>{summary?.commodity_products ?? 0}</strong></div>
          <div><span>{label.supplyProducts}</span><strong>{summary?.supply_products ?? 0}</strong></div>
          <div><span>{label.lowOutStock}</span><strong>{(summary?.low_stock_products ?? 0) + (summary?.out_of_stock_products ?? 0)}</strong></div>
        </section>

        <section className="print-report__section">
          <h3>{label.register}</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>{label.product}</th>
                <th>{label.category}</th>
                <th>{label.units}</th>
                <th>{label.stock}</th>
                <th>{label.status}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name_en}<br />{product.name_ar}</td>
                  <td>{categoryLabel(product.category)}</td>
                  <td>{product.units.map((unit) => unit.unit).join(', ')}</td>
                  <td>{product.stock_summary.map((row) => `${row.quantity} ${row.unit}`).join(', ') || label.notStocked}</td>
                  <td>{statusLabel(product.stock_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-report__signature">
          <div><span>{label.preparedBy}</span><strong>{label.admin}</strong></div>
          <div><span>{label.reviewedBy}</span><strong>{label.manager}</strong></div>
          <div><span>{label.signature}</span><strong>&nbsp;</strong></div>
        </section>
      </article>
    </div>
  );
}
