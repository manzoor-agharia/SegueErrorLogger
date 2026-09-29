<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { apiErrorMessage } from '@/api/client';
import UserForm from '@/components/UserForm.vue';
import { usersService } from '@/services/users';
import { useToastStore } from '@/stores/toast';
import type { User } from '@/types/user';
import { formatDate } from '@/utils/date';

const toast = useToastStore();

const users = ref<User[]>([]);
const formOpen = ref(false);
const formEditUser = ref<User | null>(null);

const openMenuUserId = ref<string | null>(null);
const menuPosition = ref<{ top: number; left: number } | null>(null);

async function refresh(): Promise<void> {
  users.value = await usersService.list();
}

function closeMenu(): void {
  openMenuUserId.value = null;
  menuPosition.value = null;
}

function openCreate(): void {
  formEditUser.value = null;
  formOpen.value = true;
}

function openEdit(user: User, event: Event): void {
  event.stopPropagation();
  closeMenu();
  formEditUser.value = user;
  formOpen.value = true;
}

async function onFormSaved(user: User): Promise<void> {
  const wasEdit = formEditUser.value !== null;
  formOpen.value = false;
  toast.show(wasEdit ? `${user.name} updated` : `${user.name} created`, 'success');
  await refresh();
}

async function deleteUser(user: User, event: Event): Promise<void> {
  event.stopPropagation();
  closeMenu();
  if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;

  try {
    await usersService.remove(user.id);
    toast.show(`${user.name} deleted`, 'success');
    await refresh();
  } catch (err) {
    toast.show(apiErrorMessage(err, 'Failed to delete user'), 'error');
  }
}

// ---- Row "more actions" menu ----

function toggleMenu(user: User, event: Event): void {
  event.stopPropagation();
  if (openMenuUserId.value === user.id) {
    closeMenu();
    return;
  }
  const button = event.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  // Fixed positioning (computed from the button's actual screen position) so the menu can
  // never be clipped by an ancestor's `overflow: hidden`.
  menuPosition.value = { top: rect.bottom + 4, left: rect.left };
  openMenuUserId.value = user.id;
}

/** Any click outside an open row menu closes it -- the menu itself stops propagation. */
function onDocumentClick(): void {
  closeMenu();
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick);
  await refresh();
});

onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div class="c-user-management">
    <div class="page-header">
      <h1 class="text-page-title">User Management</h1>
      <button class="btn btn-primary" @click="openCreate">
        <i class="material-icons">person_add</i>
        Create User
      </button>
    </div>

    <table class="data-table users-table">
      <thead class="data-table__header">
        <tr>
          <th></th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id" class="data-table__row">
          <td class="col-menu" @click.stop>
            <div class="kebab-wrap">
              <button class="btn-icon btn-more" title="More actions" @click="toggleMenu(user, $event)">
                <i class="material-icons">more_vert</i>
              </button>

              <div
                v-if="openMenuUserId === user.id && menuPosition"
                class="kebab-menu"
                :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }"
                @click.stop
              >
                <button class="kebab-menu-item" type="button" @click="openEdit(user, $event)">
                  <i class="material-icons">edit</i> Edit
                </button>
                <div class="kebab-menu-divider"></div>
                <button
                  class="kebab-menu-item kebab-menu-item--danger"
                  type="button"
                  @click="deleteUser(user, $event)"
                >
                  <i class="material-icons">delete</i> Delete
                </button>
              </div>
            </div>
          </td>
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.role }}</td>
          <td>
            <span
              class="status-pill"
              :class="{ 'status-pill--active': user.is_active, 'status-pill--inactive': !user.is_active }"
            >
              {{ user.is_active ? 'Active' : 'Inactive' }}
            </span>
          </td>
          <td>{{ formatDate(user.created_at, 'mediumDate') }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="formOpen" class="modal-backdrop" @click="formOpen = false">
      <div class="modal-panel" @click.stop>
        <UserForm :user="formEditUser" @saved="onFormSaved" @cancelled="formOpen = false" />
      </div>
    </div>
  </div>
</template>
