export const currencyStorageKey = 'bayadCurrency';

export function getStoredCurrency() {
  if (typeof localStorage === 'undefined') return 'SDG';
  return localStorage.getItem(currencyStorageKey) || 'SDG';
}

export function setStoredCurrency(currency) {
  localStorage.setItem(currencyStorageKey, currency);
}

export function formatMoney(value, currency = getStoredCurrency()) {
  const numericValue = Number(value || 0);
  return `${currency} ${numericValue.toLocaleString()}`;
}
