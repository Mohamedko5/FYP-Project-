import { useEffect, useMemo, useRef, useState } from 'react';
import PrintableProductsReport from '../components/reports/PrintableProductsReport.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { ConfirmationDialog } from '../components/ui/ModuleInterface.jsx';
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

const copy = {
  en: {
    title: 'Product Management',
    subtitle: 'Central products, allowed units, prices, and read-only stock position',
    totalProducts: 'Total Products',
    active: 'Active',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    search: 'Search code, product, Arabic name, notes',
    allCategories: 'All Categories',
    allUnits: 'All Units',
    allStockStatuses: 'All Stock Statuses',
    addProduct: '+ Add New Product',
    print: 'Print',
    editProduct: 'Edit Product',
    addProductTitle: 'Add Product',
    formSubtitle: 'Stock and warehouse status are calculated from inventory records.',
    productName: 'Product Name',
    arabicName: 'Arabic Name',
    category: 'Category',
    description: 'Description',
    notes: 'Notes',
    productDescription: 'Product description',
    internalNotes: 'Internal notes',
    productUnits: 'Product Units',
    unitSubtitle: 'Choose one active default unit. Prices are SDG only.',
    addUnit: '+ Add Unit',
    selectUnit: 'Select Unit',
    purchasePrice: 'Purchase price',
    sellingPrice: 'Selling price',
    minimumPrice: 'Minimum price',
    default: 'Default',
    remove: 'Remove',
    saving: 'Saving...',
    updateProduct: 'Update Product',
    saveProduct: 'Save Product',
    loading: 'Loading products...',
    noProducts: 'No products found.',
    code: 'Code',
    product: 'Product',
    units: 'Units',
    currentStock: 'Current Stock',
    status: 'Status',
    action: 'Action',
    view: 'View',
    archive: 'Archive',
    edit: 'Edit',
    stockPosition: 'Stock Position',
    unitsAndPrices: 'Units and Prices',
    detailsSubtitle: 'Read-only stock and pricing details',
    warehouseStockNote: 'warehouses with stock',
    lowStockRecords: 'low-stock records',
    sell: 'Sell',
    warehouse: 'Warehouse',
    quantity: 'Quantity',
    minimumThreshold: 'Minimum Threshold',
    noWarehouseStock: 'No warehouse stock records.',
    commodity: 'Commodity',
    supply: 'Supply',
    viewTooltip: 'View stock and unit details',
    editTooltip: 'Edit product details and units',
    archiveTooltip: 'Archive this product',
    archiveConfirm: 'Archive this product? Products with positive inventory cannot be archived.',
    required: 'English name, Arabic name, and category are required.',
    unitRequired: 'At least one complete unit is required.',
    duplicateUnits: 'Duplicate units are not allowed.',
    defaultUnit: 'Select exactly one active default unit.',
    saveError: 'Unable to save product.',
    archiveError: 'Unable to archive product.',
    loadError: 'Unable to load products.',
  },
  ar: {
    title: 'إدارة المنتجات',
    subtitle: 'المنتجات والوحدات والأسعار وحالة المخزون للقراءة فقط',
    totalProducts: 'إجمالي المنتجات',
    active: 'نشطة',
    lowStock: 'مخزون منخفض',
    outOfStock: 'نفد المخزون',
    search: 'بحث بالرمز أو المنتج أو الاسم العربي أو الملاحظات',
    allCategories: 'كل التصنيفات',
    allUnits: 'كل الوحدات',
    allStockStatuses: 'كل حالات المخزون',
    addProduct: '+ إضافة منتج جديد',
    print: 'طباعة',
    editProduct: 'تعديل المنتج',
    addProductTitle: 'إضافة منتج',
    formSubtitle: 'المخزون وحالة المخزن يتم حسابهما من سجلات المخزون.',
    productName: 'اسم المنتج',
    arabicName: 'الاسم العربي',
    category: 'التصنيف',
    description: 'الوصف',
    notes: 'الملاحظات',
    productDescription: 'وصف المنتج',
    internalNotes: 'ملاحظات داخلية',
    productUnits: 'وحدات المنتج',
    unitSubtitle: 'اختر وحدة افتراضية نشطة واحدة. الأسعار بالجنيه السوداني فقط.',
    addUnit: '+ إضافة وحدة',
    selectUnit: 'اختر الوحدة',
    purchasePrice: 'سعر الشراء',
    sellingPrice: 'سعر البيع',
    minimumPrice: 'أقل سعر',
    default: 'افتراضية',
    remove: 'إزالة',
    saving: 'جارٍ الحفظ...',
    updateProduct: 'تحديث المنتج',
    saveProduct: 'حفظ المنتج',
    loading: 'جارٍ تحميل المنتجات...',
    noProducts: 'لا توجد منتجات.',
    code: 'الرمز',
    product: 'المنتج',
    units: 'الوحدات',
    currentStock: 'المخزون الحالي',
    status: 'الحالة',
    action: 'الإجراء',
    view: 'عرض',
    archive: 'أرشفة',
    edit: 'تعديل',
    stockPosition: 'حالة المخزون',
    unitsAndPrices: 'الوحدات والأسعار',
    detailsSubtitle: 'تفاصيل المخزون والأسعار للقراءة فقط',
    warehouseStockNote: 'مخازن بها مخزون',
    lowStockRecords: 'سجلات منخفضة المخزون',
    sell: 'بيع',
    warehouse: 'المخزن',
    quantity: 'الكمية',
    minimumThreshold: 'الحد الأدنى',
    noWarehouseStock: 'لا توجد سجلات مخزون في المخازن.',
    commodity: 'سلعة',
    supply: 'مستلزم',
    viewTooltip: 'عرض تفاصيل المخزون والوحدات',
    editTooltip: 'تعديل بيانات المنتج والوحدات',
    archiveTooltip: 'أرشفة هذا المنتج',
    archiveConfirm: 'هل تريد أرشفة هذا المنتج؟ لا يمكن أرشفة المنتجات التي لها مخزون موجب.',
    required: 'اسم المنتج بالإنجليزية والاسم العربي والتصنيف مطلوبة.',
    unitRequired: 'يجب إدخال وحدة كاملة واحدة على الأقل.',
    duplicateUnits: 'لا يسمح بتكرار الوحدات.',
    defaultUnit: 'اختر وحدة افتراضية نشطة واحدة فقط.',
    saveError: 'تعذر حفظ المنتج.',
    archiveError: 'تعذر أرشفة المنتج.',
    loadError: 'تعذر تحميل المنتجات.',
  },
};

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
  const label = copy[isArabic ? 'ar' : 'en'];
  const [productRows, setProductRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', unit: '', stock_status: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [form, setForm] = useState(createEmptyProduct());
  const [errors, setErrors] = useState([]);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const role = readRole();
  const canManage = role === 'admin';
  const addProductButtonRef = useRef(null);
  const editProductButtonRef = useRef(null);

  const selectedProduct = productRows.find((product) => product.id === selectedProductId) || productRows[0] || null;
  const productFormDirty = showForm && JSON.stringify(form) !== JSON.stringify(createEmptyProduct());

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
      setErrors([error.message || label.loadError]);
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
    if (!form.name_en.trim() || !form.name_ar.trim() || !form.category) nextErrors.push(label.required);
    if (!form.units.length || form.units.some((unit) => !unit.unit)) nextErrors.push(label.unitRequired);
    if (new Set(form.units.map((unit) => unit.unit)).size !== form.units.length) nextErrors.push(label.duplicateUnits);
    if (form.units.filter((unit) => unit.is_default && unit.is_active).length !== 1) nextErrors.push(label.defaultUnit);
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
      setErrors([error.message || label.saveError]);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(productId) {
    setErrors([]);
    try {
      await archiveManagedProduct(productId);
      if (editingProductId === productId) closeForm();
      setArchiveTarget(null);
      await loadProducts();
    } catch (error) {
      setErrors([error.message || label.archiveError]);
    }
  }

  function printReport() {
    window.print();
  }

  function productDisplayName(product) {
    return isArabic ? (product.name_ar || product.name_en) : product.name_en;
  }

  const columns = [
    { key: 'code', label: label.code },
    { key: 'name_en', label: label.product, render: (row) => <button className="link-button" type="button" onClick={() => setSelectedProductId(row.id)}>{productDisplayName(row)}</button> },
    { key: 'category', label: label.category, render: (row) => row.category === 'commodity' ? label.commodity : label.supply },
    { key: 'units', label: label.units, render: (row) => row.units.map((unit) => unit.unit).join(', ') },
    { key: 'stock', label: label.currentStock, render: totalStock },
    { key: 'status', label: label.status, render: (row) => <StatusBadge status={row.stock_status} /> },
    {
      key: 'actions',
      label: label.action,
      render: (row) => (
        <div className="table-action-group product-action-group">
          <Tooltip content={label.viewTooltip}>
            <button className="product-action-button" type="button" onClick={() => setSelectedProductId(row.id)}>{label.view}</button>
          </Tooltip>
          {canManage && (
            <>
              <Tooltip content={label.editTooltip}>
                <button className="product-action-button product-action-button--edit" type="button" onClick={() => openEditForm(row)} ref={editProductButtonRef}>{label.edit}</button>
              </Tooltip>
              <Tooltip content={label.archiveTooltip}>
                <button className="product-action-button product-action-button--delete" type="button" onClick={() => setArchiveTarget(row)}>{label.archive}</button>
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
      <Card title={label.title} subtitle={label.subtitle}>
        <div className="product-summary-grid">
          <div><span>{label.totalProducts}</span><strong>{summary?.total_products ?? 0}</strong></div>
          <div><span>{label.active}</span><strong>{summary?.active_products ?? 0}</strong></div>
          <div><span>{label.lowStock}</span><strong>{summary?.low_stock_products ?? 0}</strong></div>
          <div><span>{label.outOfStock}</span><strong>{summary?.out_of_stock_products ?? 0}</strong></div>
        </div>

        <div className="workflow-toolbar product-toolbar">
          <input name="search" value={filters.search} onChange={updateFilter} placeholder={label.search} />
          <select name="category" value={filters.category} onChange={updateFilter}>
            <option value="">{label.allCategories}</option>
            {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.value === 'commodity' ? label.commodity : label.supply}</option>)}
          </select>
          <select name="unit" value={filters.unit} onChange={updateFilter}>
            <option value="">{label.allUnits}</option>
            {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          <select name="stock_status" value={filters.stock_status} onChange={updateFilter}>
            <option value="">{label.allStockStatuses}</option>
            {stockStatusOptions.map((option) => <option key={option.value} value={option.value}>{isArabic && option.value === 'Available' ? 'متاح' : isArabic && option.value === 'Low Stock' ? label.lowStock : isArabic && option.value === 'Out of Stock' ? label.outOfStock : isArabic && option.value === 'Not Stocked' ? 'غير مخزن' : option.label}</option>)}
          </select>
          {canManage && <Button onClick={openAddForm} ref={addProductButtonRef}>{label.addProduct}</Button>}
          <Button variant="secondary" onClick={printReport}>{label.print}</Button>
        </div>

        {errors.length > 0 && (
          <div className="form-error">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        <AppWindow
          id="products-product-form"
          title={editingProductId ? label.editProduct : label.addProductTitle}
          description={label.formSubtitle}
          isOpen={showForm}
          isDirty={productFormDirty}
          isSubmitting={saving}
          defaultSize="xlarge"
          openerRef={editingProductId ? editProductButtonRef : addProductButtonRef}
          onClose={closeForm}
        >
          <form className="section-panel product-form" onSubmit={saveProduct}>
            <div className="section-panel__header">
              <div>
                <h3>{editingProductId ? label.editProduct : label.addProductTitle}</h3>
                <p>{label.formSubtitle}</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                {label.productName}
                <input name="name_en" value={form.name_en} onChange={updateForm} placeholder="White Sesame" />
              </label>
              <label>
                {label.arabicName}
                <input name="name_ar" value={form.name_ar} onChange={updateForm} placeholder={label.arabicName} />
              </label>
              <label>
                {label.category}
                <select name="category" value={form.category} onChange={updateForm}>
                  {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.value === 'commodity' ? label.commodity : label.supply}</option>)}
                </select>
              </label>
              <label className="toggle-label">
                <input name="is_active" type="checkbox" checked={form.is_active} onChange={updateForm} />
                {label.active}
              </label>
              <label className="form-grid--wide">
                {label.description}
                <textarea name="description" value={form.description} onChange={updateForm} placeholder={label.productDescription} />
              </label>
              <label className="form-grid--wide">
                {label.notes}
                <textarea name="notes" value={form.notes} onChange={updateForm} placeholder={label.internalNotes} />
              </label>
            </div>

            <div className="product-unit-editor">
              <div className="section-panel__header">
                <div>
                  <h3>{label.productUnits}</h3>
                  <p>{label.unitSubtitle}</p>
                </div>
                <Button variant="secondary" onClick={addUnit}>{label.addUnit}</Button>
              </div>
              {form.units.map((unit, index) => (
                <div className="product-unit-row" key={`${unit.id || 'new'}-${index}`}>
                  <select value={unit.unit} onChange={(event) => updateUnit(index, 'unit', event.target.value)}>
                    <option value="">{label.selectUnit}</option>
                    {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={unit.purchase_price} onChange={(event) => updateUnit(index, 'purchase_price', event.target.value)} placeholder={label.purchasePrice} />
                  <input type="number" min="0" step="0.01" value={unit.selling_price} onChange={(event) => updateUnit(index, 'selling_price', event.target.value)} placeholder={label.sellingPrice} />
                  <input type="number" min="0" step="0.01" value={unit.minimum_selling_price || ''} onChange={(event) => updateUnit(index, 'minimum_selling_price', event.target.value)} placeholder={label.minimumPrice} />
                  <label className="inline-control">
                    <input type="radio" checked={unit.is_default} onChange={() => updateUnit(index, 'is_default', true)} />
                    {label.default}
                  </label>
                  <label className="inline-control">
                    <input type="checkbox" checked={unit.is_active} onChange={(event) => updateUnit(index, 'is_active', event.target.checked)} />
                    {label.active}
                  </label>
                  <button className="product-action-button product-action-button--delete" type="button" onClick={() => removeUnit(index)}>{label.remove}</button>
                </div>
              ))}
            </div>

            <div className="workflow-actions">
              <Button type="submit" disabled={saving}>{saving ? label.saving : editingProductId ? label.updateProduct : label.saveProduct}</Button>
              <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            </div>
          </form>
        </AppWindow>

        {loading ? <p className="loading-text">{label.loading}</p> : <Table columns={columns} rows={productRows} emptyMessage={label.noProducts} />}
      </Card>

      {selectedProduct && (
        <Card title={`${selectedProduct.code} - ${productDisplayName(selectedProduct)}`} subtitle={label.detailsSubtitle}>
          <div className="product-details-grid">
            <div>
              <h3>{label.stockPosition}</h3>
              <StatusBadge status={selectedProduct.stock_status} />
              <p>{totalStock(selectedProduct)}</p>
              <small>{selectedProduct.total_warehouses} {label.warehouseStockNote}, {selectedProduct.low_stock_warehouse_count} {label.lowStockRecords}</small>
            </div>
            <div>
              <h3>{label.unitsAndPrices}</h3>
              <div className="product-chip-list">
                {selectedProduct.units.map((unit) => (
                  <span key={unit.id}>
                    {unit.unit} - {label.sell} {formatPrice(unit.selling_price)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Table
            columns={[
              { key: 'warehouse_name', label: label.warehouse },
              { key: 'unit', label: 'Unit' },
              { key: 'quantity', label: label.quantity },
              { key: 'minimum_threshold', label: label.minimumThreshold },
              { key: 'stock_status', label: label.status, render: (row) => <StatusBadge status={row.stock_status} /> },
            ]}
            rows={(selectedProduct.warehouse_stock || []).map((row) => ({ ...row, id: `${row.warehouse_id}-${row.unit}` }))}
            emptyMessage={label.noWarehouseStock}
          />
        </Card>
      )}

      {archiveTarget && (
        <ConfirmationDialog
          title={label.archive}
          description={label.archiveConfirm}
          confirmLabel={label.archive}
          cancelLabel="Cancel"
          saving={saving}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => archiveProduct(archiveTarget.id)}
        />
      )}
    </div>
  );
}
