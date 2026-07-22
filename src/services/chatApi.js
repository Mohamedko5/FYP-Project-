import { apiRequest } from './apiClient.js';

function queryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getAdminChatConversations(params) {
  return apiRequest(`/api/chat/admin/conversations/${queryString(params)}`);
}

export function getAdminChatMessages(conversationId, params) {
  return apiRequest(`/api/chat/admin/conversations/${conversationId}/messages/${queryString(params)}`);
}

export function sendAdminChatMessage(conversationId, payload) {
  const isFormData = payload instanceof FormData;
  return apiRequest(`/api/chat/admin/conversations/${conversationId}/messages/`, {
    method: 'POST',
    body: isFormData ? payload : JSON.stringify(payload),
  });
}

export function markAdminConversationRead(conversationId) {
  return apiRequest(`/api/chat/admin/conversations/${conversationId}/read/`, { method: 'POST' });
}

export function closeAdminConversation(conversationId) {
  return apiRequest(`/api/chat/admin/conversations/${conversationId}/close/`, { method: 'POST' });
}

export function reopenAdminConversation(conversationId) {
  return apiRequest(`/api/chat/admin/conversations/${conversationId}/reopen/`, { method: 'POST' });
}

export function getAdminChatUnreadCount() {
  return apiRequest('/api/chat/admin/unread-count/');
}
