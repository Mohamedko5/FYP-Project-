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

export function getOrders(filters) {
  return apiRequest(`/api/orders/${queryString(filters)}`);
}

export function getOrder(id) {
  return apiRequest(`/api/orders/${id}/`);
}

export function createOrder(data) {
  return apiRequest('/api/orders/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOrder(id, data) {
  return apiRequest(`/api/orders/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function markOrderReceived(id) {
  return apiRequest(`/api/orders/${id}/mark-received/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function cancelOrder(id, reason) {
  return apiRequest(`/api/orders/${id}/cancel/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function getOrderAvailability(id) {
  return apiRequest(`/api/orders/${id}/availability/`);
}

export function getOrderSummary() {
  return apiRequest('/api/orders/summary/');
}
