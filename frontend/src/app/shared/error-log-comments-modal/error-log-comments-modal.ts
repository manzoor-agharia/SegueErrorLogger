import { DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { ErrorLogsService } from '../../core/services/error-logs.service';
import { ToastService } from '../../core/services/toast.service';
import { Comment, ErrorLogDetail } from '../../core/models/error-log.model';

/**
 * Chat-style "Comments" modal for an error log. Own messages render in a plain white
 * bubble on the right; everyone else's render in a grey bubble on the left, like a
 * normal chat thread. Kept as its own modal (rather than inline in the detail drawer)
 * so the thread has room to breathe.
 */
@Component({
  selector: 'app-error-log-comments-modal',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './error-log-comments-modal.html',
  styleUrl: './error-log-comments-modal.scss',
})
export class ErrorLogCommentsModal implements OnChanges {
  @Input() errorLog: ErrorLogDetail | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() commentsChanged = new EventEmitter<Comment[]>();

  comments = signal<Comment[]>([]);

  newCommentBody = '';
  postingComment = signal(false);
  editingCommentId = signal<string | null>(null);
  editingCommentBody = '';

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    private readonly toast: ToastService,
    readonly auth: AuthService,
  ) {
    this.comments.set(this.errorLog?.comments ?? []);
  }

  ngOnChanges(): void {
    this.comments.set(this.errorLog?.comments ?? []);
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

  addComment(): void {
    const log = this.errorLog;
    const body = this.newCommentBody.trim();
    if (!log || !body) return;

    this.postingComment.set(true);
    this.errorLogsService.addComment(log.id, body).subscribe({
      next: (comment) => {
        const updated = [...this.comments(), comment];
        this.comments.set(updated);
        this.commentsChanged.emit(updated);
        this.newCommentBody = '';
        this.postingComment.set(false);
      },
      error: (err) => {
        this.postingComment.set(false);
        this.toast.show(err?.error?.detail ?? 'Failed to post comment', 'error');
      },
    });
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
    const body = this.editingCommentBody.trim();
    if (!log || !body) return;

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

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
