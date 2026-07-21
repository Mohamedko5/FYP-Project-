import Card from '../ui/Card.jsx';
import { commodityProductLabels, commodityUnits, formatCurrency } from '../../data/dummyData.js';

export default function CommoditySummaryCards({ entries, summary, t, isArabic }) {
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

  function groupedLines(rows) {
    const grouped = rows.reduce((summary, entry) => {
      const key = `${entry.product}-${entry.unit}`;
      const current = summary[key] || { product_name: entry.product, unit: entry.unit, quantity: 0, estimated_value: 0, transaction_count: 0 };
      return {
        ...summary,
        [key]: {
          ...current,
          quantity: current.quantity + entry.quantity,
          estimated_value: current.estimated_value + entry.estimatedValue,
          transaction_count: current.transaction_count + 1,
        },
      };
    }, {});

    return Object.values(grouped);
  }

  const groups = summary?.groups || groupedLines(entries);
  const transactionCount = summary?.transaction_count ?? entries.length;
  const estimatedTotalValue = summary?.estimated_total_value ?? entries.reduce((sum, entry) => sum + entry.estimatedValue, 0);

  function renderMovementLines(lines) {
    if (lines.length === 0) {
      return <small>{t('journal.noCommodityMovement')}</small>;
    }

    return lines.slice(0, 3).map((line) => (
      <small key={`${line.product_name}-${line.unit}`}>
        {Number(line.quantity).toLocaleString()} {unitLabel(line.unit)} {productLabel(line.product_name)}
      </small>
    ));
  }

  return (
    <div className="commodity-summary-grid">
      <Card className="summary-card commodity-summary-card">
        <p>{t('journal.totalCommodityTransactions')}</p>
        <strong>{Number(transactionCount).toLocaleString()}</strong>
        <div className="summary-lines">{renderMovementLines(groups)}</div>
      </Card>

      <Card className="summary-card commodity-summary-card">
        <p>{t('journal.totalEstimatedValue')}</p>
        <strong>{formatCurrency(Number(estimatedTotalValue))}</strong>
        <div className="summary-lines">
          {groups.length === 0 ? <small>{t('journal.noCommodityMovement')}</small> : groups.slice(0, 3).map((line) => (
            <small key={`${line.product_name}-${line.unit}-value`}>
              {productLabel(line.product_name)}: {formatCurrency(Number(line.estimated_value))}
            </small>
          ))}
        </div>
      </Card>
    </div>
  );
}
