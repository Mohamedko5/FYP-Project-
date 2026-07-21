import { commodityProductLabels, commodityUnits, formatCurrency } from '../../data/dummyData.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function PrintableDailyJournal({
  entries,
  reportDate,
  adminName,
  openingBalance,
  totals,
  commoditySummary = null,
}) {
  const { t, statusLabel, isArabic } = useLanguage();
  const closingBalance = openingBalance + totals.net;
  const isCommodityReport = entries.some((entry) => entry.product);
  const commodityGroups = commoditySummary?.groups || [];
  const commodityTransactionCount = commoditySummary?.transaction_count ?? entries.length;
  const commodityEstimatedTotalValue = commoditySummary?.estimated_total_value ?? entries.reduce((sum, entry) => sum + entry.estimatedValue, 0);
  const unitLabels = {
    Qintar: { en: 'Qintar', ar: commodityUnits.find((unit) => unit.value === 'Qintar')?.arabicLabel || 'Qintar' },
    KG: { en: 'KG', ar: 'KG' },
    Bag: { en: 'Bag', ar: 'Bag' },
    Bale: { en: 'Bale', ar: commodityUnits.find((unit) => unit.value === 'Bale')?.arabicLabel || 'Bale' },
    Unit: { en: 'Unit', ar: commodityUnits.find((unit) => unit.value === 'Piece')?.arabicLabel || 'Unit' },
  };

  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    if (unitLabels[unitValue]) return unitLabels[unitValue][isArabic ? 'ar' : 'en'];
    const unit = commodityUnits.find((item) => item.value === unitValue);
    if (!unit) return unitValue;
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

  function renderCommodityGroups(groups) {
    if (groups.length === 0) return t('journal.noCommodityMovement');
    return groups
      .map((group) => `${Number(group.quantity).toLocaleString()} ${unitLabel(group.unit)} ${productLabel(group.product_name)} (${formatCurrency(Number(group.estimated_value))})`)
      .join(' / ');
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
                <strong>{Number(commodityTransactionCount).toLocaleString()}</strong>
              </div>
              <div>
                <span>{t('journal.totalEstimatedValue')}</span>
                <strong>{formatCurrency(Number(commodityEstimatedTotalValue))}</strong>
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
                  <th>{t('common.time')}</th>
                  <th>{t('common.product')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('common.customerSupplier')}</th>
                  <th>{t('journal.estimatedValue')}</th>
                  <th>{t('common.description')}</th>
                </tr>
              ) : (
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.time')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('journal.paymentMethod')}</th>
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
                    <td>{entry.time || '-'}</td>
                    <td>{productLabel(entry.product)}</td>
                    <td>{entry.quantity}</td>
                    <td>{unitLabel(entry.unit)}</td>
                    <td>{entry.party}</td>
                    <td>{formatCurrency(entry.estimatedValue)}</td>
                    <td>{entry.description}</td>
                  </tr>
                ) : (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.time}</td>
                    <td>{statusLabel(entry.type)}</td>
                    <td>{t(`journal.paymentMethods.${entry.paymentMethod || 'cash'}`)}</td>
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
            <p>{t('journal.productGroups')}: {renderCommodityGroups(commodityGroups)}.</p>
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
