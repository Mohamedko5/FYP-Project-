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

export function listJournalTransactions(params) {
  return apiRequest(`/api/journal/transactions/${queryString(params)}`);
}

export function getDailyJournalSummary(params) {
  return apiRequest(`/api/journal/transactions/daily-summary/${queryString(params)}`);
}

export function createJournalTransaction(payload) {
  return apiRequest('/api/journal/transactions/', {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function createWarehouseCommodityTransaction(payload) {
  return apiRequest('/api/journal/warehouse-commodity-transactions/', {
    method: 'POST',
    headers: payload.idempotency_key ? { 'Idempotency-Key': payload.idempotency_key } : undefined,
    body: JSON.stringify(payload),
  });
}

export function reverseWarehouseCommodityTransaction(id, payload) {
  return apiRequest(`/api/journal/warehouse-commodity-transactions/${id}/reverse/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateJournalTransaction(id, payload) {
  return apiRequest(`/api/journal/transactions/${id}/`, {
    method: 'PATCH',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function deleteJournalTransaction(id) {
  return apiRequest(`/api/journal/transactions/${id}/`, {
    method: 'DELETE',
  });
}
