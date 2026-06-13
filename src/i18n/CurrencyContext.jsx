import { createContext, useContext, useMemo, useState } from 'react';
import { formatMoney, getStoredCurrency, setStoredCurrency } from '../data/currencyFormat.js';

export const currencyOptions = [
  { code: 'SDG', labelKey: 'currency.sdg' },
  { code: 'RM', labelKey: 'currency.myr' },
  { code: 'USD', labelKey: 'currency.usd' },
];

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(getStoredCurrency);

  const value = useMemo(() => {
    function setCurrency(nextCurrency) {
      setStoredCurrency(nextCurrency);
      setCurrencyState(nextCurrency);
    }

    function formatCurrency(valueToFormat) {
      return formatMoney(valueToFormat, currency);
    }

    return {
      currency,
      setCurrency,
      formatCurrency,
      currencyOptions,
    };
  }, [currency]);

  return (
    <CurrencyContext.Provider value={value}>
      <div className="currency-app-refresh" key={currency}>
        {children}
      </div>
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
