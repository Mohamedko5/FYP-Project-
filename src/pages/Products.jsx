import { useEffect, useMemo, useState } from 'react';
import PrintableProductsReport from '../components/reports/PrintableProductsReport.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  archiveManagedProduct,
  createManagedProduct,
  getManagedProducts,
  getProductSummary,
  updateManagedProduct,
} from '../services/productsApi.js';

const categoryOptions = [
  { value: 'commodity', label: 'Commodity' },
  { value: 'supply', label: 'Supply' },
];
const unitOptions = ['Qintar', 'KG', 'Bag', 'Bale', 'Unit'];
const stockStatusOptions = [
  { value: 'Available', label: 'Available' },
  { value: 'Low Stock', label: 'Low Stock' },
  { value: 'Out of Stock', label: 'Out of Stock' },
  { value: 'Not Stocked', label: 'Not Stocked' },
];

function emptyUnit(isDefault = false) {
  return {
    unit: '',
    is_default: isDefault,
    purchase_price: '0.00',
    selling_price: '0.00',
    minimum_selling_price: '',
    is_active: true,
  };
}

function createEmptyProduct() {
  return {
    name_en: '',
    name_ar: '',
    category: 'commodity',
    description: '',
    notes: '',
    is_active: true,
    units: [emptyUnit(true)],
  };
}

function readRole() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user?.profile?.role || user?.role || 'admin';
  } catch {
    return 'admin';
  }
}

function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function normalizeProduct(product) {
  return {
    ...product,
    units: (product.units || []).map((unit) => ({
      ...unit,
      purchase_price: unit.purchase_price ?? '0.00',
      selling_price: unit.selling_price ?? '0.00',
      minimum_selling_price: unit.minimum_selling_price ?? '',
    })),
  };
}

function totalStock(product) {
  if (!product.stock_summary?.length) return '0.000';
  return product.stock_summary.map((row) => `${row.quantity} ${row.unit}`).join(', ');
}

function formatPrice(value) {
  return `SDG ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Products() {
  const { isArabic } = useLanguage();
  const [productRows, setProductRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', unit: '', stock_status: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [form, setForm] = useState(createEmptyProduct());
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const role = readRole();
  const canManage = role === 'admin';

  const selectedProduct = productRows.find((product) => product.id === selectedProductId) || productRows[0] || null;

  async function loadProducts(nextFilters = filters) {
    setLoading(true);
    setErrors([]);
    try {
      const apiFilters = {
        ...nextFilters,
        stock_status: nextFilters.stock_status || '',
        ordering: 'name_en',
        page_size: 100,
      };
      const [productsData, summaryData] = await Promise.all([
        getManagedProducts(apiFilters),
        getProductSummary(),
      ]);
      const rows = unwrapResults(productsData).map(normalizeProduct);
      setProductRows(rows);
      setSummary(summaryData);
      setSelectedProductId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || null));
    } catch (error) {
      setErrors([error.message || 'Unable to load products.']);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const generatedAt = useMemo(() => new Date().toLocaleString(), [productRows, summary]);

  function updateFilter(event) {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    loadProducts(nextFilters);
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function updateUnit(index, field, value) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit, unitIndex) => {
        if (field === 'is_default') {
          return { ...unit, is_default: unitIndex === index };
        }
        return unitIndex === index ? { ...unit, [field]: value } : unit;
      }),
    }));
  }

  function addUnit() {
    setForm((current) => ({ ...current, units: [...current.units, emptyUnit(false)] }));
  }

  function removeUnit(index) {
    setForm((current) => {
      const units = current.units.filter((_, unitIndex) => unitIndex !== index);
      if (units.length && !units.some((unit) => unit.is_default)) {
        units[0] = { ...units[0], is_default: true };
      }
      return { ...current, units: units.length ? units : [emptyUnit(true)] };
    });
  }

  function openAddForm() {
    setEditingProductId(null);
    setForm(createEmptyProduct());
    setErrors([]);
    setShowForm(true);
  }

  function openEditForm(product) {
    setEditingProductId(product.id);
    setForm({
      name_en: product.name_en || '',
      name_ar: product.name_ar || '',
      category: product.category || 'commodity',
      description: product.description || '',
      notes: product.notes || '',
      is_active: Boolean(product.is_active),
      units: product.units?.length ? product.units.map((unit) => ({ ...unit })) : [emptyUnit(true)],
    });
    setErrors([]);
    setShowForm(true);
  }

  function closeForm() {
    setEditingProductId(null);
    setForm(createEmptyProduct());
    setErrors([]);
    setShowForm(false);
  }

  function validateForm() {
    const nextErrors = [];
    if (!form.name_en.trim() || !form.name_ar.trim() || !form.category) nextErrors.push('English name, Arabic name, and category are required.');
    if (!form.units.length || form.units.some((unit) => !unit.unit)) nextErrors.push('At least one complete unit is required.');
    if (new Set(form.units.map((unit) => unit.unit)).size !== form.units.length) nextErrors.push('Duplicate units are not allowed.');
    if (form.units.filter((unit) => unit.is_default && unit.is_active).length !== 1) nextErrors.push('Select exactly one active default unit.');
    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    setErrors([]);
    const payload = {
      ...form,
      units: form.units.map((unit) => ({
        ...unit,
        minimum_selling_price: unit.minimum_selling_price === '' ? null : unit.minimum_selling_price,
      })),
    };
    try {
      if (editingProductId) {
        await updateManagedProduct(editingProductId, payload);
      } else {
        await createManagedProduct(payload);
      }
      closeForm();
      await loadProducts();
    } catch (error) {
      setErrors([error.message || 'Unable to save product.']);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(productId) {
    if (!window.confirm('Archive this product? Products with positive inventory cannot be archived.')) return;
    setErrors([]);
    try {
      await archiveManagedProduct(productId);
      if (editingProductId === productId) closeForm();
      await loadProducts();
    } catch (error) {
      setErrors([error.message || 'Unable to archive product.']);
    }
  }

  function printReport() {
    window.print();
  }

  function productDisplayName(product) {
    return isArabic ? (product.name_ar || product.name_en) : product.name_en;
  }

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name_en', label: 'Product', render: (row) => <button className="link-button" type="button" onClick={() => setSelectedProductId(row.id)}>{productDisplayName(row)}</button> },
    { key: 'category', label: 'Category', render: (row) => row.category === 'commodity' ? 'Commodity' : 'Supply' },
    { key: 'units', label: 'Units', render: (row) => row.units.map((unit) => unit.unit).join(', ') },
    { key: 'stock', label: 'Current Stock', render: totalStock },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.stock_status} /> },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div className="table-action-group product-action-group">
          <Tooltip content="View stock and unit details">
            <button className="product-action-button" type="button" onClick={() => setSelectedProductId(row.id)}>View</button>
          </Tooltip>
          {canManage && (
            <>
              <Tooltip content="Edit product details and units">
                <button className="product-action-button product-action-button--edit" type="button" onClick={() => openEditForm(row)}>Edit</button>
              </Tooltip>
              <Tooltip content="Archive this product">
                <button className="product-action-button product-action-button--delete" type="button" onClick={() => archiveProduct(row.id)}>Archive</button>
              </Tooltip>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid products-management-page">
      <PrintableProductsReport products={productRows} summary={summary} generatedAt={generatedAt} />
      <Card title="Product Management" subtitle="Central products, allowed units, prices, and read-only stock position">
        <div className="product-summary-grid">
          <div><span>Total Products</span><strong>{summary?.total_products ?? 0}</strong></div>
          <div><span>Active</span><strong>{summary?.active_products ?? 0}</strong></div>
          <div><span>Low Stock</span><strong>{summary?.low_stock_products ?? 0}</strong></div>
          <div><span>Out of Stock</span><strong>{summary?.out_of_stock_products ?? 0}</strong></div>
        </div>

        <div className="workflow-toolbar product-toolbar">
          <input name="search" value={filters.search} onChange={updateFilter} placeholder="Search code, product, Arabic name, notes" />
          <select name="category" value={filters.category} onChange={updateFilter}>
            <option value="">All Categories</option>
            {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <select name="unit" value={filters.unit} onChange={updateFilter}>
            <option value="">All Units</option>
            {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          <select name="stock_status" value={filters.stock_status} onChange={updateFilter}>
            <option value="">All Stock Statuses</option>
            {stockStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {canManage && <Button onClick={openAddForm}>+ Add New Product</Button>}
          <Button variant="secondary" onClick={printReport}>Print</Button>
        </div>

        {errors.length > 0 && (
          <div className="form-error">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        {showForm && (
          <form className="section-panel product-form" onSubmit={saveProduct}>
            <div className="section-panel__header">
              <div>
                <h3>{editingProductId ? 'Edit Product' : 'Add Product'}</h3>
                <p>Stock and warehouse status are calculated from inventory records.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Product Name
                <input name="name_en" value={form.name_en} onChange={updateForm} placeholder="White Sesame" />
              </label>
              <label>
                Arabic Name
                <input name="name_ar" value={form.name_ar} onChange={updateForm} placeholder="Arabic product name" />
              </label>
              <label>
                Category
                <select name="category" value={form.category} onChange={updateForm}>
                  {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="toggle-label">
                <input name="is_active" type="checkbox" checked={form.is_active} onChange={updateForm} />
                Active
              </label>
              <label className="form-grid--wide">
                Description
                <textarea name="description" value={form.description} onChange={updateForm} placeholder="Product description" />
              </label>
              <label className="form-grid--wide">
                Notes
                <textarea name="notes" value={form.notes} onChange={updateForm} placeholder="Internal notes" />
              </label>
            </div>

            <div className="product-unit-editor">
              <div className="section-panel__header">
                <div>
                  <h3>Product Units</h3>
                  <p>Choose one active default unit. Prices are SDG only.</p>
                </div>
                <Button variant="secondary" onClick={addUnit}>+ Add Unit</Button>
              </div>
              {form.units.map((unit, index) => (
                <div className="product-unit-row" key={`${unit.id || 'new'}-${index}`}>
                  <select value={unit.unit} onChange={(event) => updateUnit(index, 'unit', event.target.value)}>
                    <option value="">Select Unit</option>
                    {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={unit.purchase_price} onChange={(event) => updateUnit(index, 'purchase_price', event.target.value)} placeholder="Purchase price" />
                  <input type="number" min="0" step="0.01" value={unit.selling_price} onChange={(event) => updateUnit(index, 'selling_price', event.target.value)} placeholder="Selling price" />
                  <input type="number" min="0" step="0.01" value={unit.minimum_selling_price || ''} onChange={(event) => updateUnit(index, 'minimum_selling_price', event.target.value)} placeholder="Minimum price" />
                  <label className="inline-control">
                    <input type="radio" checked={unit.is_default} onChange={() => updateUnit(index, 'is_default', true)} />
                    Default
                  </label>
                  <label className="inline-control">
                    <input type="checkbox" checked={unit.is_active} onChange={(event) => updateUnit(index, 'is_active', event.target.checked)} />
                    Active
                  </label>
                  <button className="product-action-button product-action-button--delete" type="button" onClick={() => removeUnit(index)}>Remove</button>
                </div>
              ))}
            </div>

            <div className="workflow-actions">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingProductId ? 'Update Product' : 'Save Product'}</Button>
              <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? <p className="loading-text">Loading products...</p> : <Table columns={columns} rows={productRows} emptyMessage="No products found." />}
      </Card>

      {selectedProduct && (
        <Card title={`${selectedProduct.code} - ${productDisplayName(selectedProduct)}`} subtitle="Read-only stock and pricing details">
          <div className="product-details-grid">
            <div>
              <h3>Stock Position</h3>
              <StatusBadge status={selectedProduct.stock_status} />
              <p>{totalStock(selectedProduct)}</p>
              <small>{selectedProduct.total_warehouses} warehouses with stock, {selectedProduct.low_stock_warehouse_count} low-stock records</small>
            </div>
            <div>
              <h3>Units and Prices</h3>
              <div className="product-chip-list">
                {selectedProduct.units.map((unit) => (
                  <span key={unit.id}>
                    {unit.unit} - Sell {formatPrice(unit.selling_price)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Table
            columns={[
              { key: 'warehouse_name', label: 'Warehouse' },
              { key: 'unit', label: 'Unit' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'minimum_threshold', label: 'Minimum Threshold' },
              { key: 'stock_status', label: 'Status', render: (row) => <StatusBadge status={row.stock_status} /> },
            ]}
            rows={(selectedProduct.warehouse_stock || []).map((row) => ({ ...row, id: `${row.warehouse_id}-${row.unit}` }))}
            emptyMessage="No warehouse stock records."
          />
        </Card>
      )}
    </div>
  );
}
