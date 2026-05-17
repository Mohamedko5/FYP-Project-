import { commodityProductLabels, commodityUnits, formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function PrintableDailyJournal({
  entries,
  reportDate,
  adminName,
  openingBalance,
  totals,
}) {
  const { t, statusLabel, isArabic } = useLanguage();
  const closingBalance = openingBalance + totals.net;
  const isCommodityReport = entries.some((entry) => entry.product);
  const incomingQuantity = isCommodityReport
    ? entries.filter((entry) => entry.lahuWaAlayh === 'Lahu').reduce((sum, entry) => sum + entry.quantity, 0)
    : 0;
  const outgoingQuantity = isCommodityReport
    ? entries.filter((entry) => entry.lahuWaAlayh === 'Alayh').reduce((sum, entry) => sum + entry.quantity, 0)
    : 0;

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unit = commodityUnits.find((item) => item.value === unitValue);
    if (!unit) return unitValue;
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

  return (
    <section className="print-area" aria-label="Printable daily journal report">
      <div className="print-report">
        <header className="print-report__header">
          <h1>{t('companyName')}</h1>
          <p>{t('invoices.systemName')}</p>
          <h2>{isCommodityReport ? t('journal.commodityJournalTitle') : t('print.dailyJournalReport')}</h2>
        </header>

        <div className="print-report__meta">
          <div>
            <span>{t('print.selectedDate')}</span>
            <strong>{reportDate}</strong>
          </div>
          <div>
            <span>{t('print.traderAdminName')}</span>
            <strong>{adminName}</strong>
          </div>
          {isCommodityReport ? (
            <>
              <div>
                <span>{t('journal.dailyCommodityMovement')}</span>
                <strong>{entries.length.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t('journal.totalCommodityIn')}</span>
                <strong>{incomingQuantity.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t('journal.totalCommodityOut')}</span>
                <strong>{outgoingQuantity.toLocaleString()}</strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>{t('print.openingBalance')}</span>
                <strong>{formatCurrency(openingBalance)}</strong>
              </div>
              <div>
                <span>{t('journal.totalIncome')}</span>
                <strong>{formatCurrency(totals.income)}</strong>
              </div>
              <div>
                <span>{t('journal.totalExpenses')}</span>
                <strong>{formatCurrency(totals.expenses)}</strong>
              </div>
              <div>
                <span>{t('print.netDailyBalance')}</span>
                <strong>{formatCurrency(totals.net)}</strong>
              </div>
              <div>
                <span>{t('journal.closingBalance')}</span>
                <strong>{formatCurrency(closingBalance)}</strong>
              </div>
            </>
          )}
        </div>

        <section className="print-report__section">
          <h3>{t('print.transactionTable')}</h3>
          <table className="print-table">
            <thead>
              {isCommodityReport ? (
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.product')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('common.customerSupplier')}</th>
                  <th>{t('journal.lahuAlayh')}</th>
                  <th>{t('journal.estimatedValue')}</th>
                  <th>{t('common.description')}</th>
                </tr>
              ) : (
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.time')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('common.customerSupplier')}</th>
                  <th>{t('common.amount')}</th>
                  <th>{t('common.description')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {entries.map((entry) => (
                isCommodityReport ? (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{productLabel(entry.product)}</td>
                    <td>{entry.quantity}</td>
                    <td>{unitLabel(entry.unit)}</td>
                    <td>{entry.party}</td>
                    <td>{statusLabel(entry.lahuWaAlayh)}</td>
                    <td>{formatCurrency(entry.estimatedValue)}</td>
                    <td>{entry.description}</td>
                  </tr>
                ) : (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.time}</td>
                    <td>{statusLabel(entry.type)}</td>
                    <td>{entry.party}</td>
                    <td>{formatCurrency(entry.amount)}</td>
                    <td>{entry.description}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-report__section">
          <h3>{t('print.endOfDaySummary')}</h3>
          {isCommodityReport ? (
            <p>
              {t('journal.dailyCommodityMovement')}: {entries.length.toLocaleString()} {t('journal.movementOperations')}.
            </p>
          ) : (
            <p>
              {t('print.summarySentence')} {formatCurrency(closingBalance)}.
            </p>
          )}
        </section>

        <footer className="print-report__signature">
          <div>
            <span>{t('print.traderSignature')}</span>
            <strong>{adminName}</strong>
          </div>
          <div>
            <span>{t('print.signature')}</span>
            <strong>&nbsp;</strong>
          </div>
          <div>
            <span>{t('common.date')}</span>
            <strong>&nbsp;</strong>
          </div>
        </footer>
      </div>
    </section>
  );
}
