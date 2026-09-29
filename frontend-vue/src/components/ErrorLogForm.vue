<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { apiErrorMessage } from '@/api/client';
import QuillEditor from '@/components/QuillEditor.vue';
import { useClickOutside } from '@/composables/useClickOutside';
import { errorLogsService } from '@/services/errorLogs';
import { screensService } from '@/services/screens';
import { usersService } from '@/services/users';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  LOG_TYPES,
  type ErrorEnvironment,
  type ErrorLogDetail,
  type ErrorPriority,
  type LogType,
  type Screen,
} from '@/types/errorLog';
import type { User } from '@/types/user';

const OTHER_SCREEN_VALUE = -1;
const OTHER_SCREEN_LABEL = 'Other (specify)';

const props = defineProps<{ errorLog: ErrorLogDetail | null }>();
const emit = defineEmits<{ saved: [ErrorLogDetail]; cancelled: [] }>();

const root = ref<HTMLElement | null>(null);

const screens = ref<Screen[]>([]);
const users = ref<User[]>([]);
const saving = ref(false);
const error = ref<string | null>(null);

const title = ref('');
const description = ref('');
const priority = ref<ErrorPriority>('Medium');
const environment = ref<ErrorEnvironment>('Dev');
const logType = ref<LogType>('Error');
const screenId = ref<number | null>(null);
const screenFreeText = ref('');
const assignedToId = ref<string | null>(null);
const selectedFiles = ref<File[]>([]);

const screenQuery = ref('');
const screenDropdownOpen = ref(false);

const isEdit = computed(() => props.errorLog !== null);

void screensService.list().then((list) => (screens.value = list));
void usersService.list().then((list) => (users.value = list));

// Mirrors Angular's ngOnChanges: reset the whole form whenever the bound log changes,
// including the null -> create case.
watch(
  () => props.errorLog,
  (log) => {
    if (log) {
      title.value = log.title;
      description.value = log.description;
      priority.value = log.priority;
      environment.value = log.environment;
      logType.value = log.log_type;
      screenId.value = log.screen?.id ?? (log.screen_name_freetext ? OTHER_SCREEN_VALUE : null);
      screenFreeText.value = log.screen_name_freetext ?? '';
      assignedToId.value = log.assigned_to?.id ?? null;
      screenQuery.value = log.screen?.name ?? (log.screen_name_freetext ? OTHER_SCREEN_LABEL : '');
    } else {
      title.value = '';
      description.value = '';
      priority.value = 'Medium';
      environment.value = 'Dev';
      logType.value = 'Error';
      screenId.value = null;
      screenFreeText.value = '';
      assignedToId.value = null;
      screenQuery.value = '';
    }
    selectedFiles.value = [];
    error.value = null;
  },
  { immediate: true },
);

const hasDescription = computed(() => description.value.replace(/<[^>]*>/g, '').trim().length > 0);

const filteredScreens = computed(() => {
  const query = screenQuery.value.trim().toLowerCase();
  if (!query) return screens.value;
  return screens.value.filter((s) => s.name.toLowerCase().includes(query));
});

function selectedScreenLabel(): string {
  if (screenId.value === OTHER_SCREEN_VALUE) return OTHER_SCREEN_LABEL;
  return screens.value.find((s) => s.id === screenId.value)?.name ?? '';
}

function onScreenQueryChange(): void {
  screenDropdownOpen.value = true;
  // Typing past a chosen screen clears the selection so a stale id can't be submitted.
  if (screenId.value !== null && screenQuery.value !== selectedScreenLabel()) {
    screenId.value = null;
  }
}

function selectScreen(screen: Screen): void {
  screenId.value = screen.id;
  screenQuery.value = screen.name;
  screenDropdownOpen.value = false;
}

function selectOtherScreen(): void {
  screenId.value = OTHER_SCREEN_VALUE;
  screenQuery.value = OTHER_SCREEN_LABEL;
  screenDropdownOpen.value = false;
}

useClickOutside(root, () => {
  screenDropdownOpen.value = false;
});

function addFiles(files: File[]): void {
  selectedFiles.value = [...selectedFiles.value, ...files];
}

function onFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    addFiles(Array.from(input.files));
    input.value = '';
  }
}

/** Pasting a screenshot (e.g. from Snipping Tool) or a copied file attaches it directly. */
function onPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items || items.length === 0) return;

  const pastedFiles: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        const named =
          file.name && file.name !== 'blob'
            ? file
            : new File([file], `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type: file.type });
        pastedFiles.push(named);
      }
    }
  }
  if (pastedFiles.length > 0) {
    event.preventDefault();
    addFiles(pastedFiles);
  }
}

function removeFile(index: number): void {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index);
}

async function submit(): Promise<void> {
  if (!title.value || !hasDescription.value) return;

  saving.value = true;
  error.value = null;

  const payload = {
    title: title.value,
    description: description.value,
    priority: priority.value,
    environment: environment.value,
    log_type: logType.value,
    screen_id: screenId.value !== null && screenId.value !== OTHER_SCREEN_VALUE ? screenId.value : null,
    screen_name_freetext: screenId.value === OTHER_SCREEN_VALUE ? screenFreeText.value : null,
    assigned_to_id: assignedToId.value,
  };

  let saved: ErrorLogDetail;
  try {
    saved = props.errorLog
      ? await errorLogsService.update(props.errorLog.id, payload)
      : await errorLogsService.create(payload);
  } catch (err) {
    saving.value = false;
    error.value = apiErrorMessage(err, 'Failed to save error log');
    return;
  }

  // A failed attachment upload still counts as a successful save -- same as the Angular
  // version, which emitted `saved` from both the next and error branches.
  if (selectedFiles.value.length > 0) {
    try {
      await errorLogsService.uploadAttachments(saved.id, selectedFiles.value);
    } catch {
      /* ignored on purpose */
    }
  }

  saving.value = false;
  emit('saved', saved);
}
</script>

<template>
  <div ref="root" class="c-error-log-form" @paste="onPaste">
    <div class="modal-topbar">
      <span class="modal-title">{{ isEdit ? 'Edit Item' : 'Log a New Feature/Bug' }}</span>
      <button class="btn-icon" type="button" aria-label="Close" title="Close" @click="emit('cancelled')">
        <i class="material-icons">close</i>
      </button>
    </div>

    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label class="form-label" for="log-title">Title <span class="form-req">*</span></label>
          <input
            id="log-title"
            v-model="title"
            type="text"
            maxlength="300"
            placeholder="Short summary of the error"
          />
        </div>

        <div class="form-field form-field--full">
          <label class="form-label" for="log-description">Description <span class="form-req">*</span></label>
          <QuillEditor
            id="log-description"
            v-model="description"
            placeholder="Steps to reproduce, expected vs actual behavior..."
          />
        </div>

        <div class="form-field autocomplete-field">
          <label class="form-label" for="log-screen">Screen</label>
          <input
            id="log-screen"
            v-model="screenQuery"
            type="text"
            autocomplete="off"
            placeholder="Search screens…"
            @input="onScreenQueryChange"
            @focus="screenDropdownOpen = true"
          />
          <ul v-if="screenDropdownOpen" class="autocomplete-list">
            <li v-for="screen in filteredScreens" :key="screen.id" @click="selectScreen(screen)">
              {{ screen.name }} <span class="option-meta">({{ screen.category }})</span>
            </li>
            <li class="option-other" @click="selectOtherScreen">{{ OTHER_SCREEN_LABEL }}</li>
            <li v-if="filteredScreens.length === 0" class="option-empty">No matching screens</li>
          </ul>
        </div>

        <div class="form-field">
          <label class="form-label" for="log-type">Type</label>
          <div class="select-wrap">
            <select id="log-type" v-model="logType">
              <option v-for="t in LOG_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label" for="log-priority">Priority</label>
          <div class="select-wrap">
            <select id="log-priority" v-model="priority">
              <option v-for="p in ERROR_PRIORITIES" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label" for="log-environment">Environment</label>
          <div class="select-wrap">
            <select id="log-environment" v-model="environment">
              <option v-for="e in ERROR_ENVIRONMENTS" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
        </div>

        <div v-if="screenId === OTHER_SCREEN_VALUE" class="form-field form-field--full">
          <label class="form-label" for="log-screen-freetext">Screen name (free text)</label>
          <input
            id="log-screen-freetext"
            v-model="screenFreeText"
            type="text"
            maxlength="300"
            placeholder="Where in the app did this happen?"
          />
        </div>

        <div class="form-field form-field--full">
          <label class="form-label" for="log-assigned">Assigned to</label>
          <div class="select-wrap">
            <select id="log-assigned" v-model="assignedToId">
              <option :value="null">Unassigned</option>
              <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }} ({{ user.role }})</option>
            </select>
          </div>
        </div>

        <div class="form-field form-field--full">
          <label class="form-label">Attachments</label>
          <div class="paste-zone" tabindex="0">
            <i class="material-icons">content_paste</i>
            <span>
              Click here and press <strong>Ctrl+V</strong> to paste a screenshot, or choose files below
            </span>
          </div>
          <input type="file" multiple @change="onFilesSelected" />
          <ul v-if="selectedFiles.length > 0" class="file-list">
            <li v-for="(file, i) in selectedFiles" :key="`${file.name}-${i}`">
              <span class="file-name">{{ file.name }}</span>
              <button class="btn-icon" type="button" aria-label="Remove file" @click="removeFile(i)">
                <i class="material-icons">close</i>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="error" class="form-error-msg">{{ error }}</p>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" type="button" @click="emit('cancelled')">Cancel</button>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="saving || !title || !hasDescription"
        @click="submit"
      >
        <span v-if="saving" class="spinner"></span>
        {{ isEdit ? 'Save Changes' : 'Create' }}
      </button>
    </div>
  </div>
</template>
