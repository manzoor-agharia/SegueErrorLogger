import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';

import { useClickOutside } from '@/hooks/useClickOutside';
import { notificationsService } from '@/services/notifications';
import type { AppNotification } from '@/types/notification';
import { formatDate } from '@/utils/date';

const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell(): JSX.Element {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useClickOutside(
    root,
    useCallback(() => setOpen(false), []),
    open,
  );

  useEffect(() => {
    const refreshUnreadCount = async (): Promise<void> => {
      try {
        setUnreadCount(await notificationsService.unreadCount());
      } catch {
        /* a failed poll shouldn't surface an error to the user */
      }
    };

    void refreshUnreadCount();
    const handle = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, []);

  async function toggle(): Promise<void> {
    const next = !open;
    setOpen(next);
    if (next) {
      setNotifications(await notificationsService.list());
    }
  }

  async function markAllRead(): Promise<void> {
    await notificationsService.markAllRead();
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function openNotification(notification: AppNotification): void {
    if (!notification.is_read) {
      void notificationsService.markRead(notification.id).then(() => {
        setUnreadCount((c) => Math.max(0, c - 1));
      });
      setNotifications((list) => list.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    }
    setOpen(false);
    navigate(`/error-logs?open=${notification.error_log_id}`);
  }

  return (
    <div ref={root} className="c-notification-bell">
      <button className="btn-icon bell-btn" aria-label="Notifications" title="Notifications" onClick={toggle}>
        <i className="material-icons">notifications</i>
        {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="dropdown">
          <div className="dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="link-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="empty">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-item${notification.is_read ? '' : ' unread'}`}
                  onClick={() => openNotification(notification)}
                >
                  <span className={`dot${notification.is_read ? '' : ' dot--visible'}`} />
                  <div className="notification-body">
                    <span className="message">{notification.message}</span>
                    <span className="time">{formatDate(notification.created_at, 'short')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
