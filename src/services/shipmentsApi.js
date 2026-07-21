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

export function getShipments(params) {
  return apiRequest(`/api/shipments/${queryString(params)}`);
}

export function getShipment(id) {
  return apiRequest(`/api/shipments/${id}/`);
}

export function startShipmentProcessing(id, data) {
  return apiRequest(`/api/shipments/${id}/start-processing/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function completeShipment(id) {
  return apiRequest(`/api/shipments/${id}/complete/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function cancelShipment(id, reason) {
  return apiRequest(`/api/shipments/${id}/cancel/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function getShipmentSummary() {
  return apiRequest('/api/shipments/summary/');
}
