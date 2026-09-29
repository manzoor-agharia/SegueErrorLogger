import { create } from 'zustand';

import { api } from '@/api/client';
import type { TokenResponse, User } from '@/types/user';

const TOKEN_KEY = 'errorlogger_token';
const USER_KEY = 'errorlogger_user';

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

interface AuthState {
  currentUser: User | null;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  function storeSession(res: TokenResponse): void {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    set({ currentUser: res.user });
  }

  return {
    currentUser: readStoredUser(),

    async register(name, email, password) {
      const { data } = await api.post<TokenResponse>('/auth/register', { name, email, password });
      storeSession(data);
    },

    async login(email, password) {
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
      storeSession(data);
    },

    clearSession() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ currentUser: null });
    },
  };
});

/**
 * Selector helpers matching the Angular service's `isAuthenticated` / `isSuperAdmin`
 * computed signals. Kept as selectors (rather than stored booleans) so they can never drift
 * out of sync with `currentUser`.
 */
export const selectIsAuthenticated = (state: AuthState): boolean => state.currentUser !== null;
export const selectIsSuperAdmin = (state: AuthState): boolean => state.currentUser?.role === 'SuperAdmin';
