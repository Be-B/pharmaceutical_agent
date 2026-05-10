const BASE = import.meta.env.VITE_API_URL ?? '';

const req = (path, options = {}) =>
  fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

export const authLogin = (email, password) =>
  req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const authLogout = () =>
  req('/api/auth/logout', { method: 'POST' });

export const authMe = () =>
  req('/api/auth/me');

export const getSessions = () =>
  req('/api/chat/sessions');

export const createSession = (title) =>
  req('/api/chat/sessions', { method: 'POST', body: JSON.stringify({ title }) });

export const getMessages = (sessionId) =>
  req(`/api/chat/sessions/${sessionId}/messages`);

export const sendMessageStream = (sessionId, content) =>
  fetch(`${BASE}/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
