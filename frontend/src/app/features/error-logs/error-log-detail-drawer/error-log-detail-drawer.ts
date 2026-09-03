import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
  signal,
  computed,
  HostListener,
} from '@angular/core';

import { ErrorLogsService } from '../../../core/services/error-logs.service';
import { Attachment, ErrorLogDetail, STATUS_LABELS } from '../../../core/models/error-log.model';
import { StatusBadge } from '../../../shared/status-badge/status-badge';

interface AttachmentPreview {
  attachment: Attachment;
  objectUrl: string | null;
  isImage: boolean;
}

interface HistoryEntry {
  id: string;
  summary: string;
  changedByName: string;
  changedAt: string;
}

@Component({
  selector: 'app-error-log-detail-drawer',
  standalone: true,
  imports: [DatePipe, StatusBadge],
  templateUrl: './error-log-detail-drawer.html',
  styleUrl: './error-log-detail-drawer.scss',
})
export class ErrorLogDetailDrawer implements OnChanges, OnDestroy {
  @Input() errorLog: ErrorLogDetail | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly statusLabels = STATUS_LABELS;

  previews = signal<AttachmentPreview[]>([]);
  viewerIndex = signal<number | null>(null);
  historyOpen = signal(false);

  images = computed(() => this.previews().filter((p) => p.isImage));
  viewerImage = computed(() => {
    const index = this.viewerIndex();
    return index === null ? null : this.images()[index];
  });

  combinedHistory = computed<HistoryEntry[]>(() => {
    const log = this.errorLog;
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

  constructor(
    private readonly http: HttpClient,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  ngOnChanges(): void {
    this.revokeUrls();
    this.historyOpen.set(false);
    if (!this.errorLog) {
      this.previews.set([]);
      return;
    }

    const loaded: AttachmentPreview[] = this.errorLog.attachments.map((attachment) => ({
      attachment,
      objectUrl: null,
      isImage: attachment.content_type.startsWith('image/'),
    }));
    this.previews.set(loaded);

    loaded
      .filter((p) => p.isImage)
      .forEach((preview) => {
        this.http.get(this.errorLogsService.downloadUrl(preview.attachment.id), { responseType: 'blob' }).subscribe({
          next: (blob) => {
            preview.objectUrl = URL.createObjectURL(blob);
            this.previews.set([...this.previews()]);
          },
        });
      });
  }

  ngOnDestroy(): void {
    this.revokeUrls();
  }

  download(attachment: Attachment): void {
    this.http.get(this.errorLogsService.downloadUrl(attachment.id), { responseType: 'blob' }).subscribe((blob) => {
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

  openHistory(): void {
    this.historyOpen.set(true);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
  }

  openViewer(preview: AttachmentPreview): void {
    const index = this.images().indexOf(preview);
    if (index !== -1) {
      this.viewerIndex.set(index);
    }
  }

  closeViewer(): void {
    this.viewerIndex.set(null);
  }

  showPrevImage(): void {
    const total = this.images().length;
    if (total === 0) return;
    this.viewerIndex.update((i) => ((i ?? 0) - 1 + total) % total);
  }

  showNextImage(): void {
    const total = this.images().length;
    if (total === 0) return;
    this.viewerIndex.update((i) => ((i ?? 0) + 1) % total);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.viewerIndex() !== null) {
      if (event.key === 'Escape') this.closeViewer();
      if (event.key === 'ArrowLeft') this.showPrevImage();
      if (event.key === 'ArrowRight') this.showNextImage();
      return;
    }
    if (this.historyOpen() && event.key === 'Escape') {
      this.closeHistory();
    }
  }

  private revokeUrls(): void {
    this.previews().forEach((p) => {
      if (p.objectUrl) {
        URL.revokeObjectURL(p.objectUrl);
      }
    });
  }
}
