import { commodityProductLabels, commodityUnits } from '../../data/dummyData.js';

export function productLabel(productName, isArabic) {
  return commodityProductLabels[productName]?.[isArabic ? 'ar' : 'en'] || productName;
}

export function unitLabel(unitValue, isArabic) {
  const unit = commodityUnits.find((item) => item.value === unitValue);
  return isArabic ? (unit?.arabicLabel || unitValue) : (unit?.englishLabel || unitValue);
}

export function customerTypeLabel(type, isArabic) {
  const labels = {
    Farmer: 'مزارع',
    Investor: 'مستثمر',
    Consumer: 'مستهلك',
    Exporter: 'مصدر',
    Factory: 'مصنع',
    Supplier: 'مورد',
  };
  return isArabic ? (labels[type] || type) : type;
}
