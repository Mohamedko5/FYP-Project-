export default function PrintableProductsReport({ products, summary, generatedAt }) {
  return (
    <div className="print-area">
      <article className="print-report">
        <header className="print-report__header">
          <h1>Bayad Commercial Activities Company</h1>
          <p>Product Management Report</p>
          <h2>Products, Units, Prices, and Stock Position</h2>
        </header>

        <section className="print-report__meta">
          <div><span>Generated At</span><strong>{generatedAt}</strong></div>
          <div><span>Total Products</span><strong>{summary?.total_products ?? products.length}</strong></div>
          <div><span>Active Products</span><strong>{summary?.active_products ?? 0}</strong></div>
          <div><span>Commodity Products</span><strong>{summary?.commodity_products ?? 0}</strong></div>
          <div><span>Supply Products</span><strong>{summary?.supply_products ?? 0}</strong></div>
          <div><span>Low / Out Stock</span><strong>{(summary?.low_stock_products ?? 0) + (summary?.out_of_stock_products ?? 0)}</strong></div>
        </section>

        <section className="print-report__section">
          <h3>Product Register</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Units</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.code}</td>
                  <td>{product.name_en}<br />{product.name_ar}</td>
                  <td>{product.category}</td>
                  <td>{product.units.map((unit) => unit.unit).join(', ')}</td>
                  <td>{product.stock_summary.map((row) => `${row.quantity} ${row.unit}`).join(', ') || 'Not stocked'}</td>
                  <td>{product.stock_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-report__signature">
          <div><span>Prepared By</span><strong>Admin</strong></div>
          <div><span>Reviewed By</span><strong>Manager</strong></div>
          <div><span>Signature</span><strong>&nbsp;</strong></div>
        </section>
      </article>
    </div>
  );
}
