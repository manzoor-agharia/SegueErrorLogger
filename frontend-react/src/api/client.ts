import axios, { type AxiosError } from 'axios';

export const API_URL = '/api';

export const api = axios.create({ baseURL: API_URL });

const TOKEN_KEY = 'errorlogger_token';

/**
 * Set by the auth store at startup. Kept as a callback rather than importing the store
 * directly so the client and the store don't form an import cycle.
 */
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

// Replaces Angular's `authInterceptor`: attach the bearer token on the way out...
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ...and force a logout on the way back in if the session is no longer valid.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/**
 * FastAPI returns errors as `{ detail: string }`. Mirrors the Angular code's
 * `err?.error?.detail ?? fallback` pattern in one place.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

/**
 * The attachment download routes require the Authorization header, so an <img src> or a
 * plain link can't hit them directly -- fetch as a blob and hand back an object URL.
 */
export async function fetchBlob(url: string): Promise<Blob> {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  return response.data;
}
