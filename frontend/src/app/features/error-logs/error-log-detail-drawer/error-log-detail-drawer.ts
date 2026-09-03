import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy, Output, EventEmitter, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ErrorLogsService } from '../../../core/services/error-logs.service';
import { Attachment, ErrorLogDetail } from '../../../core/models/error-log.model';
import { StatusBadge } from '../../../shared/status-badge/status-badge';

interface AttachmentPreview {
  attachment: Attachment;
  objectUrl: string | null;
  isImage: boolean;
}

@Component({
  selector: 'app-error-log-detail-drawer',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, StatusBadge],
  templateUrl: './error-log-detail-drawer.html',
  styleUrl: './error-log-detail-drawer.scss',
})
export class ErrorLogDetailDrawer implements OnChanges, OnDestroy {
  @Input() errorLog: ErrorLogDetail | null = null;
  @Output() closed = new EventEmitter<void>();

  previews = signal<AttachmentPreview[]>([]);

  constructor(
    private readonly http: HttpClient,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  ngOnChanges(): void {
    this.revokeUrls();
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

  private revokeUrls(): void {
    this.previews().forEach((p) => {
      if (p.objectUrl) {
        URL.revokeObjectURL(p.objectUrl);
      }
    });
  }
}
