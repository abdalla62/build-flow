import axios from 'axios';

const TOKEN_KEY = 'bf_token';

/** Trim trailing slash; empty in dev when Vite proxy handles /api. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

const apiBase = getApiBaseUrl();
if (apiBase) {
  axios.defaults.baseURL = apiBase;
}

axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export default axios;
