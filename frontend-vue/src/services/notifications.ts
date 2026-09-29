import { api } from '@/api/client';
import type { AppNotification } from '@/types/notification';

export const notificationsService = {
  async list(unreadOnly = false): Promise<AppNotification[]> {
    const { data } = await api.get<AppNotification[]>('/notifications', {
      params: { unread_only: String(unreadOnly) },
    });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<{ count: number }>('/notifications/unread-count');
    return data.count;
  },

  async markRead(id: string): Promise<AppNotification> {
    const { data } = await api.post<AppNotification>(`/notifications/${id}/read`, {});
    return data;
  },

  async markAllRead(): Promise<void> {
    await api.post('/notifications/read-all', {});
  },
};
