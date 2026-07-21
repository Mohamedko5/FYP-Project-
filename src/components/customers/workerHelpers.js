export const workerTypes = [
  'general_worker',
  'bag_carrying_worker',
  'weighing_worker',
];

export function normalizeWorkerType(type) {
  return {
    'General Worker': 'general_worker',
    'Bag Carrying Workers': 'bag_carrying_worker',
    'Bag Carrying Worker': 'bag_carrying_worker',
    'Weighing Worker': 'weighing_worker',
  }[type] || type;
}

export function workerTypeLabel(type, isArabic) {
  const normalized = normalizeWorkerType(type);
  const labels = {
    general_worker: { en: 'General Worker', ar: 'General Worker' },
    bag_carrying_worker: { en: 'Bag Carrying Worker', ar: 'Bag Carrying Worker' },
    weighing_worker: { en: 'Weighing Worker', ar: 'Weighing Worker' },
  };
  return labels[normalized]?.[isArabic ? 'ar' : 'en'] || type;
}

export function workerStatusLabel(status, t) {
  const key = {
    available: 'Available',
    working: 'Working',
    inactive: 'Inactive',
  }[status] || status;
  return t(`status.${key}`);
}
