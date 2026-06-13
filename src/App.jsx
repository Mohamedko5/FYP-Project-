import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DailyJournal from './pages/DailyJournal.jsx';
import WarehouseInventory from './pages/WarehouseInventory.jsx';
import Customers from './pages/Customers.jsx';
import Products from './pages/Products.jsx';
import Orders from './pages/Orders.jsx';
import WeighingShipment from './pages/WeighingShipment.jsx';
import Invoices from './pages/Invoices.jsx';
import Reports from './pages/Reports.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => (
    sessionStorage.getItem('bayadAuthSession') === 'true' || localStorage.getItem('bayadAuthRemembered') === 'true'
  ));

  function handleLogin(remember = false) {
    sessionStorage.setItem('bayadAuthSession', 'true');
    if (remember) {
      localStorage.setItem('bayadAuthRemembered', 'true');
    } else {
      localStorage.removeItem('bayadAuthRemembered');
    }
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('bayadAuth');
    localStorage.removeItem('bayadAuthRemembered');
    sessionStorage.removeItem('bayadAuthSession');
    setIsAuthenticated(false);
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Dashboard />} />
        <Route path="daily-journal" element={<DailyJournal />} />
        <Route path="warehouse-inventory" element={<WarehouseInventory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="weighing-shipment" element={<WeighingShipment />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}
