import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import ModalPortal from '../components/ui/ModalPortal.jsx';
import PrintableDailyJournal from '../components/reports/PrintableDailyJournal.jsx';
import JournalTypeSelector from '../components/journal/JournalTypeSelector.jsx';
import CashJournalForm from '../components/journal/CashJournalForm.jsx';
import CashJournalTable from '../components/journal/CashJournalTable.jsx';
import CommodityJournalForm from '../components/journal/CommodityJournalForm.jsx';
import CommodityJournalTable from '../components/journal/CommodityJournalTable.jsx';
import CommoditySummaryCards from '../components/journal/CommoditySummaryCards.jsx';
import AppWindow from '../components/ui/AppWindow.jsx';
import { commodityProductLabels, formatCurrency, products } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  createWarehouseCommodityTransaction,
  createJournalTransaction,
  deleteJournalTransaction,
  getDailyJournalSummary,
  listJournalTransactions,
  updateJournalTransaction,
  setOpeningBalance,
} from '../services/dailyJournalApi.js';
import { getProducts, getStocks, getWarehouses } from '../services/inventoryApi.js';

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyCashForm() {
  return {
    type: 'Income',
    paymentMethod: 'cash',
    amount: '',
    description: '',
    party: '',
    electronicReference: '',
    paymentReceipt: null,
    paymentReceiptPreview: '',
    existingReceiptUrl: '',
  };
}

function createEmptyCommodityForm() {
  return {
    warehouseOperation: 'stock_in',
    warehouseId: '',
    productId: '',
    product: '',
    quantity: '',
    unit: '',
    party: '',
    estimatedValue: '',
    driverName: '',
    description: '',
    minimumThreshold: '0',
    idempotencyKey: '',
  };
}

function apiCashType(type) {
  return type === 'Expense' ? 'expense' : 'income';
}

function uiCashType(cashType) {
  return cashType === 'expense' ? 'Expense' : 'Income';
}

function decimalNumber(value) {
  return Number(value || 0);
}

function mapCashTransaction(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: uiCashType(row.cash_type),
    paymentMethod: row.payment_method === 'online' ? 'electronic' : row.payment_method,
    amount: decimalNumber(row.amount),
    description: row.description,
    party: row.party,
    electronicReference: row.electronic_reference || '',
    paymentReceiptUrl: row.payment_receipt_url || row.payment_receipt || '',
  };
}

function mapCommodityTransaction(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    warehouseOperation: row.warehouse_operation,
    warehouseId: row.warehouse,
    warehouseName: row.warehouse_name,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    movementReference: row.movement_reference,
    isSystemGenerated: row.is_system_generated,
    isReversed: row.is_reversed,
    product: row.product_name,
    quantity: decimalNumber(row.quantity),
    unit: row.unit,
    party: row.party,
    estimatedValue: decimalNumber(row.estimated_value),
    description: row.description,
    administrator: row.created_by_name,
  };
}

function productName(product) {
  return product.name_en || product.name || product.product_name || '';
}

function productUnits(product) {
  if (Array.isArray(product.units)) return product.units.map((unit) => unit.unit || unit.value || unit).filter(Boolean);
  return [];
}

function makeIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cashSummaryFromApi(summary) {
  return {
    openingBalance: decimalNumber(summary?.cash?.opening_balance),
    isOpeningBalanceSet: Boolean(summary?.cash?.is_opening_balance_set),
    income: decimalNumber(summary?.cash?.total_income),
    expenses: decimalNumber(summary?.cash?.total_expenses),
    net: decimalNumber(summary?.cash?.net),
    closing: decimalNumber(summary?.cash?.closing_balance),
  };
}

function storedAdminName() {
  try {
    const user = JSON.parse(localStorage.getItem('bayadUser') || '{}');
    return user.username || user.email || 'Bayad Admin';
  } catch {
    return 'Bayad Admin';
  }
}

function formatApiError(error) {
  return String(error?.message || 'Unable to complete this request. Please try again.')
    .split('\n')
    .filter(Boolean);
}

function WarehouseTransactionDialog({ children, title, description, onClose, isSaving, isArabic }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const firstField = dialogRef.current?.querySelector('select, input, textarea, button');
    firstField?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSaving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  return (
    <ModalPortal>
      <div className="module-dialog-backdrop warehouse-transaction-backdrop" role="presentation">
        <section
          className="module-dialog warehouse-transaction-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="warehouse-transaction-title"
          dir={isArabic ? 'rtl' : 'ltr'}
          ref={dialogRef}
        >
          <header>
            <h2 id="warehouse-transaction-title">{title}</h2>
            <p>{description}</p>
          </header>
          <div className="module-dialog__body">{children}</div>
        </section>
      </div>
    </ModalPortal>
  );
}

function JournalConfirmationDialog({ confirmation, onCancel, onConfirm, t, isDeleting }) {
  if (!confirmation) return null;

  return (
    <ModalPortal>
      <div className="confirmation-overlay" role="presentation">
        <div className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="journal-confirmation-title">
          <h3 id="journal-confirmation-title">{confirmation.title}</h3>
          <p>{confirmation.message}</p>
          <div className="confirmation-dialog__actions">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>{t('cancel')}</Button>
            <Button type="button" variant={confirmation.variant || 'primary'} onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? t('journal.deleting') : confirmation.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function DailyJournal() {
  const { t, statusLabel, isArabic } = useLanguage();
  const { setHeaderAddon } = useOutletContext();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [draftDate, setDraftDate] = useState(getTodayDate());
  const [journalType, setJournalType] = useState('cash');
  const [cashEntries, setCashEntries] = useState([]);
  const [commodityEntries, setCommodityEntries] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cashForm, setCashForm] = useState(() => createEmptyCashForm());
  const [commodityForm, setCommodityForm] = useState(() => createEmptyCommodityForm());
  const [editingCashId, setEditingCashId] = useState(null);
  const [editingCommodityId, setEditingCommodityId] = useState(null);
  const [showCashForm, setShowCashForm] = useState(false);
  const [showCommodityForm, setShowCommodityForm] = useState(false);
  const [cashErrors, setCashErrors] = useState([]);
  const [commodityErrors, setCommodityErrors] = useState([]);
  const [showOpeningBalanceForm, setShowOpeningBalanceForm] = useState(false);
  const [openingBalanceForm, setOpeningBalanceForm] = useState({ amount: '', notes: '' });
  const [confirmation, setConfirmation] = useState(null);
  const [adminName] = useState(storedAdminName);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [commodityFilters, setCommodityFilters] = useState({ product_name: '', unit: '' });
  const cashButtonRef = useRef(null);
  const newWarehouseButtonRef = useRef(null);

  const cashTotals = useMemo(() => cashSummaryFromApi(summary), [summary]);

  const loadJournalData = useCallback(async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const commonParams = { date: selectedDate, ordering: '-created_at' };
      const [cashRows, commodityRows, summaryData] = await Promise.all([
        listJournalTransactions({ ...commonParams, journal_type: 'cash' }),
        listJournalTransactions({ ...commonParams, journal_type: 'commodity', ...commodityFilters }),
        getDailyJournalSummary({ date: selectedDate }),
      ]);
      setCashEntries(cashRows.map(mapCashTransaction));
      setCommodityEntries(commodityRows.map(mapCommodityTransaction));
      setSummary(summaryData);
    } catch (error) {
      setApiError(error.message || 'Unable to load journal data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, commodityFilters]);

  const loadInventoryChoices = useCallback(async () => {
    try {
      const [productRows, warehouseRows, stockRows] = await Promise.all([
        getProducts({ is_active: true }),
        getWarehouses({ is_active: true }),
        getStocks(),
      ]);
      setInventoryProducts(Array.isArray(productRows) ? productRows : []);
      setWarehouses(Array.isArray(warehouseRows) ? warehouseRows.filter((warehouse) => !warehouse.is_deleted && warehouse.is_active !== false) : []);
      setStockItems(Array.isArray(stockRows) ? stockRows : []);
    } catch (error) {
      setApiError(error.message || 'Unable to load warehouse choices.');
    }
  }, []);

  useEffect(() => {
    loadJournalData();
  }, [loadJournalData]);

  useEffect(() => {
    loadInventoryChoices();
  }, [loadInventoryChoices]);

  function resetForms() {
    setEditingCashId(null);
    setEditingCommodityId(null);
    setShowCashForm(false);
    setShowCommodityForm(false);
    setShowOpeningBalanceForm(false);
    setCashForm(createEmptyCashForm());
    setCommodityForm(createEmptyCommodityForm());
    setCashErrors([]);
    setCommodityErrors([]);
    setConfirmation(null);
    setSuccessMessage('');
  }

  function handleJournalTypeChange(nextType) {
    setJournalType(nextType);
    resetForms();
  }

  function loadJournalDate(nextDate) {
    setSelectedDate(nextDate);
    setDraftDate(nextDate);
    resetForms();
  }

  function handleViewJournal() {
    loadJournalDate(draftDate);
  }

  function handleCashChange(event) {
    const { name, value, files, type } = event.target;
    if (type === 'file') {
      const file = files?.[0] || null;
      setCashForm((current) => ({
        ...current,
        paymentReceipt: file,
        paymentReceiptPreview: file ? URL.createObjectURL(file) : '',
      }));
      return;
    }
    if (name === 'paymentMethod' && value === 'cash') {
      const hasNewReceipt = Boolean(cashForm.paymentReceipt);
      if (hasNewReceipt && !window.confirm(t('journal.discardReceiptConfirm'))) return;
      setCashForm((current) => ({
        ...current,
        paymentMethod: 'cash',
        electronicReference: '',
        paymentReceipt: null,
        paymentReceiptPreview: '',
        existingReceiptUrl: '',
      }));
      return;
    }
    setCashForm((current) => ({ ...current, [name]: value }));
  }

  function handleRemoveCashReceipt() {
    setCashForm((current) => ({
      ...current,
      paymentReceipt: null,
      paymentReceiptPreview: '',
      existingReceiptUrl: '',
    }));
  }

  function handleCommodityChange(event) {
    const { name, value } = event.target;
    setCommodityForm((current) => ({ ...current, [name]: value }));
  }

  function validateCashForm() {
    const nextErrors = [];
    if (!cashForm.party.trim() || cashForm.amount === '' || !cashForm.description.trim()) {
      nextErrors.push(t('journal.requiredFieldsError'));
    }
    if (!cashForm.paymentMethod) {
      nextErrors.push(t('journal.paymentMethodRequiredError'));
    }
    if (Number(cashForm.amount) <= 0) {
      nextErrors.push(t('journal.positiveAmountError'));
    }
    if (cashForm.paymentMethod === 'electronic') {
      if (!cashForm.electronicReference.trim()) {
        nextErrors.push(t('journal.electronicReferenceRequiredError'));
      }
      if (!cashForm.paymentReceipt && !cashForm.existingReceiptUrl) {
        nextErrors.push(t('journal.paymentReceiptRequiredError'));
      }
    }
    setCashErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function validateCommodityForm() {
    const nextErrors = [];
    if (!commodityForm.warehouseOperation || !commodityForm.warehouseId || !commodityForm.productId || !commodityForm.unit || commodityForm.quantity === '' || !commodityForm.party.trim() || !commodityForm.description.trim()) {
      nextErrors.push(t('journal.commodityRequiredFieldsError'));
    }
    if (commodityForm.warehouseOperation === 'manual_withdrawal' && !commodityForm.description.trim()) {
      nextErrors.push(t('journal.withdrawalReasonRequired'));
    }
    if (Number(commodityForm.quantity) <= 0) {
      nextErrors.push(t('journal.positiveQuantityError'));
    }
    if (Number(commodityForm.estimatedValue) < 0) {
      nextErrors.push(t('journal.negativeEstimatedValueError'));
    }
    setCommodityErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function saveCashPayload(payload) {
    setIsSaving(true);
    setCashErrors([]);
    try {
      const apiPayload = new FormData();
      apiPayload.append('journal_type', 'cash');
      apiPayload.append('cash_type', apiCashType(payload.type));
      apiPayload.append('payment_method', payload.paymentMethod);
      apiPayload.append('amount', payload.amount);
      apiPayload.append('party', payload.party);
      apiPayload.append('description', payload.description);
      apiPayload.append('electronic_reference', payload.paymentMethod === 'electronic' ? payload.electronicReference : '');
      if (payload.paymentMethod === 'electronic' && payload.paymentReceipt) {
        apiPayload.append('payment_receipt', payload.paymentReceipt);
      }
      if (editingCashId) {
        await updateJournalTransaction(editingCashId, apiPayload);
      } else {
        await createJournalTransaction(apiPayload);
      }
      setEditingCashId(null);
      setCashForm(createEmptyCashForm());
      setShowCashForm(false);
      await loadJournalData();
    } catch (error) {
      setCashErrors(formatApiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCommodityPayload(payload) {
    setIsSaving(true);
    setCommodityErrors([]);
    setSuccessMessage('');
    try {
      if (editingCommodityId) {
        const apiPayload = {
          journal_type: 'commodity',
          product_name: payload.product,
          quantity: payload.quantity,
          unit: payload.unit,
          estimated_value: payload.estimatedValue || '0',
          party: payload.party,
          description: payload.description,
        };
        await updateJournalTransaction(editingCommodityId, apiPayload);
      } else {
        await createWarehouseCommodityTransaction({
          warehouse_operation: payload.warehouseOperation,
          warehouse_id: payload.warehouseId,
          product_id: payload.productId,
          unit: payload.unit,
          quantity: payload.quantity,
          minimum_threshold: payload.minimumThreshold || '0',
          party: payload.party,
          estimated_value: payload.estimatedValue || '0',
          driver_name: payload.driverName || '',
          description: payload.description,
          idempotency_key: payload.idempotencyKey || makeIdempotencyKey(),
        });
      }
      setEditingCommodityId(null);
      setCommodityForm(createEmptyCommodityForm());
      setShowCommodityForm(false);
      setSuccessMessage(payload.warehouseOperation === 'manual_withdrawal' ? t('journal.stockWithdrawnSuccess') : t('journal.stockAddedSuccess'));
      await loadJournalData();
      await loadInventoryChoices();
      newWarehouseButtonRef.current?.focus();
    } catch (error) {
      setCommodityErrors(formatApiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCashSubmit(event) {
    event.preventDefault();
    if (!validateCashForm()) return;

    const payload = { ...cashForm, amount: cashForm.amount };
    if (editingCashId) {
      setConfirmation({
        action: 'saveCash',
        payload,
        title: t('journal.confirmSaveTitle'),
        message: t('journal.confirmSaveMessage'),
        confirmLabel: t('journal.confirmSave'),
      });
      return;
    }

    saveCashPayload(payload);
  }

  function handleCommoditySubmit(event) {
    event.preventDefault();
    if (!validateCommodityForm()) return;

    const payload = {
      ...commodityForm,
      quantity: commodityForm.quantity,
      estimatedValue: commodityForm.estimatedValue,
    };

    if (editingCommodityId) {
      setConfirmation({
        action: 'saveCommodity',
        payload,
        title: t('journal.confirmSaveTitle'),
        message: t('journal.confirmSaveMessage'),
        confirmLabel: t('journal.confirmSave'),
      });
      return;
    }

    saveCommodityPayload(payload);
  }

  function handleCashEdit(entry) {
    setEditingCashId(entry.id);
    setShowCashForm(true);
      setCashForm({
        type: entry.type,
        paymentMethod: entry.paymentMethod || 'cash',
        amount: String(entry.amount),
        party: entry.party,
        description: entry.description,
        electronicReference: entry.electronicReference || '',
        paymentReceipt: null,
        paymentReceiptPreview: '',
        existingReceiptUrl: entry.paymentReceiptUrl || '',
      });
    setCashErrors([]);
  }

  function handleCommodityEdit(entry) {
    if (entry.isSystemGenerated) {
      setCommodityErrors([t('journal.linkedTransactionReadOnly')]);
      return;
    }
    setEditingCommodityId(entry.id);
    setShowCommodityForm(true);
    setCommodityForm({
      product: entry.product,
      quantity: String(entry.quantity),
      unit: entry.unit,
      party: entry.party,
      estimatedValue: String(entry.estimatedValue),
      description: entry.description,
    });
    setCommodityErrors([]);
  }

  function handleCashCancel() {
    setEditingCashId(null);
    setShowCashForm(false);
    setCashForm(createEmptyCashForm());
    setCashErrors([]);
  }

  function handleCommodityCancel() {
    setEditingCommodityId(null);
    setShowCommodityForm(false);
    setCommodityForm(createEmptyCommodityForm());
    setCommodityErrors([]);
    newWarehouseButtonRef.current?.focus();
  }

  function handleCashDelete(entryId) {
    setConfirmation({
      action: 'deleteCash',
      entryId,
      title: t('journal.confirmDeleteTitle'),
      message: t('journal.confirmDeleteMessage'),
      confirmLabel: t('journal.confirmDelete'),
      variant: 'secondary',
    });
  }

  function handleCommodityDelete(entryId) {
    setConfirmation({
      action: 'deleteCommodity',
      entryId,
      title: t('journal.confirmDeleteTitle'),
      message: t('journal.confirmDeleteMessage'),
      confirmLabel: t('journal.confirmDelete'),
      variant: 'secondary',
    });
  }

  function handleAddCashTransaction() {
    setEditingCashId(null);
    setCashForm(createEmptyCashForm());
    setCashErrors([]);
    setShowCashForm(true);
  }

  function handleAddCommodityTransaction() {
    setEditingCommodityId(null);
    setCommodityForm({ ...createEmptyCommodityForm(), idempotencyKey: makeIdempotencyKey() });
    setCommodityErrors([]);
    setSuccessMessage('');
    setShowCommodityForm(true);
  }

  function closeConfirmation() {
    if (!isSaving && !isDeleting) setConfirmation(null);
  }

  async function confirmJournalAction() {
    if (!confirmation) return;

    if (confirmation.action === 'saveCash') {
      await saveCashPayload(confirmation.payload);
      setConfirmation(null);
      return;
    }

    if (confirmation.action === 'saveCommodity') {
      await saveCommodityPayload(confirmation.payload);
      setConfirmation(null);
      return;
    }

    if (confirmation.action === 'deleteCash' || confirmation.action === 'deleteCommodity') {
      setIsDeleting(true);
      setApiError('');
      try {
        await deleteJournalTransaction(confirmation.entryId);
        if (editingCashId === confirmation.entryId) handleCashCancel();
        if (editingCommodityId === confirmation.entryId) handleCommodityCancel();
        setConfirmation(null);
        await loadJournalData();
      } catch (error) {
        setApiError(error.message || 'Unable to delete transaction.');
      } finally {
        setIsDeleting(false);
      }
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleSetOpeningBalance() {
    setOpeningBalanceForm({
      amount: cashTotals.isOpeningBalanceSet ? String(cashTotals.openingBalance) : '',
      notes: '',
    });
    setShowOpeningBalanceForm(true);
  }

  async function handleOpeningBalanceSubmit(event) {
    event.preventDefault();
    if (Number(openingBalanceForm.amount) < 0) {
      setApiError(t('journal.negativeOpeningBalanceError'));
      return;
    }
    setApiError('');
    setIsSaving(true);
    try {
      await setOpeningBalance(selectedDate, {
        amount: openingBalanceForm.amount,
        notes: openingBalanceForm.notes,
      });
      setShowOpeningBalanceForm(false);
      setSuccessMessage(t('journal.openingBalanceSaved'));
      await loadJournalData();
    } catch (error) {
      setApiError(error.message || 'Unable to save opening balance.');
    } finally {
      setIsSaving(false);
    }
  }

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  const commodityProductOptions = inventoryProducts.length > 0
    ? inventoryProducts
    : products.map((product) => ({ id: product.id, name_en: product.name, units: [] }));

  const isCashDirty = showCashForm && JSON.stringify(cashForm) !== JSON.stringify(createEmptyCashForm());
  const isCommodityDirty = showCommodityForm && JSON.stringify({ ...commodityForm, idempotencyKey: '' }) !== JSON.stringify(createEmptyCommodityForm());

  useEffect(() => {
    setHeaderAddon(
      <div className="journal-type-floating">
        <JournalTypeSelector journalType={journalType} onChange={handleJournalTypeChange} t={t} />
      </div>
    );

    return () => setHeaderAddon(null);
  }, [journalType, selectedDate, setHeaderAddon, t]);

  return (
    <div className="page-grid">
      <Card>
        <div className="journal-date-search">
          <label>
            {t('journal.selectJournalDate')}
            <input type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} />
          </label>
          <div className="journal-date-search__actions">
            <Button onClick={handleViewJournal} disabled={isLoading}>{t('journal.viewJournal')}</Button>
            <Button variant="secondary" onClick={handlePrint}>{t('journal.printPdf')}</Button>
          </div>
          <p>
            {t('journal.viewingJournalFor')} <strong>{selectedDate}</strong>
          </p>
        </div>
      </Card>

      {apiError && (
        <div className="form-error">
          <p>{apiError}</p>
          <Button type="button" variant="secondary" onClick={loadJournalData}>{t('journal.retry')}</Button>
        </div>
      )}

      {journalType === 'cash' ? (
        <>
          <div className="summary-grid">
            <Card className="summary-card">
              <p>{t('journal.openingBalance')}</p>
              {cashTotals.isOpeningBalanceSet ? (
                <>
                  <strong>{formatCurrency(cashTotals.openingBalance)}</strong>
                  <small>{selectedDate}</small>
                  <Button variant="secondary" onClick={handleSetOpeningBalance} style={{ marginTop: '0.5rem', width: 'fit-content' }}>
                    {t('journal.editOpeningBalance')}
                  </Button>
                </>
              ) : (
                <>
                  <strong>{formatCurrency(0)}</strong>
                  <small style={{ color: 'var(--color-danger)' }}>{t('journal.openingBalanceNotSet')}</small>
                  <Button onClick={handleSetOpeningBalance} style={{ marginTop: '0.5rem', width: 'fit-content' }}>
                    {t('journal.setOpeningBalance')}
                  </Button>
                </>
              )}
            </Card>
            <Card className="summary-card">
              <p>{t('journal.totalIncome')}</p>
              <strong>{formatCurrency(cashTotals.income)}</strong>
              <small>{t('journal.totalIncomeNote')}</small>
            </Card>
            <Card className="summary-card">
              <p>{t('journal.totalExpenses')}</p>
              <strong>{formatCurrency(cashTotals.expenses)}</strong>
              <small>{t('journal.totalExpensesNote')}</small>
            </Card>
            <Card className="summary-card">
              <p>{t('journal.closingBalance')}</p>
              <strong>{formatCurrency(cashTotals.closing)}</strong>
              <small>{t('journal.netCashBalanceNote')}</small>
            </Card>
          </div>

          <Card title={t('journal.endOfDaySummary')} subtitle={t('journal.historySubtitle')}>
            <div className="journal-table-toolbar journal-table-toolbar--filters">
              <Button onClick={handleAddCashTransaction} ref={cashButtonRef}>{t('journal.addTransaction')}</Button>
            </div>
            {isLoading ? (
              <div className="journal-state">{t('journal.loading')}</div>
            ) : (
              <CashJournalTable
                entries={cashEntries}
                onEdit={handleCashEdit}
                onDelete={handleCashDelete}
                t={t}
                emptyMessage={t('journal.noTransactionsForDate')}
              />
            )}
          </Card>

          <AppWindow
            id="daily-journal-cash-transaction"
            title={editingCashId ? t('journal.editingTitle') : t('journal.cashJournalTitle')}
            description={editingCashId ? t('journal.editingSubtitle') : t('journal.cashJournalSubtitle')}
            isOpen={showCashForm}
            isDirty={isCashDirty}
            isSubmitting={isSaving}
            defaultSize="medium"
            openerRef={cashButtonRef}
            onClose={handleCashCancel}
          >
            <Card className="journal-expandable-form app-window-card">
              <CashJournalForm
                form={cashForm}
                errors={cashErrors}
                isEditing={Boolean(editingCashId)}
                isSaving={isSaving}
                onChange={handleCashChange}
                onRemoveReceipt={handleRemoveCashReceipt}
                onSubmit={handleCashSubmit}
                onCancel={handleCashCancel}
                t={t}
                statusLabel={statusLabel}
              />
            </Card>
          </AppWindow>

          <AppWindow
            id="daily-journal-opening-balance"
            title={cashTotals.isOpeningBalanceSet ? t('journal.editOpeningBalance') : t('journal.setOpeningBalance')}
            description={t('journal.openingBalanceForThisDay')}
            isOpen={showOpeningBalanceForm}
            isDirty={false}
            isSubmitting={isSaving}
            defaultSize="small"
            onClose={() => setShowOpeningBalanceForm(false)}
          >
            <Card className="app-window-card">
              <form onSubmit={handleOpeningBalanceSubmit} className="journal-form" dir={isArabic ? 'rtl' : 'ltr'}>
                <div className="form-group">
                  <label>{t('common.date')}</label>
                  <input type="text" value={selectedDate} readOnly disabled />
                </div>
                <div className="form-group">
                  <label>{t('journal.openingBalance')} (SDG)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingBalanceForm.amount}
                    onChange={(e) => setOpeningBalanceForm({ ...openingBalanceForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('common.note')}</label>
                  <input
                    type="text"
                    value={openingBalanceForm.notes}
                    onChange={(e) => setOpeningBalanceForm({ ...openingBalanceForm, notes: e.target.value })}
                  />
                </div>
                <div className="form-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowOpeningBalanceForm(false)} disabled={isSaving}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {t('save')}
                  </Button>
                </div>
              </form>
            </Card>
          </AppWindow>

          <PrintableDailyJournal
            entries={cashEntries}
            reportDate={selectedDate}
            adminName={adminName}
            openingBalance={cashTotals.openingBalance}
            totals={cashTotals}
          />
        </>
      ) : (
        <>
          <CommoditySummaryCards summary={summary?.commodity} entries={commodityEntries} t={t} statusLabel={statusLabel} isArabic={isArabic} />

          <Card title={t('journal.commodityJournalTitle')} subtitle={t('journal.commodityHistorySubtitle')}>
            <div className="journal-table-toolbar journal-table-toolbar--filters">
              <div className="journal-filter-group journal-filter-group--wide">
                <select
                  value={commodityFilters.product_name}
                  onChange={(event) => setCommodityFilters((current) => ({ ...current, product_name: event.target.value }))}
                >
                  <option value="">{t('journal.allProducts')}</option>
                  {commodityProductOptions.map((product) => {
                    const name = productName(product);
                    return <option key={product.id} value={name}>{productLabel(name)}</option>;
                  })}
                </select>
                <select
                  value={commodityFilters.unit}
                  onChange={(event) => setCommodityFilters((current) => ({ ...current, unit: event.target.value }))}
                >
                  <option value="">{t('journal.allUnits')}</option>
                  {['Qintar', 'KG', 'Bag', 'Bale', 'Unit'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <Button onClick={handleAddCommodityTransaction} ref={newWarehouseButtonRef}>{t('journal.newWarehouseTransaction')}</Button>
            </div>
            {isLoading ? (
              <div className="journal-state">{t('journal.loading')}</div>
            ) : (
              <CommodityJournalTable
                entries={commodityEntries}
                onEdit={handleCommodityEdit}
                onDelete={handleCommodityDelete}
                t={t}
                statusLabel={statusLabel}
                isArabic={isArabic}
                emptyMessage={t('journal.noTransactionsForDate')}
              />
            )}
          </Card>

          {successMessage && <div className="journal-success-message" role="status">{successMessage}</div>}

          <AppWindow
            id="daily-journal-commodity-transaction"
            title={t('journal.warehouseTransactionTitle')}
            description={t('journal.warehouseTransactionDescription')}
            isOpen={showCommodityForm}
            isDirty={isCommodityDirty}
            isSubmitting={isSaving}
            defaultSize="large"
            openerRef={newWarehouseButtonRef}
            onClose={handleCommodityCancel}
          >
              <CommodityJournalForm
                form={commodityForm}
                errors={commodityErrors}
                isEditing={Boolean(editingCommodityId)}
                isSaving={isSaving}
                products={commodityProductOptions}
                warehouses={warehouses}
                stockItems={stockItems}
                isArabic={isArabic}
                onChange={handleCommodityChange}
                onSubmit={handleCommoditySubmit}
                onCancel={handleCommodityCancel}
                t={t}
              />
          </AppWindow>

          <PrintableDailyJournal
            entries={commodityEntries}
            reportDate={selectedDate}
            adminName={adminName}
            openingBalance={0}
            totals={{ income: 0, expenses: 0, net: 0, closing: 0 }}
            commoditySummary={summary?.commodity}
          />
        </>
      )}
      <JournalConfirmationDialog
        confirmation={confirmation}
        onCancel={closeConfirmation}
        onConfirm={confirmJournalAction}
        t={t}
        isDeleting={isDeleting}
      />
    </div>
  );
}
