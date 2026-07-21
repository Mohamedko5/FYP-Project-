export const currencyStorageKey = 'bayadCurrency';

export function getStoredCurrency() {
  if (typeof localStorage === 'undefined') return 'SDG';
  const storedCurrency = localStorage.getItem(currencyStorageKey);
  return storedCurrency === 'SDG' ? storedCurrency : 'SDG';
}

export function setStoredCurrency(currency) {
  localStorage.setItem(currencyStorageKey, 'SDG');
}

export function formatMoney(value, currency = getStoredCurrency()) {
  const numericValue = Number(value || 0);
  return `SDG ${numericValue.toLocaleString()}`;
}
