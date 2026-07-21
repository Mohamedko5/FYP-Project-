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

export function getReportOptions() {
  return apiRequest('/api/reports/options/');
}

export function getReport(reportType, params) {
  return apiRequest(`/api/reports/${reportType}/${queryString(params)}`);
}
