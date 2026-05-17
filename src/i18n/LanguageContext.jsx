import { createContext, useContext, useMemo, useState } from 'react';
import { translations } from './translations.js';

const LanguageContext = createContext(null);

function readValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const isArabic = language === 'ar';

  const value = useMemo(() => {
    function t(key) {
      return readValue(translations[language], key) || readValue(translations.en, key) || key;
    }

    function statusLabel(status) {
      return translations[language].status[status] || status;
    }

    function toggleLanguage() {
      setLanguage((current) => (current === 'en' ? 'ar' : 'en'));
    }

    return {
      language,
      isArabic,
      direction: isArabic ? 'rtl' : 'ltr',
      t,
      statusLabel,
      toggleLanguage,
    };
  }, [language, isArabic]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
