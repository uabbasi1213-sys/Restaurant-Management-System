/**
 * api.js — Centralized API client
 * Electron mode: calls local Express server at http://localhost:5000
 * Online/Dev mode: calls /api (proxied to localhost:5000 via Vite)
 */

const isElectron = import.meta.env.VITE_MODE === 'electron';
const BASE_URL = isElectron
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'
  : (import.meta.env.VITE_API_URL || '/api');

function getToken() {
  return localStorage.getItem('desktop_token') || localStorage.getItem('token') || '';
}

async function request(method, path, body) {
  const token = getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('API server unavailable or returned HTML');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid response format from server');
  }

  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
};

export default api;
