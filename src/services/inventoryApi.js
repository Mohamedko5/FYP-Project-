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

export function getProducts(params) {
  return apiRequest(`/api/inventory/products/${queryString(params)}`);
}

export function getWarehouses(params) {
  return apiRequest(`/api/inventory/warehouses/${queryString(params)}`);
}

export function getStocks(params) {
  return apiRequest(`/api/inventory/stocks/${queryString(params)}`);
}

export function getWarehouse(id) {
  return apiRequest(`/api/inventory/warehouses/${id}/`);
}

export function createWarehouse(data) {
  return apiRequest('/api/inventory/warehouses/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateWarehouse(id, data) {
  return apiRequest(`/api/inventory/warehouses/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function archiveWarehouse(id) {
  return apiRequest(`/api/inventory/warehouses/${id}/`, { method: 'DELETE' });
}

export function addStock(warehouseId, data) {
  return apiRequest(`/api/inventory/warehouses/${warehouseId}/add-stock/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function withdrawStock(warehouseId, data) {
  return apiRequest(`/api/inventory/warehouses/${warehouseId}/withdraw-stock/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getWarehouseMovements(warehouseId, params) {
  return apiRequest(`/api/inventory/warehouses/${warehouseId}/movements/${queryString(params)}`);
}

export function getInventoryMovements(params) {
  return apiRequest(`/api/inventory/movements/${queryString(params)}`);
}

export function getInventorySummary() {
  return apiRequest('/api/inventory/summary/');
}
