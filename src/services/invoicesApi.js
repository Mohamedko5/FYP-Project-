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

export function getInvoices(params) {
  return apiRequest(`/api/invoices/${queryString(params)}`);
}

export function getInvoice(id) {
  return apiRequest(`/api/invoices/${id}/`);
}

export function createInvoiceFromOrder(orderId, data = {}) {
  return apiRequest(`/api/invoices/from-order/${orderId}/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function markInvoicePaid(id, data) {
  const hasReceipt = data?.payment_receipt instanceof File;
  const body = hasReceipt ? new FormData() : JSON.stringify(data);
  if (hasReceipt) {
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        body.append(key, value);
      }
    });
  }
  return apiRequest(`/api/invoices/${id}/mark-paid/`, {
    method: 'POST',
    body,
  });
}

export function cancelInvoice(id, reason) {
  return apiRequest(`/api/invoices/${id}/cancel/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function getInvoiceSummary() {
  return apiRequest('/api/invoices/summary/');
}
