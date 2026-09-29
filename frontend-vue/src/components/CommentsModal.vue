<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { apiErrorMessage } from '@/api/client';
import { errorLogsService } from '@/services/errorLogs';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import type { Attachment, Comment, ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

/**
 * Chat-style "Comments" modal for an error log. Own messages render in a plain white bubble
 * on the right; everyone else's render in a grey bubble on the left, like a normal chat
 * thread. Kept as its own modal (rather than inline in the detail drawer) so the thread has
 * room to breathe.
 *
 * Attachments: files can be added via the paperclip button (multi-select) or by pasting an
 * image/file directly into the composer textarea (Ctrl+V) -- no separate drop zone, paste
 * just works wherever the cursor is. A comment is sent as two requests: the text first, then
 * any pending files uploaded against the new comment's id.
 */
const props = defineProps<{ errorLog: ErrorLogDetail | null }>();
const emit = defineEmits<{ closed: []; commentsChanged: [Comment[]] }>();

interface PendingFile {
  file: File;
  isImage: boolean;
  /** Only set for images -- a local object URL so the composer can show a thumbnail before send. */
  previewUrl: string | null;
}

const auth = useAuthStore();
const toast = useToastStore();

const comments = ref<Comment[]>([]);
const newCommentBody = ref('');
const pendingFiles = ref<PendingFile[]>([]);
const postingComment = ref(false);
const editingCommentId = ref<string | null>(null);
const editingCommentBody = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

/**
 * Object URLs for already-posted image attachments, fetched lazily (the download route needs
 * an auth header, so a plain <img src> can't hit it directly). Keyed by attachment id.
 */
const imageUrls = ref<Record<string, string>>({});

const canComment = computed(() => props.errorLog?.can_comment ?? false);
const canSend = computed(() => newCommentBody.value.trim().length > 0 || pendingFiles.value.length > 0);

function imageUrlFor(attachment: Attachment): string | null {
  return imageUrls.value[attachment.id] ?? null;
}

async function loadImagePreviews(attachments: Attachment[]): Promise<void> {
  const pending = attachments.filter((a) => a.content_type.startsWith('image/') && !imageUrls.value[a.id]);
  await Promise.all(
    pending.map(async (attachment) => {
      try {
        const blob = await errorLogsService.fetchCommentAttachment(attachment.id);
        imageUrls.value = { ...imageUrls.value, [attachment.id]: URL.createObjectURL(blob) };
      } catch {
        /* a failed thumbnail shouldn't break the thread -- the file row still downloads */
      }
    }),
  );
}

watch(
  () => props.errorLog,
  (log) => {
    comments.value = log?.comments ?? [];
    void loadImagePreviews(comments.value.flatMap((c) => c.attachments));
  },
  { immediate: true },
);

function isOwn(comment: Comment): boolean {
  return auth.currentUser?.id === comment.author.id;
}

function canEditComment(comment: Comment): boolean {
  const user = auth.currentUser;
  if (!user) return false;
  return user.role === 'SuperAdmin' || comment.author.id === user.id;
}

// ---- Attaching files before send ----

function addPendingFiles(files: File[]): void {
  const additions: PendingFile[] = files.map((file) => {
    const isImage = file.type.startsWith('image/');
    return { file, isImage, previewUrl: isImage ? URL.createObjectURL(file) : null };
  });
  pendingFiles.value = [...pendingFiles.value, ...additions];
}

function onFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  addPendingFiles(Array.from(input.files ?? []));
  input.value = '';
}

/**
 * Handles Ctrl+V anywhere in the composer -- any file/image in the clipboard is queued as an
 * attachment; plain text pastes through to the textarea as normal.
 */
function onComposerPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items) return;

  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length > 0) {
    event.preventDefault();
    addPendingFiles(files);
  }
}

function removePendingFile(pending: PendingFile): void {
  if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
  pendingFiles.value = pendingFiles.value.filter((p) => p !== pending);
}

function clearPendingFiles(): void {
  pendingFiles.value.forEach((p) => {
    if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
  });
  pendingFiles.value = [];
}

// ---- Sending ----

function appendComment(comment: Comment): void {
  const updated = [...comments.value, comment];
  comments.value = updated;
  emit('commentsChanged', updated);
  void loadImagePreviews(comment.attachments);
}

async function addComment(): Promise<void> {
  const log = props.errorLog;
  if (!log || !canSend.value) return;

  const body = newCommentBody.value.trim();
  const filesToUpload = pendingFiles.value.map((p) => p.file);

  postingComment.value = true;
  let comment: Comment;
  try {
    comment = await errorLogsService.addComment(log.id, body);
  } catch (err) {
    postingComment.value = false;
    toast.show(apiErrorMessage(err, 'Failed to post comment'), 'error');
    return;
  }

  newCommentBody.value = '';
  clearPendingFiles();

  if (filesToUpload.length === 0) {
    postingComment.value = false;
    appendComment(comment);
    return;
  }

  try {
    const attachments = await errorLogsService.uploadCommentAttachments(log.id, comment.id, filesToUpload);
    appendComment({ ...comment, attachments });
  } catch (err) {
    appendComment(comment);
    toast.show(apiErrorMessage(err, 'Comment posted, but attachments failed to upload'), 'error');
  } finally {
    postingComment.value = false;
  }
}

function startEditComment(comment: Comment): void {
  editingCommentId.value = comment.id;
  editingCommentBody.value = comment.body;
}

function cancelEditComment(): void {
  editingCommentId.value = null;
  editingCommentBody.value = '';
}

async function saveEditComment(comment: Comment): Promise<void> {
  const log = props.errorLog;
  if (!log) return;
  const body = editingCommentBody.value.trim();
  if (!body && comment.attachments.length === 0) return;

  try {
    const updated = await errorLogsService.updateComment(log.id, comment.id, body);
    const list = comments.value.map((c) => (c.id === updated.id ? updated : c));
    comments.value = list;
    emit('commentsChanged', list);
    cancelEditComment();
  } catch (err) {
    toast.show(apiErrorMessage(err, 'Failed to update comment'), 'error');
  }
}

async function deleteComment(comment: Comment): Promise<void> {
  const log = props.errorLog;
  if (!log || !confirm('Delete this comment?')) return;

  try {
    await errorLogsService.deleteComment(log.id, comment.id);
    const list = comments.value.filter((c) => c.id !== comment.id);
    comments.value = list;
    emit('commentsChanged', list);
  } catch (err) {
    toast.show(apiErrorMessage(err, 'Failed to delete comment'), 'error');
  }
}

async function download(attachment: Attachment): Promise<void> {
  const blob = await errorLogsService.fetchCommentAttachment(attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.original_filename;
  link.click();
  URL.revokeObjectURL(url);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('closed');
}

onMounted(() => document.addEventListener('keydown', onKeydown));

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  clearPendingFiles();
  Object.values(imageUrls.value).forEach((url) => URL.revokeObjectURL(url));
});
</script>

<template>
  <div class="c-comments-modal">
    <div class="modal-backdrop" @click="emit('closed')">
      <div class="modal-panel comments-panel" @click.stop>
        <div class="modal-topbar">
          <span class="modal-title">Comments</span>
          <button class="btn-icon" type="button" aria-label="Close" @click="emit('closed')">
            <i class="material-icons">close</i>
          </button>
        </div>

        <div class="chat-body">
          <p v-if="comments.length === 0" class="empty">No comments yet.</p>

          <div
            v-for="comment in comments"
            :key="comment.id"
            class="chat-row"
            :class="{ 'chat-row--own': isOwn(comment) }"
          >
            <div class="chat-bubble" :class="{ 'chat-bubble--own': isOwn(comment) }">
              <span v-if="!isOwn(comment)" class="chat-author">{{ comment.author.name }}</span>

              <div v-if="editingCommentId === comment.id" class="chat-edit">
                <textarea v-model="editingCommentBody" rows="3"></textarea>
                <div class="chat-edit-actions">
                  <button class="btn btn-sm btn-primary" @click="saveEditComment(comment)">Save</button>
                  <button class="btn btn-sm btn-ghost" @click="cancelEditComment">Cancel</button>
                </div>
              </div>

              <template v-else>
                <p v-if="comment.body" class="chat-text">{{ comment.body }}</p>

                <div v-if="comment.attachments.length > 0" class="chat-attachments">
                  <template v-for="attachment in comment.attachments" :key="attachment.id">
                    <img
                      v-if="attachment.content_type.startsWith('image/') && imageUrlFor(attachment)"
                      class="chat-attachment-image"
                      :src="imageUrlFor(attachment) ?? ''"
                      :alt="attachment.original_filename"
                      @click="download(attachment)"
                    />
                    <button
                      v-else
                      class="chat-attachment-file"
                      type="button"
                      :title="attachment.original_filename"
                      @click="download(attachment)"
                    >
                      <i class="material-icons">description</i>
                      <span>{{ attachment.original_filename }}</span>
                    </button>
                  </template>
                </div>

                <div class="chat-footer">
                  <span class="chat-meta">
                    {{ formatDate(comment.created_at, 'short') }}
                    <span v-if="comment.edited_at" class="chat-edited">(edited)</span>
                  </span>
                  <span v-if="canEditComment(comment)" class="chat-actions">
                    <button class="btn-icon" title="Edit comment" @click="startEditComment(comment)">
                      <i class="material-icons">edit</i>
                    </button>
                    <button class="btn-icon" title="Delete comment" @click="deleteComment(comment)">
                      <i class="material-icons">delete</i>
                    </button>
                  </span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div v-if="canComment" class="chat-composer">
          <div v-if="pendingFiles.length > 0" class="pending-files">
            <div
              v-for="pending in pendingFiles"
              :key="`${pending.file.name}-${pending.file.lastModified}`"
              class="pending-file"
            >
              <img v-if="pending.isImage && pending.previewUrl" :src="pending.previewUrl" :alt="pending.file.name" />
              <i v-else class="material-icons">description</i>
              <span class="pending-file-name" :title="pending.file.name">{{ pending.file.name }}</span>
              <button class="btn-icon" type="button" title="Remove" @click="removePendingFile(pending)">
                <i class="material-icons">close</i>
              </button>
            </div>
          </div>

          <div class="chat-composer-row">
            <input ref="fileInput" type="file" multiple hidden @change="onFilesSelected" />
            <button class="btn-icon attach-btn" type="button" title="Attach files" @click="fileInput?.click()">
              <i class="material-icons">attach_file</i>
            </button>
            <textarea
              v-model="newCommentBody"
              rows="2"
              placeholder="Add a comment, or paste an image/file directly..."
              @paste="onComposerPaste"
            ></textarea>
            <button class="btn btn-sm btn-primary" :disabled="!canSend || postingComment" @click="addComment">
              <i class="material-icons">send</i>
            </button>
          </div>
        </div>
        <p v-else class="chat-permission-hint">
          Only the reporter, a current or past assignee, or a SuperAdmin can comment.
        </p>
      </div>
    </div>
  </div>
</template>
