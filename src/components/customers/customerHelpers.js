import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export function productLabel(productName, isArabic) {
  return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
}

export function unitLabel(unitValue, isArabic) {
  const unit = commodityUnits.find((item) => item.value === unitValue);
  const fallback = {
    Qintar: { en: 'Qintar', ar: 'قنطار' },
    KG: { en: 'KG', ar: 'كجم' },
    kg: { en: 'kg', ar: 'كجم' },
    Bag: { en: 'Bag', ar: 'جوال' },
    Bale: { en: 'Bale', ar: 'بالة' },
    Unit: { en: 'Unit', ar: 'وحدة' },
  }[unitValue];
  return isArabic ? (unit?.arabicLabel || fallback?.ar || unitValue) : (unit?.englishLabel || fallback?.en || unitValue);
}

export function customerTypeLabel(type, t) {
  const key = String(type || '')
    .trim()
    .replaceAll('-', '_')
    .replace(/\s+/g, '_')
    .toLowerCase();
  const normalized = {
    farmer: 'farmer',
    investor: 'investor',
    consumer: 'consumer',
    exporter: 'exporter',
    factory: 'factory',
    supplier: 'supplier',
  }[key];
  return normalized ? t(`customers.types.${normalized}`) : '-';
}
