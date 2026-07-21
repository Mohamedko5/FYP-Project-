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

export function getWorkers(params) {
  return apiRequest(`/api/workers/${queryString(params)}`);
}

export function getWorker(id) {
  return apiRequest(`/api/workers/${id}/`);
}

export function createWorker(payload) {
  return apiRequest('/api/workers/', {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function updateWorker(id, payload) {
  return apiRequest(`/api/workers/${id}/`, {
    method: 'PATCH',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export function archiveWorker(id) {
  return apiRequest(`/api/workers/${id}/`, { method: 'DELETE' });
}

export function getWorkerSummary() {
  return apiRequest('/api/workers/summary/');
}

export function getWorkerWorkRecords(workerId, params) {
  return apiRequest(`/api/workers/${workerId}/work-records/${queryString(params)}`);
}

export function createWorkerWorkRecord(workerId, payload) {
  return apiRequest(`/api/workers/${workerId}/work-records/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateWorkerWorkRecord(id, payload) {
  return apiRequest(`/api/workers/work-records/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteWorkerWorkRecord(id) {
  return apiRequest(`/api/workers/work-records/${id}/`, { method: 'DELETE' });
}

export function markWorkerWorkRecordPaid(id, paymentMethod) {
  return apiRequest(`/api/workers/work-records/${id}/mark-paid/`, {
    method: 'POST',
    body: JSON.stringify({ payment_method: paymentMethod }),
  });
}

export function getWorkerStatement(workerId, params) {
  return apiRequest(`/api/workers/${workerId}/statement/${queryString(params)}`);
}
