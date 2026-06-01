export const workerTypes = [
  'General Worker',
  'Bag Carrying Workers',
  'Weighing Worker',
];

export function workerTypeLabel(type, isArabic) {
  const labels = {
    'General Worker': 'عامل عام',
    'Bag Carrying Workers': 'عمال عتالة',
    'Weighing Worker': 'عامل وزن',
  };
  return isArabic ? (labels[type] || type) : type;
}
