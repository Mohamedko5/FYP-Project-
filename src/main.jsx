import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-500.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';
import App from './App.jsx';
import { CurrencyProvider } from './i18n/CurrencyContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import './styles/global.css';
import './styles/print.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <CurrencyProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CurrencyProvider>
    </LanguageProvider>
  </React.StrictMode>
);
