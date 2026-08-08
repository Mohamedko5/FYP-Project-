import { apiRequest } from './apiClient.js';

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function getZakatDashboard() {
  return apiRequest('/api/zakat/dashboard/');
}

export function getZakatReports(params = {}) {
  return apiRequest(`/api/zakat/reports/${queryString(params)}`);
}

export function getZakatRules(params = {}) {
  return apiRequest(`/api/zakat/rules/${queryString(params)}`);
}

export function createZakatRule(data) {
  return apiRequest('/api/zakat/rules/', { method: 'POST', body: JSON.stringify(data) });
}

export function seedDraftZakatRules() {
  return apiRequest('/api/zakat/rules/seed-draft-rules/', { method: 'POST', body: JSON.stringify({}) });
}

export function getCropZakatAssessments(params = {}) {
  return apiRequest(`/api/zakat/crop-assessments/${queryString(params)}`);
}

export function createCropZakatAssessment(data) {
  return apiRequest('/api/zakat/crop-assessments/', { method: 'POST', body: JSON.stringify(data) });
}

export function calculateCropZakatAssessment(id) {
  return apiRequest(`/api/zakat/crop-assessments/${id}/calculate/`, { method: 'POST', body: JSON.stringify({}) });
}

export function approveCropZakatAssessment(id) {
  return apiRequest(`/api/zakat/crop-assessments/${id}/approve/`, { method: 'POST', body: JSON.stringify({}) });
}

export function getTradeZakatAssessments(params = {}) {
  return apiRequest(`/api/zakat/trade-assessments/${queryString(params)}`);
}

export function createTradeZakatAssessment(data) {
  return apiRequest('/api/zakat/trade-assessments/', { method: 'POST', body: JSON.stringify(data) });
}

export function calculateTradeZakatAssessment(id) {
  return apiRequest(`/api/zakat/trade-assessments/${id}/calculate/`, { method: 'POST', body: JSON.stringify({}) });
}

export function getPreviousZakatReceipts(params = {}) {
  return apiRequest(`/api/zakat/previous-receipts/${queryString(params)}`);
}

export function createPreviousZakatReceipt(data) {
  return apiRequest('/api/zakat/previous-receipts/', { method: 'POST', body: JSON.stringify(data) });
}

export function verifyPreviousZakatReceipt(id, notes = '') {
  return apiRequest(`/api/zakat/previous-receipts/${id}/verify/`, { method: 'POST', body: JSON.stringify({ notes }) });
}

export function getZakatReceipts(params = {}) {
  return apiRequest(`/api/zakat/receipts/${queryString(params)}`);
}

export function createZakatReceipt(data) {
  return apiRequest('/api/zakat/receipts/', { method: 'POST', body: JSON.stringify(data) });
}

export function updateZakatReceipt(id, data) {
  return apiRequest(`/api/zakat/receipts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function verifyZakatReceipt(id, notes = '') {
  return apiRequest(`/api/zakat/receipts/${id}/verify/`, { method: 'POST', body: JSON.stringify({ notes }) });
}

export function getZakatCertificates(params = {}) {
  return apiRequest(`/api/zakat/certificates/${queryString(params)}`);
}

export function createZakatCertificate(data) {
  return apiRequest('/api/zakat/certificates/', { method: 'POST', body: JSON.stringify(data) });
}

export function getCropMovementPermits(params = {}) {
  return apiRequest(`/api/zakat/movement-permits/${queryString(params)}`);
}

export function createCropMovementPermit(data) {
  return apiRequest('/api/zakat/movement-permits/', { method: 'POST', body: JSON.stringify(data) });
}

export function getZakatAuditHistory(params = {}) {
  return apiRequest(`/api/zakat/audit-history/${queryString(params)}`);
}
