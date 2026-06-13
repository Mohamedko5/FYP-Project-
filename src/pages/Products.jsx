import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { products, formatCurrency } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const statusOptions = ['Available', 'Low Stock', 'Inactive'];
const unitOptions = ['Qintar', 'Bag / Jowal', 'Piece', 'Roll', 'Bundle'];

function createEmptyProduct() {
  return {
    name: '',
    category: '',
    unit: '',
    price: '',
    stock: '',
    status: 'Available',
    notes: '',
  };
}

export default function Products() {
  const { t } = useLanguage();
  const [productRows, setProductRows] = useState(products);
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [form, setForm] = useState(createEmptyProduct());
  const [errors, setErrors] = useState([]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      stock: product.stock,
      status: product.status,
      notes: product.notes || '',
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

    if (!form.name.trim() || !form.category.trim() || !form.unit.trim() || !form.status.trim()) {
      nextErrors.push(t('products.requiredFieldsError'));
    }

    if (Number(form.price) < 0) {
      nextErrors.push(t('products.pricePositiveError'));
    }

    if (Number(form.stock) < 0) {
      nextErrors.push(t('products.stockPositiveError'));
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function saveProduct(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const productData = {
      ...form,
      price: Number(form.price || 0),
      stock: Number(form.stock || 0),
    };

    if (editingProductId) {
      setProductRows((current) => current.map((product) => (
        product.id === editingProductId ? { ...product, ...productData } : product
      )));
    } else {
      setProductRows((current) => [{ id: Date.now(), ...productData }, ...current]);
    }

    closeForm();
  }

  function deleteProduct(productId) {
    if (!window.confirm(t('products.confirmDelete'))) return;
    setProductRows((current) => current.filter((product) => product.id !== productId));
    if (editingProductId === productId) closeForm();
  }

  function unitLabel(unit) {
    return t(`products.units.${unit}`);
  }

  const columns = [
    { key: 'name', label: t('common.productName') },
    { key: 'category', label: t('common.category') },
    { key: 'unit', label: t('common.unit'), render: (row) => unitLabel(row.unit) },
    { key: 'price', label: t('common.price'), render: (row) => formatCurrency(row.price) },
    { key: 'stock', label: t('common.currentStock') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group product-action-group">
          <Tooltip content={t('tooltips.edit')}>
            <button className="product-action-button product-action-button--edit" type="button" onClick={() => openEditForm(row)}>
              {t('edit')}
            </button>
          </Tooltip>
          <Tooltip content={t('tooltips.delete')}>
            <button className="product-action-button product-action-button--delete" type="button" onClick={() => deleteProduct(row.id)}>
              {t('delete')}
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid products-management-page">
      <Card title={t('products.title')} subtitle={t('products.subtitle')}>
        <div className="workflow-toolbar workflow-toolbar--split">
          <div>
            <h3>{t('products.title')}</h3>
            <p>{t('products.subtitle')}</p>
          </div>
          <Button onClick={openAddForm}>{t('products.addNewProduct')}</Button>
        </div>

        {showForm && (
          <form className="section-panel product-form" onSubmit={saveProduct}>
            <div className="section-panel__header">
              <div>
                <h3>{editingProductId ? t('products.editProductTitle') : t('products.addProductTitle')}</h3>
                <p>{t('products.formSubtitle')}</p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="form-error">
                {errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}

            <div className="form-grid">
              <label>
                {t('common.productName')}
                <input name="name" value={form.name} onChange={updateForm} placeholder={t('common.productName')} />
              </label>
              <label>
                {t('common.category')}
                <input name="category" value={form.category} onChange={updateForm} placeholder={t('products.categoryPlaceholder')} />
              </label>
              <label>
                {t('common.unit')}
                <select name="unit" value={form.unit} onChange={updateForm}>
                  <option value="">{t('products.selectUnit')}</option>
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unitLabel(unit)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.price')}
                <input name="price" type="number" min="0" value={form.price} onChange={updateForm} placeholder="0" />
              </label>
              <label>
                {t('common.currentStock')}
                <input name="stock" type="number" min="0" value={form.stock} onChange={updateForm} placeholder="0" />
              </label>
              <label>
                {t('common.status')}
                <select name="status" value={form.status} onChange={updateForm}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{t(`status.${status}`)}</option>
                  ))}
                </select>
              </label>
              <label className="form-grid--wide">
                {t('products.notes')}
                <textarea name="notes" value={form.notes} onChange={updateForm} placeholder={t('products.notesPlaceholder')} />
              </label>
            </div>

            <div className="workflow-actions">
              <Button type="submit">
                {editingProductId ? t('products.updateProduct') : t('products.saveProduct')}
              </Button>
              <Button variant="secondary" onClick={closeForm}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}

        <Table columns={columns} rows={productRows} emptyMessage={t('products.noProducts')} />
      </Card>
    </div>
  );
}
