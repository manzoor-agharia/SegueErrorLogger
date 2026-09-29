<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { storedUi, switchUi, UI_FLAVORS, UI_LABELS, type UiFlavor } from '@/utils/uiSwitcher';

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

// Dev-only UI picker -- lands you in whichever framework you tick.
const selectedUi = ref<UiFlavor>(storedUi());

const isValid = computed(() => email.value.length > 0 && password.value.length > 0);

async function submit(): Promise<void> {
  if (!isValid.value) return;
  loading.value = true;
  error.value = null;
  try {
    await auth.login(email.value, password.value);
    // switchUi returns false when the choice is this app, in which case route normally.
    if (switchUi(selectedUi.value)) return;
    await router.push({ name: 'error-logs' });
  } catch (err) {
    error.value = apiErrorMessage(err, 'Login failed');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="c-auth">
    <div class="auth-page">
      <div class="auth-card card">
        <h1 class="text-page-title">ErrorLogger</h1>
        <p class="subtitle text-body-sm">Sign in to continue</p>

        <form @submit.prevent="submit">
          <div class="form-field">
            <label class="form-label" for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              name="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div class="form-field">
            <label class="form-label" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              name="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <p v-if="error" class="form-error-msg">{{ error }}</p>

          <button class="btn btn-primary full-width" type="submit" :disabled="!isValid || loading">
            <span v-if="loading" class="spinner"></span>
            <template v-else>Log in</template>
          </button>
        </form>

        <p class="switch text-body-sm">
          Don't have an account? <RouterLink to="/register">Create one</RouterLink>
        </p>

        <div class="ui-switcher">
          <span class="ui-switcher-label">Open with</span>
          <div class="ui-switcher-options">
            <label
              v-for="flavor in UI_FLAVORS"
              :key="flavor"
              class="ui-switcher-option"
              :class="{ 'ui-switcher-option--active': selectedUi === flavor }"
            >
              <input v-model="selectedUi" type="radio" name="ui-flavor" :value="flavor" />
              <span>{{ UI_LABELS[flavor] }}</span>
            </label>
          </div>
          <p class="ui-switcher-hint">Dev only — requires all three served from one origin via dev-proxy.</p>
        </div>
      </div>
    </div>
  </div>
</template>
