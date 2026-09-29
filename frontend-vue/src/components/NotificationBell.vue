<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useClickOutside } from '@/composables/useClickOutside';
import { notificationsService } from '@/services/notifications';
import type { AppNotification } from '@/types/notification';
import { formatDate } from '@/utils/date';

const POLL_INTERVAL_MS = 30_000;

const router = useRouter();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const unreadCount = ref(0);
const notifications = ref<AppNotification[]>([]);

let pollHandle: ReturnType<typeof setInterval> | undefined;

useClickOutside(root, () => {
  open.value = false;
});

async function refreshUnreadCount(): Promise<void> {
  unreadCount.value = await notificationsService.unreadCount();
}

onMounted(() => {
  void refreshUnreadCount();
  pollHandle = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
});

onBeforeUnmount(() => clearInterval(pollHandle));

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value) {
    notifications.value = await notificationsService.list();
  }
}

async function markAllRead(): Promise<void> {
  await notificationsService.markAllRead();
  notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }));
  unreadCount.value = 0;
}

async function openNotification(notification: AppNotification): Promise<void> {
  if (!notification.is_read) {
    void notificationsService.markRead(notification.id).then(() => {
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    });
    notification.is_read = true;
  }
  open.value = false;
  await router.push({ name: 'error-logs', query: { open: notification.error_log_id } });
}
</script>

<template>
  <div ref="root" class="c-notification-bell">
    <button class="btn-icon bell-btn" aria-label="Notifications" title="Notifications" @click="toggle">
      <i class="material-icons">notifications</i>
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="dropdown">
      <div class="dropdown-header">
        <span>Notifications</span>
        <button v-if="unreadCount > 0" class="link-btn" @click="markAllRead">Mark all read</button>
      </div>

      <p v-if="notifications.length === 0" class="empty">No notifications yet.</p>
      <ul v-else class="notification-list">
        <li
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="{ unread: !notification.is_read }"
          @click="openNotification(notification)"
        >
          <span class="dot" :class="{ 'dot--visible': !notification.is_read }"></span>
          <div class="notification-body">
            <span class="message">{{ notification.message }}</span>
            <span class="time">{{ formatDate(notification.created_at, 'short') }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
