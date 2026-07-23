import { apiRequest } from './apiClient.js';

function queryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getCustomers(params) {
  return apiRequest(`/api/customers/${queryString(params)}`);
}

export function getCustomer(id) {
  return apiRequest(`/api/customers/${id}/`);
}

export function createCustomer(payload) {
  return apiRequest('/api/customers/', {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function updateCustomer(id, payload) {
  return apiRequest(`/api/customers/${id}/`, {
    method: 'PATCH',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function archiveCustomer(id) {
  return apiRequest(`/api/customers/${id}/`, { method: 'DELETE' });
}

export function restoreCustomer(id) {
  return apiRequest(`/api/customers/${id}/restore/`, { method: 'POST' });
}

export function getCustomerSummary() {
  return apiRequest('/api/customers/summary/');
}

export function getCustomerCashTransactions(customerId, params) {
  return apiRequest(`/api/customers/${customerId}/cash-transactions/${queryString(params)}`);
}

export function createCustomerCashTransaction(customerId, payload) {
  return apiRequest(`/api/customers/${customerId}/cash-transactions/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createCustomerPayment(customerId, payload) {
  return apiRequest(`/api/customers/${customerId}/payments/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteCustomerCashTransaction(id) {
  return apiRequest(`/api/customers/cash-transactions/${id}/`, { method: 'DELETE' });
}

export function getCustomerCommodityTransactions(customerId, params) {
  return apiRequest(`/api/customers/${customerId}/commodity-transactions/${queryString(params)}`);
}

export function createCustomerCommodityTransaction(customerId, payload) {
  return apiRequest(`/api/customers/${customerId}/commodity-transactions/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteCustomerCommodityTransaction(id) {
  return apiRequest(`/api/customers/commodity-transactions/${id}/`, { method: 'DELETE' });
}

export function getCustomerStatement(customerId, params) {
  return apiRequest(`/api/customers/${customerId}/statement/${queryString(params)}`);
}
