import { apiRequest } from './apiClient.js';

export function loginUser({ email, password }) {
  return apiRequest('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(payload) {
  return apiRequest('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestPasswordReset(email) {
  return apiRequest('/api/auth/forgot-password/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(payload) {
  return apiRequest('/api/auth/reset-password/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
