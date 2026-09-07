import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { ErrorLogsService } from '../../core/services/error-logs.service';
import { ToastService } from '../../core/services/toast.service';
import { Attachment, Comment, ErrorLogDetail } from '../../core/models/error-log.model';

interface PendingFile {
  file: File;
  isImage: boolean;
  /** Only set for images -- a local object URL so the composer can show a thumbnail before send. */
  previewUrl: string | null;
}

/**
 * Chat-style "Comments" modal for an error log. Own messages render in a plain white
 * bubble on the right; everyone else's render in a grey bubble on the left, like a
 * normal chat thread. Kept as its own modal (rather than inline in the detail drawer)
 * so the thread has room to breathe.
 *
 * Attachments: files can be added via the paperclip button (multi-select) or by pasting
 * an image/file directly into the composer textarea (Ctrl+V) -- no separate drop zone,
 * paste just works wherever the cursor is. A comment is sent as two requests: the text
 * first, then any pending files uploaded against the new comment's id.
 */
@Component({
  selector: 'app-error-log-comments-modal',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './error-log-comments-modal.html',
  styleUrl: './error-log-comments-modal.scss',
})
export class ErrorLogCommentsModal implements OnChanges, OnDestroy {
  @Input() errorLog: ErrorLogDetail | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() commentsChanged = new EventEmitter<Comment[]>();

  comments = signal<Comment[]>([]);

  newCommentBody = '';
  pendingFiles = signal<PendingFile[]>([]);
  postingComment = signal(false);
  editingCommentId = signal<string | null>(null);
  editingCommentBody = '';

  /** Object URLs for already-posted image attachments, fetched lazily (the download route
   * needs an auth header, so a plain <img src> can't hit it directly). Keyed by attachment id. */
  private imageUrls = signal<Record<string, string>>({});

  canSend = computed(() => this.newCommentBody.trim().length > 0 || this.pendingFiles().length > 0);

  constructor(
    private readonly http: HttpClient,
    private readonly errorLogsService: ErrorLogsService,
    private readonly toast: ToastService,
    readonly auth: AuthService,
  ) {
    this.comments.set(this.errorLog?.comments ?? []);
  }

  ngOnChanges(): void {
    this.comments.set(this.errorLog?.comments ?? []);
    this.loadImagePreviews(this.comments().flatMap((c) => c.attachments));
  }

  ngOnDestroy(): void {
    this.clearPendingFiles();
    Object.values(this.imageUrls()).forEach((url) => URL.revokeObjectURL(url));
  }

  get canComment(): boolean {
    return this.errorLog?.can_comment ?? false;
  }

  isOwn(comment: Comment): boolean {
    return this.auth.currentUser()?.id === comment.author.id;
  }

  canEditComment(comment: Comment): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    return user.role === 'SuperAdmin' || comment.author.id === user.id;
  }

  imageUrlFor(attachment: Attachment): string | null {
    return this.imageUrls()[attachment.id] ?? null;
  }

  private loadImagePreviews(attachments: Attachment[]): void {
    const cache = this.imageUrls();
    attachments
      .filter((a) => a.content_type.startsWith('image/') && !cache[a.id])
      .forEach((attachment) => {
        this.http
          .get(this.errorLogsService.commentAttachmentDownloadUrl(attachment.id), { responseType: 'blob' })
          .subscribe((blob) => {
            this.imageUrls.update((urls) => ({ ...urls, [attachment.id]: URL.createObjectURL(blob) }));
          });
      });
  }

  // ---- Attaching files before send ----

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addPendingFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  /** Handles Ctrl+V anywhere in the composer -- any file/image in the clipboard is queued as
   * an attachment; plain text pastes through to the textarea as normal. */
  onComposerPaste(event: ClipboardEvent): void {
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
      this.addPendingFiles(files);
    }
  }

  private addPendingFiles(files: File[]): void {
    const additions: PendingFile[] = files.map((file) => {
      const isImage = file.type.startsWith('image/');
      return { file, isImage, previewUrl: isImage ? URL.createObjectURL(file) : null };
    });
    this.pendingFiles.update((list) => [...list, ...additions]);
  }

  removePendingFile(pending: PendingFile): void {
    if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    this.pendingFiles.update((list) => list.filter((p) => p !== pending));
  }

  private clearPendingFiles(): void {
    this.pendingFiles().forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    this.pendingFiles.set([]);
  }

  // ---- Sending ----

  addComment(): void {
    const log = this.errorLog;
    if (!log || !this.canSend()) return;

    const body = this.newCommentBody.trim();
    const filesToUpload = this.pendingFiles().map((p) => p.file);

    this.postingComment.set(true);
    this.errorLogsService.addComment(log.id, body).subscribe({
      next: (comment) => {
        this.newCommentBody = '';
        this.clearPendingFiles();

        if (filesToUpload.length === 0) {
          this.postingComment.set(false);
          this.appendComment(comment);
          return;
        }

        this.errorLogsService.uploadCommentAttachments(log.id, comment.id, filesToUpload).subscribe({
          next: (attachments) => {
            this.postingComment.set(false);
            this.appendComment({ ...comment, attachments });
          },
          error: (err) => {
            this.postingComment.set(false);
            this.appendComment(comment);
            this.toast.show(err?.error?.detail ?? 'Comment posted, but attachments failed to upload', 'error');
          },
        });
      },
      error: (err) => {
        this.postingComment.set(false);
        this.toast.show(err?.error?.detail ?? 'Failed to post comment', 'error');
      },
    });
  }

  private appendComment(comment: Comment): void {
    const updated = [...this.comments(), comment];
    this.comments.set(updated);
    this.commentsChanged.emit(updated);
    this.loadImagePreviews(comment.attachments);
  }

  startEditComment(comment: Comment): void {
    this.editingCommentId.set(comment.id);
    this.editingCommentBody = comment.body;
  }

  cancelEditComment(): void {
    this.editingCommentId.set(null);
    this.editingCommentBody = '';
  }

  saveEditComment(comment: Comment): void {
    const log = this.errorLog;
    if (!log) return;
    const body = this.editingCommentBody.trim();
    if (!body && comment.attachments.length === 0) return;

    this.errorLogsService.updateComment(log.id, comment.id, body).subscribe({
      next: (updated) => {
        const list = this.comments().map((c) => (c.id === updated.id ? updated : c));
        this.comments.set(list);
        this.commentsChanged.emit(list);
        this.cancelEditComment();
      },
      error: (err) => this.toast.show(err?.error?.detail ?? 'Failed to update comment', 'error'),
    });
  }

  deleteComment(comment: Comment): void {
    const log = this.errorLog;
    if (!log || !confirm('Delete this comment?')) return;

    this.errorLogsService.deleteComment(log.id, comment.id).subscribe({
      next: () => {
        const list = this.comments().filter((c) => c.id !== comment.id);
        this.comments.set(list);
        this.commentsChanged.emit(list);
      },
      error: (err) => this.toast.show(err?.error?.detail ?? 'Failed to delete comment', 'error'),
    });
  }

  download(attachment: Attachment): void {
    this.http
      .get(this.errorLogsService.commentAttachmentDownloadUrl(attachment.id), { responseType: 'blob' })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.original_filename;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
