import { useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Table from '../components/ui/Table.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { invoices } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const invoiceTypes = ['Sales', 'Purchase', 'Storage'];
const personRoles = ['Seller', 'Buyer', 'Storage Owner'];
const productTypes = ['Corn', 'White Sesame', 'Red Sesame', 'Other'];
const unitPackagingOptions = ['Sacks', 'Burlap Bags', 'Plastic Bags', 'Quintal', 'Other'];
const invoiceStatuses = ['Created', 'Printed', 'Completed', 'Cancelled'];

const initialFilters = {
  invoiceType: '',
  productType: '',
  status: '',
  date: '',
  search: '',
};

function createEmptyForm() {
  const now = new Date();
  return {
    invoiceType: 'Sales',
    personName: '',
    personRole: 'Buyer',
    phone: '',
    productType: 'Corn',
    quantity: '',
    unitPackaging: 'Sacks',
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    notes: '',
    adminName: 'Admin',
  };
}

function getInvoicePrefix(invoiceType) {
  if (invoiceType === 'Purchase') return 'PUR';
  if (invoiceType === 'Storage') return 'STO';
  return 'SALE';
}

function formatInvoiceNumber(invoiceType, invoiceDate, currentInvoices) {
  const year = (invoiceDate || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const prefix = getInvoicePrefix(invoiceType);
  const sameTypeCount = currentInvoices.filter((invoice) => invoice.invoiceType === invoiceType).length + 1;
  return `INV-${prefix}-${year}-${String(sameTypeCount).padStart(4, '0')}`;
}

export default function Invoices() {
  const { t } = useLanguage();
  const [invoiceRows, setInvoiceRows] = useState(invoices);
  const [filters, setFilters] = useState(initialFilters);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [errors, setErrors] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const invoiceTypeLabel = (value) => t(`invoices.invoiceTypes.${value}`);
  const personRoleLabel = (value) => t(`invoices.personRoles.${value}`);
  const productTypeLabel = (value) => t(`invoices.productTypes.${value}`);
  const unitLabel = (value) => t(`invoices.unitPackagingOptions.${value}`);

  const filteredInvoices = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return invoiceRows.filter((invoice) => {
      const matchesType = !filters.invoiceType || invoice.invoiceType === filters.invoiceType;
      const matchesProduct = !filters.productType || invoice.productType === filters.productType;
      const matchesStatus = !filters.status || invoice.status === filters.status;
      const matchesDate = !filters.date || invoice.date === filters.date;
      const searchableText = `${invoice.invoiceNo} ${invoice.personName} ${invoice.productType}`.toLowerCase();
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);

      return matchesType && matchesProduct && matchesStatus && matchesDate && matchesSearch;
    });
  }, [filters, invoiceRows]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openCreateForm() {
    setEditingInvoiceId(null);
    setSelectedInvoice(null);
    setErrors([]);
    setForm(createEmptyForm());
    setShowForm(true);
  }

  function openEditForm(invoice) {
    setEditingInvoiceId(invoice.id);
    setSelectedInvoice(null);
    setErrors([]);
    setForm({
      invoiceType: invoice.invoiceType,
      personName: invoice.personName,
      personRole: invoice.personRole,
      phone: invoice.phone,
      productType: invoice.productType,
      quantity: invoice.quantity,
      unitPackaging: invoice.unitPackaging,
      date: invoice.date,
      time: invoice.time,
      notes: invoice.notes,
      adminName: invoice.adminName,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingInvoiceId(null);
    setErrors([]);
    setForm(createEmptyForm());
  }

  function validateForm() {
    const nextErrors = [];

    if (!form.personName.trim() || !form.phone.trim() || !form.date || !form.time || !form.adminName.trim()) {
      nextErrors.push(t('invoices.requiredFieldsError'));
    }

    if (Number(form.quantity) <= 0) {
      nextErrors.push(t('invoices.quantityPositiveError'));
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function saveInvoice(event) {
    event.preventDefault();
    if (!validateForm()) return;

    if (editingInvoiceId) {
      const currentInvoice = invoiceRows.find((invoice) => invoice.id === editingInvoiceId);
      const updatedInvoice = {
        ...currentInvoice,
        ...form,
        quantity: Number(form.quantity),
        customer: form.personName,
      };
      setInvoiceRows((current) => current.map((invoice) => {
        if (invoice.id !== editingInvoiceId) return invoice;
        return updatedInvoice;
      }));
      setSelectedInvoice(updatedInvoice);
    } else {
      const nextInvoice = {
        id: Date.now(),
        invoiceNo: formatInvoiceNumber(form.invoiceType, form.date, invoiceRows),
        ...form,
        quantity: Number(form.quantity),
        status: 'Created',
        customer: form.personName,
        orderNo: '-',
        totalAmount: 0,
        paidAmount: 0,
      };
      setInvoiceRows((current) => [nextInvoice, ...current]);
      setSelectedInvoice(nextInvoice);
    }

    closeForm();
  }

  function cancelInvoice(invoiceId) {
    setInvoiceRows((current) => current.map((invoice) => (
      invoice.id === invoiceId ? { ...invoice, status: 'Cancelled' } : invoice
    )));
    setSelectedInvoice((current) => (
      current?.id === invoiceId ? { ...current, status: 'Cancelled' } : current
    ));
  }

  function printInvoice(invoice) {
    const printableInvoice = invoice.status === 'Created' ? { ...invoice, status: 'Printed' } : invoice;
    setInvoiceRows((current) => current.map((row) => (
      row.id === invoice.id && row.status === 'Created' ? printableInvoice : row
    )));
    setSelectedInvoice(printableInvoice);
    window.setTimeout(() => window.print(), 100);
  }

  const columns = [
    { key: 'invoiceNo', label: t('common.invoiceNumber') },
    { key: 'invoiceType', label: t('invoices.invoiceType'), render: (row) => invoiceTypeLabel(row.invoiceType) },
    { key: 'personName', label: t('invoices.personName') },
    { key: 'personRole', label: t('invoices.personRole'), render: (row) => personRoleLabel(row.personRole) },
    { key: 'productType', label: t('invoices.productType'), render: (row) => productTypeLabel(row.productType) },
    { key: 'quantity', label: t('common.quantity') },
    { key: 'unitPackaging', label: t('invoices.unitPackaging'), render: (row) => unitLabel(row.unitPackaging) },
    { key: 'date', label: t('common.date') },
    { key: 'status', label: t('common.status'), render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: t('common.action'),
      render: (row) => (
        <div className="table-action-group">
          <Tooltip content={t('invoices.viewTooltip')}>
            <button className="link-button" type="button" onClick={() => setSelectedInvoice(row)}>
              {t('view')}
            </button>
          </Tooltip>
          <Tooltip content={t('tooltips.edit')}>
            <button className="link-button" type="button" onClick={() => openEditForm(row)}>
              {t('edit')}
            </button>
          </Tooltip>
          <Tooltip content={t('invoices.printTooltip')}>
            <button className="link-button" type="button" onClick={() => printInvoice(row)}>
              {t('invoices.print')}
            </button>
          </Tooltip>
          <Tooltip content={t('invoices.cancelTooltip')}>
            <button className="link-button link-button--danger" type="button" onClick={() => cancelInvoice(row.id)}>
              {t('cancel')}
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid invoice-management-page">
      <Card title={t('invoices.listTitle')} subtitle={t('invoices.listSubtitle')}>
        <div className="workflow-toolbar">
          <div>
            <h3>{t('invoices.managementTitle')}</h3>
            <p>{t('invoices.managementSubtitle')}</p>
          </div>
          <Button onClick={openCreateForm} tooltip={t('invoices.createTooltip')}>
            {t('invoices.createNewInvoice')}
          </Button>
        </div>

        <div className="report-filter-grid invoice-filter-grid">
          <label>
            {t('invoices.invoiceType')}
            <select name="invoiceType" value={filters.invoiceType} onChange={updateFilter}>
              <option value="">{t('invoices.allTypes')}</option>
              {invoiceTypes.map((type) => (
                <option key={type} value={type}>{invoiceTypeLabel(type)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('invoices.productType')}
            <select name="productType" value={filters.productType} onChange={updateFilter}>
              <option value="">{t('invoices.allProducts')}</option>
              {productTypes.map((product) => (
                <option key={product} value={product}>{productTypeLabel(product)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('common.status')}
            <select name="status" value={filters.status} onChange={updateFilter}>
              <option value="">{t('invoices.allStatuses')}</option>
              {invoiceStatuses.map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('common.date')}
            <input name="date" type="date" value={filters.date} onChange={updateFilter} />
          </label>
          <label className="invoice-filter-grid__search">
            {t('invoices.search')}
            <input
              name="search"
              type="search"
              value={filters.search}
              onChange={updateFilter}
              placeholder={t('invoices.searchPlaceholder')}
            />
          </label>
        </div>

        {showForm && (
          <form className="section-panel invoice-form" onSubmit={saveInvoice}>
            <div className="section-panel__header">
              <div>
                <h3>{editingInvoiceId ? t('invoices.editTitle') : t('invoices.createTitle')}</h3>
                <p>{t('invoices.formSubtitle')}</p>
              </div>
              <span className="muted-text">{t('invoices.invoiceNumberGenerated')}</span>
            </div>

            {errors.length > 0 && (
              <div className="form-error">
                {errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}

            <div className="form-grid">
              <label>
                {t('invoices.invoiceType')}
                <select name="invoiceType" value={form.invoiceType} onChange={updateForm}>
                  {invoiceTypes.map((type) => (
                    <option key={type} value={type}>{invoiceTypeLabel(type)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('invoices.personName')}
                <input name="personName" value={form.personName} onChange={updateForm} placeholder={t('invoices.personNamePlaceholder')} />
              </label>
              <label>
                {t('invoices.personRole')}
                <select name="personRole" value={form.personRole} onChange={updateForm}>
                  {personRoles.map((role) => (
                    <option key={role} value={role}>{personRoleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('invoices.phone')}
                <input name="phone" value={form.phone} onChange={updateForm} placeholder={t('invoices.phonePlaceholder')} />
              </label>
              <label>
                {t('invoices.productType')}
                <select name="productType" value={form.productType} onChange={updateForm}>
                  {productTypes.map((product) => (
                    <option key={product} value={product}>{productTypeLabel(product)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.quantity')}
                <input name="quantity" type="number" min="1" value={form.quantity} onChange={updateForm} placeholder="0" />
              </label>
              <label>
                {t('invoices.unitPackaging')}
                <select name="unitPackaging" value={form.unitPackaging} onChange={updateForm}>
                  {unitPackagingOptions.map((unit) => (
                    <option key={unit} value={unit}>{unitLabel(unit)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.date')}
                <input name="date" type="date" value={form.date} onChange={updateForm} />
              </label>
              <label>
                {t('common.time')}
                <input name="time" type="time" value={form.time} onChange={updateForm} />
              </label>
              <label>
                {t('invoices.adminName')}
                <input name="adminName" value={form.adminName} onChange={updateForm} placeholder={t('invoices.adminNamePlaceholder')} />
              </label>
              <label className="form-grid--wide">
                {t('invoices.notes')}
                <textarea name="notes" value={form.notes} onChange={updateForm} placeholder={t('invoices.notesPlaceholder')} />
              </label>
            </div>

            <div className="workflow-actions">
              <Button type="submit" tooltip={t('tooltips.saveTransaction')}>
                {editingInvoiceId ? t('invoices.updateInvoice') : t('invoices.saveInvoice')}
              </Button>
              <Button variant="secondary" onClick={closeForm} tooltip={t('tooltips.cancel')}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}

        <Table columns={columns} rows={filteredInvoices} emptyMessage={t('invoices.noInvoices')} />
      </Card>

      {selectedInvoice && (
        <Card title={t('invoices.previewTitle')} subtitle={t('invoices.previewSubtitle')}>
          <div className="invoice-preview-actions no-print">
            <Button onClick={() => printInvoice(selectedInvoice)} tooltip={t('invoices.printTooltip')}>
              {t('invoices.printInvoice')}
            </Button>
            <Button variant="secondary" onClick={() => setSelectedInvoice(null)} tooltip={t('tooltips.cancel')}>
              {t('invoices.closePreview')}
            </Button>
          </div>

          <div className="invoice-print-page">
            <article className="invoice-document">
              <header className="invoice-document__header">
                <div>
                  <strong>{t('companyName')}</strong>
                  <span>{t('invoices.systemName')}</span>
                </div>
                <div className="invoice-document__meta">
                  <span>{t('invoices.officialInvoice')}</span>
                  <strong>{selectedInvoice.invoiceNo}</strong>
                </div>
              </header>

              <section className="invoice-document__section invoice-document__summary">
                <div>
                  <span>{t('invoices.invoiceType')}</span>
                  <strong>{invoiceTypeLabel(selectedInvoice.invoiceType)}</strong>
                </div>
                <div>
                  <span>{t('common.date')}</span>
                  <strong>{selectedInvoice.date}</strong>
                </div>
                <div>
                  <span>{t('common.time')}</span>
                  <strong>{selectedInvoice.time}</strong>
                </div>
                <div>
                  <span>{t('common.status')}</span>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.personDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('invoices.personName')}</span><strong>{selectedInvoice.personName}</strong></div>
                  <div><span>{t('invoices.personRole')}</span><strong>{personRoleLabel(selectedInvoice.personRole)}</strong></div>
                  <div><span>{t('invoices.phone')}</span><strong>{selectedInvoice.phone}</strong></div>
                  <div><span>{t('invoices.adminName')}</span><strong>{selectedInvoice.adminName}</strong></div>
                </div>
              </section>

              <section className="invoice-document__section">
                <h3>{t('invoices.productDetails')}</h3>
                <div className="invoice-document__grid">
                  <div><span>{t('invoices.productType')}</span><strong>{productTypeLabel(selectedInvoice.productType)}</strong></div>
                  <div><span>{t('common.quantity')}</span><strong>{selectedInvoice.quantity}</strong></div>
                  <div><span>{t('invoices.unitPackaging')}</span><strong>{unitLabel(selectedInvoice.unitPackaging)}</strong></div>
                  <div><span>{t('invoices.notes')}</span><strong>{selectedInvoice.notes || t('warehouse.noNotes')}</strong></div>
                </div>
              </section>

              <footer className="invoice-document__signatures">
                <div>
                  <span>{t('invoices.adminSignature')}</span>
                  <strong>{t('invoices.signatureLine')}</strong>
                </div>
                <div>
                  <span>{t('invoices.companyStamp')}</span>
                  <strong>{t('invoices.signatureLine')}</strong>
                </div>
                <div>
                  <span>{t('invoices.personSignature')}</span>
                  <strong>{t('invoices.signatureLine')}</strong>
                </div>
              </footer>
            </article>
          </div>
        </Card>
      )}
    </div>
  );
}
