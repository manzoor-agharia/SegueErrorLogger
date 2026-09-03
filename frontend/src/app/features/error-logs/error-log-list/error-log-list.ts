import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth/auth.service';
import { ErrorLogFilters, ErrorLogsService } from '../../../core/services/error-logs.service';
import { ScreensService } from '../../../core/services/screens.service';
import {
  ERROR_STATUSES,
  ErrorLogDetail,
  ErrorLogListItem,
  ErrorStatus,
  Screen,
  STATUS_LABELS,
} from '../../../core/models/error-log.model';
import { ErrorLogDetailDrawer } from '../error-log-detail-drawer/error-log-detail-drawer';
import { ErrorLogForm } from '../error-log-form/error-log-form';

@Component({
  selector: 'app-error-log-list',
  standalone: true,
  imports: [DatePipe, FormsModule, ErrorLogDetailDrawer, ErrorLogForm],
  templateUrl: './error-log-list.html',
  styleUrl: './error-log-list.scss',
})
export class ErrorLogList implements OnInit {
  readonly statuses = ERROR_STATUSES;
  readonly statusLabels = STATUS_LABELS;

  logs = signal<ErrorLogListItem[]>([]);
  screens = signal<Screen[]>([]);
  loading = signal(false);
  selectedLog = signal<ErrorLogDetail | null>(null);

  formOpen = signal(false);
  formEditLog = signal<ErrorLogDetail | null>(null);

  statusFilter: ErrorStatus | '' = '';
  screenFilter: number | '' = '';

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    private readonly screensService: ScreensService,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.screensService.list().subscribe((screens) => this.screens.set(screens));
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    const filters: ErrorLogFilters = {};
    if (this.statusFilter) filters.status_filter = this.statusFilter;
    if (this.screenFilter) filters.screen_id = this.screenFilter;

    this.errorLogsService.list(filters).subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.formEditLog.set(null);
    this.formOpen.set(true);
  }

  openEdit(log: ErrorLogListItem, event: Event): void {
    event.stopPropagation();
    this.errorLogsService.get(log.id).subscribe((detail) => {
      this.formEditLog.set(detail);
      this.formOpen.set(true);
    });
  }

  onFormSaved(saved: ErrorLogDetail): void {
    this.formOpen.set(false);
    this.refresh();
    if (this.selectedLog()?.id === saved.id) {
      this.errorLogsService.get(saved.id).subscribe((detail) => this.selectedLog.set(detail));
    }
  }

  onFormCancelled(): void {
    this.formOpen.set(false);
  }

  viewDetail(log: ErrorLogListItem): void {
    this.errorLogsService.get(log.id).subscribe((detail) => this.selectedLog.set(detail));
  }

  closeDetail(): void {
    this.selectedLog.set(null);
  }

  changeStatus(log: ErrorLogListItem, status: ErrorStatus): void {
    this.errorLogsService.updateStatus(log.id, status).subscribe(() => {
      this.refresh();
      if (this.selectedLog()?.id === log.id) this.viewDetail(log);
    });
  }
}
