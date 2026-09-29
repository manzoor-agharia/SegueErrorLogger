<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';

import { STATUS_LABELS, type ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

/**
 * Combines status changes and field edits into one chronological feed. Used from both the
 * error log list (per-row) and the detail drawer, so history is reachable without opening
 * the full detail view first.
 */
const props = defineProps<{ errorLog: ErrorLogDetail | null }>();
const emit = defineEmits<{ closed: [] }>();

interface HistoryEntry {
  id: string;
  summary: string;
  changedByName: string;
  changedAt: string;
}

const combinedHistory = computed<HistoryEntry[]>(() => {
  const log = props.errorLog;
  if (!log) return [];

  const statusEntries: HistoryEntry[] = log.status_history.map((entry) => ({
    id: `status-${entry.id}`,
    summary: `${entry.old_status ? STATUS_LABELS[entry.old_status] : 'Created'} → ${STATUS_LABELS[entry.new_status]}`,
    changedByName: entry.changed_by.name,
    changedAt: entry.changed_at,
  }));
  const editEntries: HistoryEntry[] = log.edit_history.map((entry) => ({
    id: `edit-${entry.id}`,
    summary: entry.summary,
    changedByName: entry.changed_by.name,
    changedAt: entry.changed_at,
  }));

  return [...statusEntries, ...editEntries].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('closed');
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="c-history-modal">
    <div class="modal-backdrop" @click="emit('closed')">
      <div class="modal-panel history-panel" @click.stop>
        <div class="modal-topbar">
          <span class="modal-title">History</span>
          <button class="btn-icon" type="button" aria-label="Close" @click="emit('closed')">
            <i class="material-icons">close</i>
          </button>
        </div>
        <div class="modal-body">
          <p v-if="combinedHistory.length === 0" class="empty">No changes recorded yet.</p>
          <ul v-else class="status-history">
            <li v-for="entry in combinedHistory" :key="entry.id">
              <span class="history-status">{{ entry.summary }}</span>
              <span class="history-meta">
                {{ entry.changedByName }} · {{ formatDate(entry.changedAt, 'medium') }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
