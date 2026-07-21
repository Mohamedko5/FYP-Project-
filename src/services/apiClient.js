const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const AUTH_KEYS = ['bayadAccessToken', 'bayadRefreshToken', 'bayadUser'];

export class ApiError extends Error {
  constructor(message, details = null, status = null) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
    this.status = status;
  }
}

function authHeaders() {
  const token = localStorage.getItem('bayadAccessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthAndRedirect() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function flattenErrors(data) {
  if (!data) return ['Request failed. Please try again.'];
  if (typeof data === 'string') return [data];
  if (Array.isArray(data)) return data.map(String);
  if (data.detail) return [String(data.detail)];

  return Object.entries(data).flatMap(([field, value]) => {
    const messages = Array.isArray(value) ? value : [value];
    return messages.map((message) => `${field}: ${String(message)}`);
  });
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('bayadRefreshToken');
  if (!refresh) return false;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  const data = await readResponseBody(response);
  if (!response.ok || !data?.access) return false;

  localStorage.setItem('bayadAccessToken', data.access);
  return true;
}

export async function apiRequest(path, options = {}, hasRetried = false) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && !hasRetried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest(path, options, true);
    }
    clearAuthAndRedirect();
  }

  if (response.status === 204) return null;

  const data = await readResponseBody(response);
  if (!response.ok) {
    throw new ApiError(flattenErrors(data).join('\n'), data, response.status);
  }

  return data;
}
