import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/layout/Layout.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DailyJournal from './pages/DailyJournal.jsx';
import WarehouseInventory from './pages/WarehouseInventory.jsx';
import Customers from './pages/Customers.jsx';
import Products from './pages/Products.jsx';
import Orders from './pages/Orders.jsx';
import WeighingShipment from './pages/WeighingShipment.jsx';
import Invoices from './pages/Invoices.jsx';
import Reports from './pages/Reports.jsx';
import CustomerMessages from './pages/CustomerMessages.jsx';
import SupplyOffers from './pages/SupplyOffers.jsx';
import ZakatManagement from './pages/ZakatManagement.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => (
    Boolean(localStorage.getItem('bayadAccessToken'))
  ));

  function handleLogin(authData) {
    localStorage.setItem('bayadAccessToken', authData.access);
    localStorage.setItem('bayadRefreshToken', authData.refresh);
    localStorage.setItem('bayadUser', JSON.stringify(authData.user));
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('bayadAccessToken');
    localStorage.removeItem('bayadRefreshToken');
    localStorage.removeItem('bayadUser');
    setIsAuthenticated(false);
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="daily-journal" element={<DailyJournal />} />
          <Route path="warehouse-inventory" element={<WarehouseInventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="orders" element={<Orders />} />
          <Route path="weighing-shipment" element={<WeighingShipment />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="customer-messages" element={<CustomerMessages />} />
          <Route path="supply-offers" element={<SupplyOffers />} />
          <Route path="zakat" element={<ZakatManagement />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
