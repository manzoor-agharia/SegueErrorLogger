<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { apiErrorMessage } from '@/api/client';
import ErrorLogDetailDrawer from '@/components/ErrorLogDetailDrawer.vue';
import ErrorLogForm from '@/components/ErrorLogForm.vue';
import HistoryModal from '@/components/HistoryModal.vue';
import MultiSelectDropdown, { type MultiSelectOption } from '@/components/MultiSelectDropdown.vue';
import { errorLogsService, UNASSIGNED_FILTER_VALUE, type ErrorLogFilters } from '@/services/errorLogs';
import { screensService } from '@/services/screens';
import { usersService } from '@/services/users';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  ERROR_STATUSES,
  LOG_TYPES,
  STATUS_LABELS,
  type ErrorEnvironment,
  type ErrorLogDetail,
  type ErrorLogListItem,
  type ErrorPriority,
  type ErrorStatus,
  type LogType,
  type Screen,
} from '@/types/errorLog';
import type { User } from '@/types/user';
import { formatDate } from '@/utils/date';

const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();
const router = useRouter();

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const statusOptions: MultiSelectOption[] = ERROR_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const priorityOptions: MultiSelectOption[] = ERROR_PRIORITIES.map((p) => ({ value: p, label: p }));
const logTypeOptions: MultiSelectOption[] = LOG_TYPES.map((t) => ({ value: t, label: t }));

const logs = ref<ErrorLogListItem[]>([]);
const screens = ref<Screen[]>([]);
const users = ref<User[]>([]);
const loading = ref(false);
const selectedLog = ref<ErrorLogDetail | null>(null);

const formOpen = ref(false);
const formEditLog = ref<ErrorLogDetail | null>(null);

const historyLog = ref<ErrorLogDetail | null>(null);
const openMenuLogId = ref<string | null>(null);
const menuPosition = ref<{ top: number; left: number } | null>(null);

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPages = ref(0);

const statusFilter = ref<ErrorStatus[]>([]);
const screenFilter = ref<number | ''>('');
const assigneeFilter = ref<string>('');
const priorityFilter = ref<ErrorPriority[]>([]);
const environmentFilter = ref<ErrorEnvironment | ''>('');
const logTypeFilter = ref<LogType[]>([]);
const searchTerm = ref('');
const sortBy = ref<string | null>(null);
const sortDir = ref<'asc' | 'desc'>('asc');

const SORT_COLUMNS = [
  { key: 'reference_id', label: 'Ref ID' },
  { key: 'title', label: 'Title' },
  { key: 'log_type', label: 'Type' },
  { key: 'screen', label: 'Screen' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'updated_at', label: 'Updated' },
];

/** Click cycles a column: ascending -> descending -> back to the default order. */
function toggleSort(column: string): void {
  if (sortBy.value !== column) {
    sortBy.value = column;
    sortDir.value = 'asc';
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc';
  } else {
    sortBy.value = null;
  }
  refreshFromFirstPage();
}

function sortIcon(column: string): string {
  if (sortBy.value !== column) return 'unfold_more';
  return sortDir.value === 'asc' ? 'arrow_upward' : 'arrow_downward';
}

async function copyDetails(log: ErrorLogListItem, event: Event): Promise<void> {
  event.stopPropagation();
  closeMenu();
  const text = `RefID-${log.reference_id}\nTitle-${log.title}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API is unavailable on non-secure origins; fall back to a hidden textarea.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    if (!ok) {
      toast.show('Failed to copy details', 'error');
      return;
    }
  }
  toast.show('Details copied', 'success');
}

let searchDebounce: ReturnType<typeof setTimeout> | undefined;

async function refresh(): Promise<void> {
  loading.value = true;
  const filters: ErrorLogFilters = { page: page.value, page_size: pageSize.value };

  if (statusFilter.value.length > 0) filters.status_filter = statusFilter.value.join(',');
  if (screenFilter.value) filters.screen_id = screenFilter.value;
  if (assigneeFilter.value) filters.assigned_to_id = assigneeFilter.value;
  if (priorityFilter.value.length > 0) filters.priority = priorityFilter.value.join(',');
  if (environmentFilter.value) filters.environment = environmentFilter.value;
  if (logTypeFilter.value.length > 0) filters.log_type = logTypeFilter.value.join(',');
  if (searchTerm.value.trim()) filters.search = searchTerm.value.trim();
  if (sortBy.value) {
    filters.sort_by = sortBy.value;
    filters.sort_dir = sortDir.value;
  }

  try {
    const res = await errorLogsService.list(filters);
    logs.value = res.items;
    total.value = res.total;
    totalPages.value = res.total_pages;
  } finally {
    loading.value = false;
  }
}

/** Any filter change invalidates the current page, so jump back to page 1. */
function refreshFromFirstPage(): void {
  page.value = 1;
  void refresh();
}

function onSearchChange(): void {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(refreshFromFirstPage, 300);
}

function onStatusFilterChange(values: string[]): void {
  statusFilter.value = values as ErrorStatus[];
  refreshFromFirstPage();
}

function onPriorityFilterChange(values: string[]): void {
  priorityFilter.value = values as ErrorPriority[];
  refreshFromFirstPage();
}

function onLogTypeFilterChange(values: string[]): void {
  logTypeFilter.value = values as LogType[];
  refreshFromFirstPage();
}

function goToPage(target: number): void {
  if (target < 1 || target > totalPages.value || target === page.value) return;
  page.value = target;
  void refresh();
}

function onPageSizeChange(size: number): void {
  pageSize.value = size;
  refreshFromFirstPage();
}

// ---- Detail / form / history ----

async function viewDetail(log: ErrorLogListItem): Promise<void> {
  selectedLog.value = await errorLogsService.get(log.id);
}

function closeDetail(): void {
  selectedLog.value = null;
}

function openCreate(): void {
  formEditLog.value = null;
  formOpen.value = true;
}

async function openEdit(log: ErrorLogListItem, event: Event): Promise<void> {
  event.stopPropagation();
  closeMenu();
  formEditLog.value = await errorLogsService.get(log.id);
  formOpen.value = true;
}

async function onFormSaved(saved: ErrorLogDetail): Promise<void> {
  formOpen.value = false;
  await refresh();
  if (selectedLog.value?.id === saved.id) {
    selectedLog.value = await errorLogsService.get(saved.id);
  }
}

async function changeStatus(log: ErrorLogListItem, status: ErrorStatus): Promise<void> {
  await errorLogsService.updateStatus(log.id, status);
  await refresh();
  if (selectedLog.value?.id === log.id) {
    await viewDetail(log);
  }
}

async function deleteLog(log: ErrorLogListItem, event: Event): Promise<void> {
  event.stopPropagation();
  closeMenu();
  if (!confirm(`Delete error log "${log.title}"? This cannot be undone.`)) return;

  try {
    await errorLogsService.remove(log.id);
    toast.show('Error log deleted', 'success');
    await refresh();
    if (selectedLog.value?.id === log.id) closeDetail();
  } catch (err) {
    toast.show(apiErrorMessage(err, 'Failed to delete error log'), 'error');
  }
}

async function viewHistory(log: ErrorLogListItem, event: Event): Promise<void> {
  event.stopPropagation();
  closeMenu();
  historyLog.value = await errorLogsService.get(log.id);
}

// ---- Row "more actions" menu ----

function closeMenu(): void {
  openMenuLogId.value = null;
  menuPosition.value = null;
}

function toggleMenu(log: ErrorLogListItem, event: Event): void {
  event.stopPropagation();
  if (openMenuLogId.value === log.id) {
    closeMenu();
    return;
  }
  const button = event.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  // Fixed positioning (computed from the button's actual screen position) so the menu can
  // never be clipped by an ancestor's `overflow: hidden` -- which happens with
  // `position: absolute` when the table is short (few filtered rows) and the menu would
  // otherwise need to extend past the table's own bottom edge.
  menuPosition.value = { top: rect.bottom + 4, left: rect.left };
  openMenuLogId.value = log.id;
}

/** Any click outside an open row menu closes it -- the menu itself stops propagation. */
function onDocumentClick(): void {
  closeMenu();
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick);
  void screensService.list(true).then((list) => (screens.value = list));
  void usersService.list().then((list) => (users.value = list));
  await refresh();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  clearTimeout(searchDebounce);
});

// Watched (not read once) so clicking a notification while already on this page -- which
// only changes query params, not the route -- still opens the detail drawer.
watch(
  () => route.query.open,
  async (openId) => {
    if (typeof openId === 'string' && openId) {
      selectedLog.value = await errorLogsService.get(openId);
      await router.replace({ query: {} });
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="c-error-log-list">
    <div class="page-header">
      <h1 class="text-page-title">Feature/Bugs Tracking</h1>
      <button class="btn btn-primary" @click="openCreate">
        <i class="material-icons">add</i>
        Log Item
      </button>
    </div>

    <div class="filters">
      <div class="form-field form-field--search">
        <label class="form-label" for="filter-search">Search</label>
        <div class="search-wrap">
          <i class="material-icons">search</i>
          <input
            id="filter-search"
            v-model="searchTerm"
            type="text"
            placeholder="Search reference ID, title, description, screen, people, status..."
            @input="onSearchChange"
          />
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">Status</label>
        <MultiSelectDropdown
          :options="statusOptions"
          :selected="statusFilter"
          @update:selected="onStatusFilterChange"
        />
      </div>

      <div class="form-field">
        <label class="form-label">Priority</label>
        <MultiSelectDropdown
          :options="priorityOptions"
          :selected="priorityFilter"
          @update:selected="onPriorityFilterChange"
        />
      </div>

      <div class="form-field">
        <label class="form-label">Type</label>
        <MultiSelectDropdown
          :options="logTypeOptions"
          :selected="logTypeFilter"
          @update:selected="onLogTypeFilterChange"
        />
      </div>

      <div class="form-field">
        <label class="form-label" for="filter-environment">Environment</label>
        <div class="select-wrap">
          <select id="filter-environment" v-model="environmentFilter" @change="refreshFromFirstPage">
            <option value="">All</option>
            <option v-for="e in ERROR_ENVIRONMENTS" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
      </div>

      <div class="form-field">
        <label class="form-label" for="filter-screen">Screen</label>
        <div class="select-wrap">
          <select id="filter-screen" v-model="screenFilter" @change="refreshFromFirstPage">
            <option value="">All</option>
            <option v-for="screen in screens" :key="screen.id" :value="screen.id">{{ screen.name }}</option>
          </select>
        </div>
      </div>

      <div class="form-field">
        <label class="form-label" for="filter-assignee">Assignee</label>
        <div class="select-wrap">
          <select id="filter-assignee" v-model="assigneeFilter" @change="refreshFromFirstPage">
            <option value="">All</option>
            <option :value="UNASSIGNED_FILTER_VALUE">Unassigned</option>
            <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
        </div>
      </div>

      <div class="form-field form-field--page-size">
        <label class="form-label" for="filter-page-size">Per page</label>
        <div class="select-wrap">
          <select
            id="filter-page-size"
            :value="pageSize"
            @change="onPageSizeChange(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>
      </div>
    </div>

    <table class="data-table">
      <thead class="data-table__header">
        <tr>
          <th></th>
          <th v-for="col in SORT_COLUMNS" :key="col.key" class="sortable" @click="toggleSort(col.key)">
            {{ col.label }}<i class="material-icons sort-icon" :class="{ 'sort-icon--active': sortBy === col.key }">{{
              sortIcon(col.key)
            }}</i>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id" class="data-table__row" @click="viewDetail(log)">
          <td class="col-menu" @click.stop>
            <div class="kebab-wrap">
              <button class="btn-icon btn-more" title="More actions" @click="toggleMenu(log, $event)">
                <i class="material-icons">more_vert</i>
              </button>

              <div
                v-if="openMenuLogId === log.id && menuPosition"
                class="kebab-menu"
                :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }"
                @click.stop
              >
                <button class="kebab-menu-item" type="button" @click="openEdit(log, $event)">
                  <i class="material-icons">edit</i> Edit
                </button>
                <button class="kebab-menu-item" type="button" @click="copyDetails(log, $event)">
                  <i class="material-icons">content_copy</i> Copy Details
                </button>
                <button class="kebab-menu-item" type="button" @click="viewHistory(log, $event)">
                  <i class="material-icons">history</i> View History
                </button>
                <template v-if="auth.isSuperAdmin">
                  <div class="kebab-menu-divider"></div>
                  <button
                    class="kebab-menu-item kebab-menu-item--danger"
                    type="button"
                    @click="deleteLog(log, $event)"
                  >
                    <i class="material-icons">delete</i> Delete
                  </button>
                </template>
              </div>
            </div>
          </td>
          <td class="reference-cell" :title="log.reference_id">{{ log.reference_id }}</td>
          <td class="title-cell" :title="log.title">{{ log.title }}</td>
          <td>
            <span
              class="type-badge"
              :class="{
                'type-badge--feature': log.log_type === 'Feature',
                'type-badge--suggestion': log.log_type === 'Suggestion',
              }"
              >{{ log.log_type }}</span
            >
          </td>
          <td>{{ log.screen?.name ?? log.screen_name_freetext ?? '—' }}</td>
          <td @click.stop>
            <div class="select-wrap status-select">
              <select
                :value="log.status"
                @change="changeStatus(log, ($event.target as HTMLSelectElement).value as ErrorStatus)"
              >
                <option v-for="status in ERROR_STATUSES" :key="status" :value="status">
                  {{ STATUS_LABELS[status] }}
                </option>
              </select>
            </div>
          </td>
          <td>{{ log.priority }}</td>
          <td>{{ log.assigned_to?.name ?? 'Unassigned' }}</td>
          <td>{{ formatDate(log.updated_at, 'short') }}</td>
        </tr>
      </tbody>
    </table>

    <p v-if="!loading && logs.length === 0" class="empty">No error logs found.</p>

    <div v-if="totalPages > 1" class="pagination">
      <span class="pagination-summary">Page {{ page }} of {{ totalPages }} ({{ total }} total)</span>
      <div class="pagination-controls">
        <button class="btn btn-sm btn-ghost" :disabled="page === 1" @click="goToPage(page - 1)">
          <i class="material-icons">chevron_left</i>
          Prev
        </button>
        <button class="btn btn-sm btn-ghost" :disabled="page === totalPages" @click="goToPage(page + 1)">
          Next
          <i class="material-icons">chevron_right</i>
        </button>
      </div>
    </div>

    <div v-if="selectedLog" class="modal-backdrop" @click="closeDetail">
      <div class="modal-panel detail-panel" @click.stop>
        <ErrorLogDetailDrawer :error-log="selectedLog" @closed="closeDetail" />
      </div>
    </div>

    <div v-if="formOpen" class="modal-backdrop" @click="formOpen = false">
      <div class="modal-panel" @click.stop>
        <ErrorLogForm :error-log="formEditLog" @saved="onFormSaved" @cancelled="formOpen = false" />
      </div>
    </div>

    <HistoryModal v-if="historyLog" :error-log="historyLog" @closed="historyLog = null" />
  </div>
</template>
