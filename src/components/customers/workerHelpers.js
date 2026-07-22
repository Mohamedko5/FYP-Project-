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

export function workerTypeLabel(type, t) {
  const normalized = normalizeWorkerType(type);
  return t(`customers.workerTypes.${normalized}`);
}

export function workerStatusLabel(status, t) {
  const key = {
    available: 'Available',
    working: 'Working',
    inactive: 'Inactive',
  }[status] || status;
  return t(`status.${key}`);
}
