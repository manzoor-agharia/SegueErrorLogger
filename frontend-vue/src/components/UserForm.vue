<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { apiErrorMessage } from '@/api/client';
import { usersService } from '@/services/users';
import { USER_ROLES, type User, type UserRole } from '@/types/user';

const props = defineProps<{ user: User | null }>();
const emit = defineEmits<{ saved: [User]; cancelled: [] }>();

const saving = ref(false);
const error = ref<string | null>(null);

const name = ref('');
const email = ref('');
const password = ref('');
const role = ref<UserRole>('Dev');
const isActive = ref(true);

const isEdit = computed(() => props.user !== null);

watch(
  () => props.user,
  (user) => {
    if (user) {
      name.value = user.name;
      email.value = user.email;
      role.value = user.role;
      isActive.value = user.is_active;
    } else {
      name.value = '';
      email.value = '';
      role.value = 'Dev';
      isActive.value = true;
    }
    password.value = '';
    error.value = null;
  },
  { immediate: true },
);

const isValid = computed(() => {
  if (!name.value || !email.value) return false;
  // Password is only collected on create -- editing leaves the existing one untouched.
  if (!isEdit.value && password.value.length < 8) return false;
  return true;
});

async function submit(): Promise<void> {
  if (!isValid.value) return;
  saving.value = true;
  error.value = null;

  try {
    const saved = props.user
      ? await usersService.update(props.user.id, {
          name: name.value,
          email: email.value,
          role: role.value,
          is_active: isActive.value,
        })
      : await usersService.create({
          name: name.value,
          email: email.value,
          password: password.value,
          role: role.value,
        });
    emit('saved', saved);
  } catch (err) {
    error.value = apiErrorMessage(err, 'Failed to save user');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="c-user-form">
    <div class="modal-topbar">
      <span class="modal-title">{{ isEdit ? 'Edit User' : 'Create User' }}</span>
      <button class="btn-icon" type="button" aria-label="Close" title="Close" @click="emit('cancelled')">
        <i class="material-icons">close</i>
      </button>
    </div>

    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label class="form-label" for="user-name">Name <span class="form-req">*</span></label>
          <input id="user-name" v-model="name" type="text" maxlength="200" placeholder="Full name" />
        </div>

        <div class="form-field form-field--full">
          <label class="form-label" for="user-email">Email <span class="form-req">*</span></label>
          <input id="user-email" v-model="email" type="email" maxlength="255" placeholder="name@example.com" />
        </div>

        <div v-if="!isEdit" class="form-field form-field--full">
          <label class="form-label" for="user-password">Password <span class="form-req">*</span></label>
          <input
            id="user-password"
            v-model="password"
            type="password"
            maxlength="128"
            placeholder="At least 8 characters"
          />
        </div>

        <div class="form-field">
          <label class="form-label" for="user-role">Role</label>
          <div class="select-wrap">
            <select id="user-role" v-model="role">
              <option v-for="r in USER_ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>

        <div v-if="isEdit" class="form-field form-field--checkbox">
          <label class="form-label">Active</label>
          <label class="switch">
            <input v-model="isActive" type="checkbox" />
            <span class="switch-track"></span>
          </label>
        </div>
      </div>

      <p v-if="error" class="form-error-msg">{{ error }}</p>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" type="button" @click="emit('cancelled')">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="saving || !isValid" @click="submit">
        <span v-if="saving" class="spinner"></span>
        {{ isEdit ? 'Save Changes' : 'Create' }}
      </button>
    </div>
  </div>
</template>
