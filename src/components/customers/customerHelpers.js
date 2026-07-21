import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export function productLabel(productName, isArabic) {
  return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
}

export function unitLabel(unitValue, isArabic) {
  const unit = commodityUnits.find((item) => item.value === unitValue);
  const fallback = {
    Qintar: { en: 'Qintar', ar: 'Qintar' },
    KG: { en: 'KG', ar: 'KG' },
    Bag: { en: 'Bag', ar: 'Bag' },
    Bale: { en: 'Bale', ar: 'Bale' },
    Unit: { en: 'Unit', ar: 'Unit' },
  }[unitValue];
  return isArabic ? (unit?.arabicLabel || fallback?.ar || unitValue) : (unit?.englishLabel || fallback?.en || unitValue);
}

export function customerTypeLabel(type, isArabic) {
  const normalized = {
    farmer: 'Farmer',
    investor: 'Investor',
    consumer: 'Consumer',
    exporter: 'Exporter',
    factory: 'Factory',
    supplier: 'Supplier',
  }[type] || type;
  const labels = {
    Farmer: 'Farmer',
    Investor: 'Investor',
    Consumer: 'Consumer',
    Exporter: 'Exporter',
    Factory: 'Factory',
    Supplier: 'Supplier',
  };
  return isArabic ? (labels[normalized] || normalized) : normalized;
}
