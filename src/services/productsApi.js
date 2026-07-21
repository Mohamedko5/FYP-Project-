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

export function getManagedProducts(params) {
  return apiRequest(`/api/products/${queryString(params)}`);
}

export function getProductSummary() {
  return apiRequest('/api/products/summary/');
}

export function getProductOptions() {
  return apiRequest('/api/products/options/');
}

export function createManagedProduct(data) {
  return apiRequest('/api/products/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateManagedProduct(id, data) {
  return apiRequest(`/api/products/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function archiveManagedProduct(id) {
  return apiRequest(`/api/products/${id}/`, { method: 'DELETE' });
}
