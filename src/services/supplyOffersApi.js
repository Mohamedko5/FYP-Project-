import { apiRequest } from './apiClient.js';

function queryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getAdminSupplyOffers(params) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${queryString(params)}`);
}

export function getAdminSupplyOffer(id) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/`);
}

export function getAdminSupplyOfferPendingCount() {
  return apiRequest('/api/supply-offers/admin/supply-offers/unread-count/');
}

export function startSupplyOfferReview(id) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/start-review/`, { method: 'POST', body: JSON.stringify({}) });
}

export function approveSupplyOffer(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/approve/`, { method: 'POST', body: JSON.stringify(data) });
}

export function counterSupplyOffer(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/counter-offer/`, { method: 'POST', body: JSON.stringify(data) });
}

export function rejectSupplyOffer(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/reject/`, { method: 'POST', body: JSON.stringify(data) });
}

export function selectSupplyOfferWarehouse(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/select-warehouse/`, { method: 'POST', body: JSON.stringify(data) });
}

export function recordSupplyOfferReceipt(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/record-receipt/`, { method: 'POST', body: JSON.stringify(data) });
}

export function recordSupplyOfferPayment(id, data) {
  return apiRequest(`/api/supply-offers/admin/supply-offers/${id}/record-payment/`, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
}
