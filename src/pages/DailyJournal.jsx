import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import PrintableDailyJournal from '../components/reports/PrintableDailyJournal.jsx';
import JournalTypeSelector from '../components/journal/JournalTypeSelector.jsx';
import CashJournalForm from '../components/journal/CashJournalForm.jsx';
import CashJournalTable from '../components/journal/CashJournalTable.jsx';
import CommodityJournalForm from '../components/journal/CommodityJournalForm.jsx';
import CommodityJournalTable from '../components/journal/CommodityJournalTable.jsx';
import CommoditySummaryCards from '../components/journal/CommoditySummaryCards.jsx';
import { commodityJournalEntries, commodityUnits, formatCurrency, journalEntries, products } from '../data/dummyData.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyCashForm(date) {
  return {
    date,
    time: '09:00',
    type: 'Income',
    amount: '',
    description: '',
    party: '',
  };
}

function createEmptyCommodityForm(date) {
  return {
    date,
    product: 'White Sesame',
    quantity: '',
    unit: 'Qintar',
    party: '',
    lahuWaAlayh: 'Lahu',
    estimatedValue: '',
    description: '',
  };
}

export default function DailyJournal() {
  const { t, statusLabel, isArabic } = useLanguage();
  const { setHeaderAddon } = useOutletContext();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [draftDate, setDraftDate] = useState(getTodayDate());
  const [journalType, setJournalType] = useState('cash');
  const [cashEntries, setCashEntries] = useState(journalEntries);
  const [commodityEntries, setCommodityEntries] = useState(commodityJournalEntries);
  const [cashForm, setCashForm] = useState(() => createEmptyCashForm(getTodayDate()));
  const [commodityForm, setCommodityForm] = useState(() => createEmptyCommodityForm(getTodayDate()));
  const [editingCashId, setEditingCashId] = useState(null);
  const [editingCommodityId, setEditingCommodityId] = useState(null);
  const [showCashForm, setShowCashForm] = useState(false);
  const [showCommodityForm, setShowCommodityForm] = useState(false);
  const [cashErrors, setCashErrors] = useState([]);
  const [commodityErrors, setCommodityErrors] = useState([]);
  const [adminName, setAdminName] = useState('Bayad Admin');

  const dailyCashEntries = useMemo(
    () => cashEntries.filter((entry) => entry.date === selectedDate),
    [cashEntries, selectedDate]
  );

  const dailyCommodityEntries = useMemo(
    () => commodityEntries.filter((entry) => entry.date === selectedDate),
    [commodityEntries, selectedDate]
  );

  const openingBalanceEntry = useMemo(() => {
    return dailyCashEntries
      .filter((entry) => entry.type === 'Income')
      .reduce((firstEntry, entry) => {
        if (!firstEntry) return entry;
        return Number(entry.id) < Number(firstEntry.id) ? entry : firstEntry;
      }, null);
  }, [dailyCashEntries]);

  const openingBalance = openingBalanceEntry?.amount || 0;

  const cashTotals = useMemo(() => {
    const income = dailyCashEntries
      .filter((entry) => entry.type === 'Income' && entry.id !== openingBalanceEntry?.id)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = dailyCashEntries.filter((entry) => entry.type === 'Expense').reduce((sum, entry) => sum + entry.amount, 0);
    return { income, expenses, net: income - expenses, closing: openingBalance + income - expenses };
  }, [dailyCashEntries, openingBalance, openingBalanceEntry]);

  function handleJournalTypeChange(nextType) {
    setJournalType(nextType);
    setCashErrors([]);
    setCommodityErrors([]);
    setEditingCashId(null);
    setEditingCommodityId(null);
    setShowCashForm(false);
    setShowCommodityForm(false);
    setCashForm(createEmptyCashForm(selectedDate));
    setCommodityForm(createEmptyCommodityForm(selectedDate));
  }

  function loadJournalDate(nextDate) {
    setSelectedDate(nextDate);
    setDraftDate(nextDate);
    setEditingCashId(null);
    setEditingCommodityId(null);
    setShowCashForm(false);
    setShowCommodityForm(false);
    setCashForm(createEmptyCashForm(nextDate));
    setCommodityForm(createEmptyCommodityForm(nextDate));
    setCashErrors([]);
    setCommodityErrors([]);
  }

  function handleViewJournal() {
    loadJournalDate(draftDate);
  }

  function handleCashChange(event) {
    const { name, value } = event.target;
    setCashForm((current) => ({ ...current, [name]: value }));
  }

  function handleCommodityChange(event) {
    const { name, value } = event.target;
    setCommodityForm((current) => ({ ...current, [name]: value }));
  }

  function validateCashForm() {
    const nextErrors = [];
    if (!cashForm.date || !cashForm.time || !cashForm.party.trim() || cashForm.amount === '' || !cashForm.description.trim()) {
      nextErrors.push(t('journal.requiredFieldsError'));
    }
    if (Number(cashForm.amount) < 0) {
      nextErrors.push(t('journal.negativeAmountError'));
    }
    setCashErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function validateCommodityForm() {
    const nextErrors = [];
    if (!commodityForm.date || !commodityForm.product || commodityForm.quantity === '' || !commodityForm.party.trim() || commodityForm.estimatedValue === '' || !commodityForm.description.trim()) {
      nextErrors.push(t('journal.commodityRequiredFieldsError'));
    }
    if (Number(commodityForm.quantity) < 0) {
      nextErrors.push(t('journal.negativeQuantityError'));
    }
    if (Number(commodityForm.estimatedValue) < 0) {
      nextErrors.push(t('journal.negativeEstimatedValueError'));
    }
    setCommodityErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function handleCashSubmit(event) {
    event.preventDefault();
    if (!validateCashForm()) return;

    const payload = { ...cashForm, amount: Number(cashForm.amount) };
    if (editingCashId) {
      setCashEntries((current) => current.map((entry) => (entry.id === editingCashId ? { ...entry, ...payload } : entry)));
      setEditingCashId(null);
    } else {
      setCashEntries((current) => [{ id: Date.now(), ...payload }, ...current]);
    }
    setCashForm(createEmptyCashForm(selectedDate));
    setCashErrors([]);
    setShowCashForm(false);
  }

  function handleCommoditySubmit(event) {
    event.preventDefault();
    if (!validateCommodityForm()) return;

    const payload = {
      ...commodityForm,
      quantity: Number(commodityForm.quantity),
      estimatedValue: Number(commodityForm.estimatedValue),
    };

    if (editingCommodityId) {
      setCommodityEntries((current) => current.map((entry) => (entry.id === editingCommodityId ? { ...entry, ...payload } : entry)));
      setEditingCommodityId(null);
    } else {
      setCommodityEntries((current) => [{ id: Date.now(), ...payload }, ...current]);
    }
    setCommodityForm(createEmptyCommodityForm(selectedDate));
    setCommodityErrors([]);
    setShowCommodityForm(false);
  }

  function handleCashEdit(entry) {
    setEditingCashId(entry.id);
    setShowCashForm(true);
    setCashForm({ ...entry, amount: String(entry.amount) });
    setCashErrors([]);
  }

  function handleCommodityEdit(entry) {
    setEditingCommodityId(entry.id);
    setShowCommodityForm(true);
    setCommodityForm({
      date: entry.date,
      product: entry.product,
      quantity: String(entry.quantity),
      unit: entry.unit,
      party: entry.party,
      lahuWaAlayh: entry.lahuWaAlayh,
      estimatedValue: String(entry.estimatedValue),
      description: entry.description,
    });
    setCommodityErrors([]);
  }

  function handleCashCancel() {
    setEditingCashId(null);
    setShowCashForm(false);
    setCashForm(createEmptyCashForm(selectedDate));
    setCashErrors([]);
  }

  function handleCashDelete(entryId) {
    setCashEntries((current) => current.filter((entry) => entry.id !== entryId));
    if (editingCashId === entryId) {
      handleCashCancel();
    }
  }

  function handleCommodityCancel() {
    setEditingCommodityId(null);
    setShowCommodityForm(false);
    setCommodityForm(createEmptyCommodityForm(selectedDate));
    setCommodityErrors([]);
  }

  function handleAddCommodityTransaction() {
    setEditingCommodityId(null);
    setCommodityForm(createEmptyCommodityForm(selectedDate));
    setCommodityErrors([]);
    setShowCommodityForm(true);
  }

  function handleAddCashTransaction() {
    setEditingCashId(null);
    setCashForm(createEmptyCashForm(selectedDate));
    setCashErrors([]);
    setShowCashForm(true);
  }

  function handlePrint() {
    window.print();
  }

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
            <Button onClick={handleViewJournal}>{t('journal.viewJournal')}</Button>
            <Button variant="secondary" onClick={handlePrint}>{t('journal.printPdf')}</Button>
          </div>
          <p>
            {t('journal.viewingJournalFor')} <strong>{selectedDate}</strong>
          </p>
        </div>
      </Card>

      {journalType === 'cash' ? (
        <>
          <div className="summary-grid">
            <Card className="summary-card">
              <p>{t('journal.openingBalance')}</p>
              <strong>{formatCurrency(openingBalance)}</strong>
              <small>{selectedDate}</small>
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
            <div className="journal-table-toolbar">
              <Button onClick={handleAddCashTransaction}>{t('journal.addTransaction')}</Button>
            </div>
            <CashJournalTable
              entries={dailyCashEntries}
              openingBalanceEntryId={openingBalanceEntry?.id}
              onEdit={handleCashEdit}
              onDelete={handleCashDelete}
              t={t}
              emptyMessage={t('journal.noTransactionsForDate')}
            />
          </Card>

          {showCashForm && (
            <Card
              className="journal-expandable-form"
              title={editingCashId ? t('journal.editingTitle') : t('journal.cashJournalTitle')}
              subtitle={editingCashId ? t('journal.editingSubtitle') : t('journal.cashJournalSubtitle')}
            >
              <CashJournalForm
                form={cashForm}
                errors={cashErrors}
                isEditing={Boolean(editingCashId)}
                onChange={handleCashChange}
                onSubmit={handleCashSubmit}
                onCancel={handleCashCancel}
                t={t}
                statusLabel={statusLabel}
              />
            </Card>
          )}

          <PrintableDailyJournal
            entries={dailyCashEntries}
            reportDate={selectedDate}
            adminName={adminName}
            openingBalance={openingBalance}
            totals={cashTotals}
          />
        </>
      ) : (
        <>
          <CommoditySummaryCards entries={dailyCommodityEntries} t={t} statusLabel={statusLabel} isArabic={isArabic} />

          <Card title={t('journal.commodityJournalTitle')} subtitle={t('journal.commodityHistorySubtitle')}>
            <div className="journal-table-toolbar">
              <Button onClick={handleAddCommodityTransaction}>{t('journal.addTransaction')}</Button>
            </div>
            <CommodityJournalTable
              entries={dailyCommodityEntries}
              onEdit={handleCommodityEdit}
              t={t}
              statusLabel={statusLabel}
              isArabic={isArabic}
              emptyMessage={t('journal.noTransactionsForDate')}
            />
          </Card>

          {showCommodityForm && (
            <Card
              className="journal-expandable-form"
              title={editingCommodityId ? t('journal.editingCommodityTitle') : t('journal.addCommodityTitle')}
              subtitle={editingCommodityId ? t('journal.editingCommoditySubtitle') : t('journal.addCommoditySubtitle')}
            >
              <CommodityJournalForm
                form={commodityForm}
                errors={commodityErrors}
                isEditing={Boolean(editingCommodityId)}
                products={products}
                units={commodityUnits}
                isArabic={isArabic}
                onChange={handleCommodityChange}
                onSubmit={handleCommoditySubmit}
                onCancel={handleCommodityCancel}
                t={t}
                statusLabel={statusLabel}
              />
            </Card>
          )}

          <PrintableDailyJournal
            entries={dailyCommodityEntries}
            reportDate={selectedDate}
            adminName={adminName}
            openingBalance={0}
            totals={{ income: 0, expenses: 0, net: 0, closing: 0 }}
          />
        </>
      )}
    </div>
  );
}
