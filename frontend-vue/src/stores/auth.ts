import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

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

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(readStoredUser());

  const isAuthenticated = computed(() => currentUser.value !== null);
  const isSuperAdmin = computed(() => currentUser.value?.role === 'SuperAdmin');

  function storeSession(res: TokenResponse): void {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    currentUser.value = res.user;
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    const { data } = await api.post<TokenResponse>('/auth/register', { name, email, password });
    storeSession(data);
  }

  async function login(email: string, password: string): Promise<void> {
    const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
    storeSession(data);
  }

  function clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    currentUser.value = null;
  }

  return { currentUser, isAuthenticated, isSuperAdmin, register, login, clearSession };
});
