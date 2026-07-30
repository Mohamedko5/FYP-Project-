import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations.js';

const LanguageContext = createContext(null);

function readValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

const normalizedStatusLabels = {
  en: {
    draft: 'Draft',
    pending_information: 'Pending Information',
    pending_verification: 'Pending Verification',
    assessed: 'Assessed',
    approved: 'Approved',
    exempt: 'Exempt',
    previously_paid: 'Previously Paid',
    partially_paid: 'Partially Paid',
    paid: 'Paid',
    disputed: 'Disputed',
    cancelled: 'Cancelled',
    unpaid: 'Unpaid',
    partial: 'Partial',
    pending: 'Pending',
    verified: 'Verified',
    rejected: 'Rejected',
    expired: 'Expired',
    duplicate: 'Duplicate',
    valid: 'Valid',
    expiring: 'Expiring',
    suspended: 'Suspended',
    pending_approval: 'Pending Approval',
    pending_zakat_verification: 'Pending Zakat Verification',
    used: 'Used',
    crop: 'Crop',
    trade: 'Trade',
    crop_zakat: 'Crop Zakat',
    trade_zakat: 'Trade Zakat',
    official_external_receipt: 'Official External Receipt',
    internal_payment_record: 'Internal Payment Record',
    natural: 'Natural',
    artificial: 'Artificial',
    mixed: 'Mixed',
    unknown: 'Unknown',
    quantity_percentage: 'Quantity Percentage',
    monetary_percentage: 'Monetary Percentage',
    manual_official_assessment: 'Manual Official Assessment',
    locally_confirmed: 'Locally Confirmed',
  },
  ar: {
    draft: 'مسودة',
    pending_information: 'بانتظار المعلومات',
    pending_verification: 'بانتظار التحقق',
    assessed: 'تم التقييم',
    approved: 'معتمد',
    exempt: 'معفى',
    previously_paid: 'مدفوع سابقاً',
    partially_paid: 'مدفوع جزئياً',
    disputed: 'محل نزاع',
    partial: 'جزئي',
    verified: 'تم التحقق',
    rejected: 'مرفوض',
    expired: 'منتهي',
    duplicate: 'مكرر',
    valid: 'ساري',
    expiring: 'ينتهي قريباً',
    suspended: 'معلق',
    pending_approval: 'بانتظار الاعتماد',
    pending_zakat_verification: 'بانتظار تحقق الزكاة',
    used: 'مستخدم',
    crop: 'محصول',
    trade: 'تجارة',
    crop_zakat: 'زكاة محاصيل',
    trade_zakat: 'زكاة تجارة',
    official_external_receipt: 'إيصال رسمي خارجي',
    internal_payment_record: 'سجل دفع داخلي',
    natural: 'طبيعي',
    artificial: 'صناعي',
    mixed: 'مختلط',
    unknown: 'غير معروف',
    quantity_percentage: 'نسبة من الكمية',
    monetary_percentage: 'نسبة من القيمة',
    manual_official_assessment: 'تقييم رسمي يدوي',
    locally_confirmed: 'مؤكد محلياً',
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
