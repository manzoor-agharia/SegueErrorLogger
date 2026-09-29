<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import CommentsModal from '@/components/CommentsModal.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { errorLogsService } from '@/services/errorLogs';
import { STATUS_LABELS, type Attachment, type Comment, type ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

const props = defineProps<{ errorLog: ErrorLogDetail | null }>();
const emit = defineEmits<{ closed: []; commentsChanged: [Comment[]] }>();

interface AttachmentPreview {
  attachment: Attachment;
  objectUrl: string | null;
  isImage: boolean;
}

const previews = ref<AttachmentPreview[]>([]);
const viewerIndex = ref<number | null>(null);
const commentsOpen = ref(false);

const images = computed(() => previews.value.filter((p) => p.isImage));
const viewerImage = computed(() => (viewerIndex.value === null ? null : (images.value[viewerIndex.value] ?? null)));

function revokeUrls(): void {
  previews.value.forEach((p) => {
    if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
  });
}

watch(
  () => props.errorLog,
  async (log) => {
    revokeUrls();
    commentsOpen.value = false;

    if (!log) {
      previews.value = [];
      return;
    }

    previews.value = log.attachments.map((attachment) => ({
      attachment,
      objectUrl: null,
      isImage: attachment.content_type.startsWith('image/'),
    }));

    // Image previews need the auth header, so each one is fetched as a blob and swapped in
    // as it arrives rather than being bound straight to <img src>.
    await Promise.all(
      previews.value
        .filter((p) => p.isImage)
        .map(async (preview) => {
          try {
            const blob = await errorLogsService.fetchAttachment(preview.attachment.id);
            preview.objectUrl = URL.createObjectURL(blob);
            previews.value = [...previews.value];
          } catch {
            /* leave the card showing the generic file icon */
          }
        }),
    );
  },
  { immediate: true },
);

async function download(attachment: Attachment): Promise<void> {
  const blob = await errorLogsService.fetchAttachment(attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.original_filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openViewer(preview: AttachmentPreview): void {
  const index = images.value.indexOf(preview);
  if (index !== -1) viewerIndex.value = index;
}

function closeViewer(): void {
  viewerIndex.value = null;
}

function showPrevImage(): void {
  const total = images.value.length;
  if (total === 0) return;
  viewerIndex.value = ((viewerIndex.value ?? 0) - 1 + total) % total;
}

function showNextImage(): void {
  const total = images.value.length;
  if (total === 0) return;
  viewerIndex.value = ((viewerIndex.value ?? 0) + 1) % total;
}

function onKeydown(event: KeyboardEvent): void {
  // While the comments modal is open it owns Escape, so the drawer stays put.
  if (commentsOpen.value) return;

  if (viewerIndex.value !== null) {
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowLeft') showPrevImage();
    if (event.key === 'ArrowRight') showNextImage();
    return;
  }
  if (event.key === 'Escape') emit('closed');
}

onMounted(() => document.addEventListener('keydown', onKeydown));

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  revokeUrls();
});

/** Keep the drawer's own comment-count badge in sync while the modal is open. */
function onCommentsChanged(comments: Comment[]): void {
  if (props.errorLog) {
    props.errorLog.comments = comments;
  }
  emit('commentsChanged', comments);
}
</script>

<template>
  <div class="c-detail-drawer">
    <template v-if="errorLog">
      <div class="drawer-header">
        <div class="drawer-heading">
          <span class="reference-id">{{ errorLog.reference_id }}</span>
          <h2>{{ errorLog.title }}</h2>
        </div>
        <button class="btn-icon" aria-label="Close" @click="emit('closed')">
          <i class="material-icons">close</i>
        </button>
      </div>

      <div class="drawer-body">
        <div class="drawer-content">
          <div class="meta-row">
            <span
              class="type-badge"
              :class="{
                'type-badge--feature': errorLog.log_type === 'Feature',
                'type-badge--suggestion': errorLog.log_type === 'Suggestion',
              }"
              >{{ errorLog.log_type }}</span
            >
            <StatusBadge :status="errorLog.status" />
            <span class="priority" :class="`priority-${errorLog.priority}`">{{ errorLog.priority }} priority</span>
            <span class="environment-badge">{{ errorLog.environment }}</span>
          </div>

          <dl class="meta-grid">
            <dt>Status</dt>
            <dd>{{ STATUS_LABELS[errorLog.status] }}</dd>

            <dt>Screen</dt>
            <dd>{{ errorLog.screen?.name ?? errorLog.screen_name_freetext ?? '—' }}</dd>

            <dt>Reported by</dt>
            <dd>{{ errorLog.reported_by.name }}</dd>

            <dt>Assigned to</dt>
            <dd>{{ errorLog.assigned_to?.name ?? 'Unassigned' }}</dd>

            <dt>Created</dt>
            <dd>{{ formatDate(errorLog.created_at, 'medium') }}</dd>

            <dt>Updated</dt>
            <dd>{{ formatDate(errorLog.updated_at, 'medium') }}</dd>
          </dl>

          <h3>Description</h3>
          <!-- Description is rich text authored in Quill by an authenticated team member. -->
          <div class="description" v-html="errorLog.description"></div>

          <h3>Attachments</h3>
          <p v-if="previews.length === 0" class="empty">No attachments.</p>
          <div v-else class="attachment-grid">
            <div v-for="preview in previews" :key="preview.attachment.id" class="attachment-card">
              <img
                v-if="preview.isImage && preview.objectUrl"
                :src="preview.objectUrl"
                :alt="preview.attachment.original_filename"
              />
              <div v-else class="file-icon">
                <i class="material-icons">description</i>
              </div>
              <div class="attachment-name" :title="preview.attachment.original_filename">
                {{ preview.attachment.original_filename }}
              </div>
              <div class="attachment-actions">
                <button
                  v-if="preview.isImage && preview.objectUrl"
                  class="btn btn-sm btn-ghost"
                  @click="openViewer(preview)"
                >
                  View
                </button>
                <button class="btn btn-sm btn-ghost" @click="download(preview.attachment)">Download</button>
              </div>
            </div>
          </div>

          <button class="btn btn-sm btn-ghost comments-btn" @click="commentsOpen = true">
            <i class="material-icons">chat_bubble_outline</i>
            Comments
            <span v-if="errorLog.comments.length > 0" class="comments-count">{{ errorLog.comments.length }}</span>
          </button>
        </div>
      </div>
    </template>

    <CommentsModal
      v-if="commentsOpen"
      :error-log="errorLog"
      @closed="commentsOpen = false"
      @comments-changed="onCommentsChanged"
    />

    <div v-if="viewerImage" class="image-viewer-backdrop" @click="closeViewer">
      <button class="btn-icon viewer-close" aria-label="Close viewer" @click="closeViewer">
        <i class="material-icons">close</i>
      </button>

      <button
        v-if="images.length > 1"
        class="btn-icon viewer-nav viewer-prev"
        aria-label="Previous image"
        @click.stop="showPrevImage"
      >
        <i class="material-icons">chevron_left</i>
      </button>

      <div class="viewer-content" @click.stop>
        <img :src="viewerImage.objectUrl ?? ''" :alt="viewerImage.attachment.original_filename" />
        <div class="viewer-caption">
          <span class="viewer-filename">{{ viewerImage.attachment.original_filename }}</span>
          <span v-if="images.length > 1" class="viewer-counter">
            {{ (viewerIndex ?? 0) + 1 }} / {{ images.length }}
          </span>
        </div>
      </div>

      <button
        v-if="images.length > 1"
        class="btn-icon viewer-nav viewer-next"
        aria-label="Next image"
        @click.stop="showNextImage"
      >
        <i class="material-icons">chevron_right</i>
      </button>
    </div>
  </div>
</template>
