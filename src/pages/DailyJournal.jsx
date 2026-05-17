import { useMemo, useState } from 'react';
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

const emptyCashForm = {
  date: '2026-05-17',
  time: '09:00',
  type: 'Income',
  amount: '',
  description: '',
  party: '',
};

const emptyCommodityForm = {
  date: '2026-05-17',
  product: 'White Sesame',
  quantity: '',
  unit: 'Qintar',
  party: '',
  lahuWaAlayh: 'Lahu',
  estimatedValue: '',
  description: '',
};

export default function DailyJournal() {
  const { t, statusLabel, isArabic } = useLanguage();
  const [journalType, setJournalType] = useState('cash');
  const [cashEntries, setCashEntries] = useState(journalEntries);
  const [commodityEntries, setCommodityEntries] = useState(commodityJournalEntries);
  const [cashForm, setCashForm] = useState(emptyCashForm);
  const [commodityForm, setCommodityForm] = useState(emptyCommodityForm);
  const [editingCashId, setEditingCashId] = useState(null);
  const [editingCommodityId, setEditingCommodityId] = useState(null);
  const [cashErrors, setCashErrors] = useState([]);
  const [commodityErrors, setCommodityErrors] = useState([]);
  const [reportDate, setReportDate] = useState('2026-05-17');
  const [adminName, setAdminName] = useState('Bayad Admin');
  const [openingBalance, setOpeningBalance] = useState(1010000);

  const dailyCashEntries = useMemo(
    () => cashEntries.filter((entry) => entry.date === reportDate),
    [cashEntries, reportDate]
  );

  const cashTotals = useMemo(() => {
    const income = dailyCashEntries.filter((entry) => entry.type === 'Income').reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = dailyCashEntries.filter((entry) => entry.type === 'Expense').reduce((sum, entry) => sum + entry.amount, 0);
    return { income, expenses, net: income - expenses, closing: openingBalance + income - expenses };
  }, [dailyCashEntries, openingBalance]);

  function handleJournalTypeChange(nextType) {
    setJournalType(nextType);
    setCashErrors([]);
    setCommodityErrors([]);
    setEditingCashId(null);
    setEditingCommodityId(null);
    setCashForm(emptyCashForm);
    setCommodityForm(emptyCommodityForm);
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
    setCashForm(emptyCashForm);
    setCashErrors([]);
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
    setCommodityForm(emptyCommodityForm);
    setCommodityErrors([]);
  }

  function handleCashEdit(entry) {
    setEditingCashId(entry.id);
    setCashForm({ ...entry, amount: String(entry.amount) });
    setCashErrors([]);
  }

  function handleCommodityEdit(entry) {
    setEditingCommodityId(entry.id);
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
    setCashForm(emptyCashForm);
    setCashErrors([]);
  }

  function handleCommodityCancel() {
    setEditingCommodityId(null);
    setCommodityForm(emptyCommodityForm);
    setCommodityErrors([]);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="page-grid">
      <Card title={t('journal.journalType')} subtitle={t('journal.commodityJournalSubtitle')}>
        <JournalTypeSelector journalType={journalType} onChange={handleJournalTypeChange} t={t} />
      </Card>

      {journalType === 'cash' ? (
        <>
          <Card title={t('print.reportSettings')} subtitle={t('print.reportSettingsSubtitle')}>
            <div className="journal-toolbar">
              <div className="journal-toolbar__fields">
                <label>
                  {t('print.selectedDate')}
                  <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
                </label>
                <label>
                  {t('print.traderAdminName')}
                  <input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder={t('print.adminNamePlaceholder')} />
                </label>
                <label>
                  {t('journal.openingBalance')}
                  <input type="number" value={openingBalance} onChange={(event) => setOpeningBalance(Number(event.target.value))} placeholder="0" />
                </label>
              </div>
              <Button onClick={handlePrint}>
                {t('print.printDailyJournal')} / {t('print.exportPdf')}
              </Button>
            </div>
          </Card>

          <div className="summary-grid">
            <Card className="summary-card">
              <p>{t('journal.openingBalance')}</p>
              <strong>{formatCurrency(openingBalance)}</strong>
              <small>{reportDate}</small>
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

          <Card
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

          <Card title={t('journal.endOfDaySummary')} subtitle={t('journal.historySubtitle')}>
            <CashJournalTable entries={dailyCashEntries} onEdit={handleCashEdit} t={t} />
          </Card>

          <PrintableDailyJournal
            entries={dailyCashEntries}
            reportDate={reportDate}
            adminName={adminName}
            openingBalance={openingBalance}
            totals={cashTotals}
          />
        </>
      ) : (
        <>
          <CommoditySummaryCards entries={commodityEntries} t={t} statusLabel={statusLabel} isArabic={isArabic} />

          <Card
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

          <Card title={t('journal.commodityJournalTitle')} subtitle={t('journal.commodityHistorySubtitle')}>
            <CommodityJournalTable
              entries={commodityEntries}
              onEdit={handleCommodityEdit}
              t={t}
              statusLabel={statusLabel}
              isArabic={isArabic}
            />
          </Card>
        </>
      )}
    </div>
  );
}
