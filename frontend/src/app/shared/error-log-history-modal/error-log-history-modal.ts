import { DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, computed, signal } from '@angular/core';

import { ErrorLogDetail, STATUS_LABELS } from '../../core/models/error-log.model';

interface HistoryEntry {
  id: string;
  summary: string;
  changedByName: string;
  changedAt: string;
}

/**
 * Standalone "View History" modal — combines status changes and field edits into one
 * chronological feed. Used both from the error log list (per-row) and the detail drawer,
 * so history is reachable without opening full detail view first.
 */
@Component({
  selector: 'app-error-log-history-modal',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './error-log-history-modal.html',
  styleUrl: './error-log-history-modal.scss',
})
export class ErrorLogHistoryModal {
  @Input() set errorLog(value: ErrorLogDetail | null) {
    this._errorLog.set(value);
  }
  @Output() closed = new EventEmitter<void>();

  private readonly _errorLog = signal<ErrorLogDetail | null>(null);
  readonly statusLabels = STATUS_LABELS;

  combinedHistory = computed<HistoryEntry[]>(() => {
    const log = this._errorLog();
    if (!log) return [];

    const statusEntries: HistoryEntry[] = log.status_history.map((entry) => ({
      id: `status-${entry.id}`,
      summary: `${entry.old_status ? this.statusLabels[entry.old_status] : 'Created'} → ${this.statusLabels[entry.new_status]}`,
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

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
