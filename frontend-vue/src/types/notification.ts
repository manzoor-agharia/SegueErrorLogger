export type NotificationType = 'Assigned' | 'Created' | 'Comment';

export interface AppNotification {
  id: string;
  error_log_id: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}
