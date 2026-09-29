<script setup lang="ts">
import { useRouter } from 'vue-router';

import NotificationBell from '@/components/NotificationBell.vue';
import { useAuthStore } from '@/stores/auth';
import { CURRENT_UI, switchUi, UI_FLAVORS, UI_LABELS } from '@/utils/uiSwitcher';

const auth = useAuthStore();
const router = useRouter();

function logout(): void {
  auth.clearSession();
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="c-shell">
    <header class="toolbar">
      <span class="brand">ErrorLogger</span>
      <nav class="nav-links">
        <RouterLink to="/error-logs" active-class="active">Feature/Bugs Tracking</RouterLink>
        <RouterLink v-if="auth.isSuperAdmin" to="/users" active-class="active">Users</RouterLink>
      </nav>
      <span class="spacer"></span>
      <span v-if="auth.currentUser" class="user-info">
        {{ auth.currentUser.name }} · {{ auth.currentUser.role }}
      </span>
      <div class="ui-switch" title="Dev only — switch UI framework">
        <button
          v-for="flavor in UI_FLAVORS"
          :key="flavor"
          type="button"
          class="ui-switch-btn"
          :class="{ 'ui-switch-btn--active': flavor === CURRENT_UI }"
          :disabled="flavor === CURRENT_UI"
          @click="switchUi(flavor)"
        >
          {{ UI_LABELS[flavor] }}
        </button>
      </div>
      <NotificationBell />
      <button class="btn-icon" aria-label="Logout" title="Logout" @click="logout">
        <i class="material-icons">logout</i>
      </button>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
