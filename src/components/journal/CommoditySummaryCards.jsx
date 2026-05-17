import Card from '../ui/Card.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export default function CommoditySummaryCards({ entries, t, statusLabel, isArabic }) {
  function productLabel(productName) {
    return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
  }

  function unitLabel(unitValue) {
    const unit = commodityUnits.find((item) => item.value === unitValue);
    if (!unit) return unitValue;
    return isArabic ? unit.arabicLabel : unit.englishLabel;
  }

  function groupedLines(rows) {
    const grouped = rows.reduce((summary, entry) => {
      const key = `${entry.product}-${entry.unit}`;
      const current = summary[key] || { product: entry.product, unit: entry.unit, quantity: 0 };
      return {
        ...summary,
        [key]: { ...current, quantity: current.quantity + entry.quantity },
      };
    }, {});

    return Object.values(grouped);
  }

  const incomingLines = groupedLines(entries.filter((entry) => entry.lahuWaAlayh === 'Lahu'));
  const outgoingLines = groupedLines(entries.filter((entry) => entry.lahuWaAlayh === 'Alayh'));
  function renderMovementLines(lines) {
    if (lines.length === 0) {
      return <small>{t('journal.noCommodityMovement')}</small>;
    }

    return lines.slice(0, 3).map((line) => (
      <small key={`${line.product}-${line.unit}`}>
        {line.quantity.toLocaleString()} {unitLabel(line.unit)} {productLabel(line.product)}
      </small>
    ));
  }

  return (
    <div className="commodity-summary-grid">
      <Card className="summary-card commodity-summary-card">
        <p>{t('journal.incomingCommodities')}</p>
        <strong>{incomingLines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString()}</strong>
        <div className="summary-lines">{renderMovementLines(incomingLines)}</div>
      </Card>

      <Card className="summary-card commodity-summary-card">
        <p>{t('journal.outgoingCommodities')}</p>
        <strong>{outgoingLines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString()}</strong>
        <div className="summary-lines">{renderMovementLines(outgoingLines)}</div>
      </Card>
    </div>
  );
}
