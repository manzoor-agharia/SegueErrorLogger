import { api } from '@/api/client';
import type { User, UserCreate, UserUpdate } from '@/types/user';

export const usersService = {
  async list(): Promise<User[]> {
    const { data } = await api.get<User[]>('/users');
    return data;
  },

  async create(payload: UserCreate): Promise<User> {
    const { data } = await api.post<User>('/users', payload);
    return data;
  },

  async update(userId: string, payload: UserUpdate): Promise<User> {
    const { data } = await api.put<User>(`/users/${userId}`, payload);
    return data;
  },

  async remove(userId: string): Promise<void> {
    await api.delete(`/users/${userId}`);
  },
};
