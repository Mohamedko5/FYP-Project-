import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations.js';

const LanguageContext = createContext(null);

function readValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

const normalizedStatusLabels = {
  ar: {
    available: 'متوفر',
    working: 'يعمل',
    inactive: 'غير نشط',
    archived: 'مؤرشف',
    paid: 'مدفوع',
    unpaid: 'غير مدفوع',
    pending: 'معلق',
    received: 'مستلم',
    invoiced: 'مفوتر',
    issued: 'صادرة',
    cancelled: 'ملغى',
    completed: 'مكتمل',
    processing: 'قيد التنفيذ',
    ready_for_shipment: 'جاهز للشحن',
    income: 'إيراد',
    expense: 'مصروف',
    cash: 'نقداً',
    online: 'إلكتروني',
    low_stock: 'مخزون منخفض',
    out_of_stock: 'نفد المخزون',
    not_stocked: 'غير مخزن',
    almost_full: 'شبه ممتلئ',
    full: 'ممتلئ',
    add_stock: 'إضافة مخزون',
    withdraw_stock: 'سحب مخزون',
    shipment_out: 'سحب للشحن',
  },
};

function normalizeStatusKey(status) {
  return String(status || '')
    .trim()
    .replaceAll('-', '_')
    .replaceAll('/', '_')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('bayadLanguage') === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });
  const isArabic = language === 'ar';

  useEffect(() => {
    try {
      localStorage.setItem('bayadLanguage', language);
    } catch {
      // Language persistence is helpful, but the UI can work without storage.
    }
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isArabic]);

  const value = useMemo(() => {
    function t(key) {
      return readValue(translations[language], key) || readValue(translations.en, key) || key;
    }

    function statusLabel(status) {
      return translations[language].status[status]
        || normalizedStatusLabels[language]?.[normalizeStatusKey(status)]
        || status;
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
