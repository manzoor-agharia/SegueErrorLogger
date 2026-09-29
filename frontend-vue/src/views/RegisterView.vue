<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const isValid = computed(() => name.value.length > 0 && email.value.length > 0 && password.value.length >= 8);

async function submit(): Promise<void> {
  if (!isValid.value) return;
  loading.value = true;
  error.value = null;
  try {
    await auth.register(name.value, email.value, password.value);
    await router.push({ name: 'error-logs' });
  } catch (err) {
    error.value = apiErrorMessage(err, 'Registration failed');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="c-auth">
    <div class="auth-page">
      <div class="auth-card card">
        <h1 class="text-page-title">Create account</h1>
        <p class="subtitle text-body-sm">The first registered user becomes SuperAdmin</p>

        <form @submit.prevent="submit">
          <div class="form-field">
            <label class="form-label" for="name">Name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              name="name"
              required
              autocomplete="name"
              placeholder="Jane Doe"
            />
          </div>

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
              minlength="8"
              autocomplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <p v-if="error" class="form-error-msg">{{ error }}</p>

          <button class="btn btn-primary full-width" type="submit" :disabled="!isValid || loading">
            <span v-if="loading" class="spinner"></span>
            <template v-else>Create account</template>
          </button>
        </form>

        <p class="switch text-body-sm">Already have an account? <RouterLink to="/login">Log in</RouterLink></p>
      </div>
    </div>
  </div>
</template>
