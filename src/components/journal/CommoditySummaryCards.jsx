import Card from '../ui/Card.jsx';
import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

const STOCK_IN_OPERATION = 'stock_in';
const MANUAL_WITHDRAWAL_OPERATION = 'manual_withdrawal';

function IncomingIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9" /><path d="m6.5 8.5 3.5 3.5 3.5-3.5" /><path d="M4 15.5h12" /></svg>;
}

function OutgoingIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12V3" /><path d="m6.5 6.5 3.5-3.5 3.5 3.5" /><path d="M4 15.5h12" /></svg>;
}

function groupCommodityMovements(entries, operation) {
  const warehouseField = operation === MANUAL_WITHDRAWAL_OPERATION ? 'sourceWarehouse' : 'destinationWarehouse';

  const grouped = entries
    .filter((entry) => entry.warehouseOperation === operation)
    .reduce((summary, entry) => {
      const warehouseId = entry.warehouseId || '';
      const warehouseName = entry.warehouseName || '';
      const key = [entry.product, entry.unit, warehouseId, warehouseName].join('::');
      const current = summary[key] || {
        product_name: entry.product,
        unit: entry.unit,
        quantity: 0,
        transaction_count: 0,
        [warehouseField]: warehouseName,
      };

      return {
        ...summary,
        [key]: {
          ...current,
          quantity: current.quantity + Number(entry.quantity || 0),
          transaction_count: current.transaction_count + 1,
        },
      };
    }, {});

  return Object.values(grouped).sort((a, b) => {
    const productOrder = String(a.product_name || '').localeCompare(String(b.product_name || ''));
    if (productOrder !== 0) return productOrder;
    const unitOrder = String(a.unit || '').localeCompare(String(b.unit || ''));
    if (unitOrder !== 0) return unitOrder;
    return String(a[warehouseField] || '').localeCompare(String(b[warehouseField] || ''));
  });
}

export default function CommoditySummaryCards({ entries, t, isArabic }) {
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

  function quantityLabel(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }

  function renderMovementRows(lines, type) {
    if (lines.length === 0) {
      return <p className="commodity-summary-empty">{type === 'withdrawn' ? t('journal.noWithdrawnCommoditiesForDate') : t('journal.noAddedCommoditiesForDate')}</p>;
    }

    return lines.map((line) => (
      <article className="commodity-summary-row" key={`${type}-${line.product_name}-${line.unit}-${line.sourceWarehouse || line.destinationWarehouse}`}>
        <strong>{productLabel(line.product_name)}</strong>
        <span>{quantityLabel(line.quantity)} {unitLabel(line.unit)}</span>
        <small>
          {type === 'withdrawn'
            ? `${t('journal.fromWarehouse')}: ${line.sourceWarehouse || '-'}`
            : `${t('journal.toWarehouse')}: ${line.destinationWarehouse || '-'}`}
        </small>
      </article>
    ));
  }

  function renderCardRows(lines, type) {
    const visibleLines = lines.slice(0, 3);
    const hiddenLines = lines.slice(3);

    return (
      <div className="commodity-summary-list">
        {renderMovementRows(visibleLines, type)}
        {hiddenLines.length > 0 && (
          <details className="commodity-summary-more">
            <summary>{t('journal.viewAll')}</summary>
            <div className="commodity-summary-list commodity-summary-list--expanded">
              {renderMovementRows(hiddenLines, type)}
            </div>
          </details>
        )}
      </div>
    );
  }

  const withdrawnLines = groupCommodityMovements(entries, MANUAL_WITHDRAWAL_OPERATION);
  const addedLines = groupCommodityMovements(entries, STOCK_IN_OPERATION);

  return (
    <div className="commodity-summary-grid">
      <Card className="summary-card commodity-summary-card commodity-summary-card--withdrawn">
        <div className="commodity-summary-card__header">
          <span className="commodity-summary-card__icon"><OutgoingIcon /></span>
          <p>{t('journal.withdrawnCommodities')}</p>
        </div>
        {renderCardRows(withdrawnLines, 'withdrawn')}
      </Card>

      <Card className="summary-card commodity-summary-card commodity-summary-card--added">
        <div className="commodity-summary-card__header">
          <span className="commodity-summary-card__icon"><IncomingIcon /></span>
          <p>{t('journal.addedCommodities')}</p>
        </div>
        {renderCardRows(addedLines, 'added')}
      </Card>
    </div>
  );
}
