import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorLogFilters, ErrorLogsService } from '../../../core/services/error-logs.service';
import { ScreensService } from '../../../core/services/screens.service';
import { UsersService } from '../../../core/services/users.service';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  ERROR_STATUSES,
  ErrorEnvironment,
  ErrorLogDetail,
  ErrorLogListItem,
  ErrorPriority,
  ErrorStatus,
  Screen,
  STATUS_LABELS,
} from '../../../core/models/error-log.model';
import { User } from '../../../core/models/user.model';
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
  readonly priorities = ERROR_PRIORITIES;
  readonly environments = ERROR_ENVIRONMENTS;
  readonly statusLabels = STATUS_LABELS;
  readonly pageSizeOptions = [10, 20, 50, 100];

  logs = signal<ErrorLogListItem[]>([]);
  screens = signal<Screen[]>([]);
  users = signal<User[]>([]);
  loading = signal(false);
  selectedLog = signal<ErrorLogDetail | null>(null);

  formOpen = signal(false);
  formEditLog = signal<ErrorLogDetail | null>(null);

  page = signal(1);
  pageSize = signal(20);
  total = signal(0);
  totalPages = signal(0);

  statusFilter: ErrorStatus | '' = '';
  screenFilter: number | '' = '';
  assigneeFilter: string | '' = '';
  priorityFilter: ErrorPriority | '' = '';
  environmentFilter: ErrorEnvironment | '' = '';
  searchTerm = '';
  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    private readonly screensService: ScreensService,
    private readonly usersService: UsersService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.screensService.list(true).subscribe((screens) => this.screens.set(screens));
    this.usersService.list().subscribe((users) => this.users.set(users));
    this.refresh();

    // Subscribed (not just read once) so clicking a notification while already on this page
    // -- which only changes query params, not the route -- still opens the detail drawer.
    this.route.queryParamMap.subscribe((params) => {
      const openId = params.get('open');
      if (openId) {
        this.errorLogsService.get(openId).subscribe((detail) => this.selectedLog.set(detail));
        this.router.navigate([], { relativeTo: this.route, queryParams: {} });
      }
    });
  }

  refresh(): void {
    this.loading.set(true);
    const filters: ErrorLogFilters = {
      page: this.page(),
      page_size: this.pageSize(),
    };
    if (this.statusFilter) filters.status_filter = this.statusFilter;
    if (this.screenFilter) filters.screen_id = this.screenFilter;
    if (this.assigneeFilter) filters.assigned_to_id = this.assigneeFilter;
    if (this.priorityFilter) filters.priority = this.priorityFilter;
    if (this.environmentFilter) filters.environment = this.environmentFilter;
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();

    this.errorLogsService.list(filters).subscribe({
      next: (res) => {
        this.logs.set(res.items);
        this.total.set(res.total);
        this.totalPages.set(res.total_pages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Any filter change invalidates the current page, so jump back to page 1. */
  refreshFromFirstPage(): void {
    this.page.set(1);
    this.refresh();
  }

  onSearchChange(): void {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.refreshFromFirstPage(), 300);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.refresh();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.refreshFromFirstPage();
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

  deleteLog(log: ErrorLogListItem, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete error log "${log.title}"? This cannot be undone.`)) {
      return;
    }
    this.errorLogsService.delete(log.id).subscribe({
      next: () => {
        this.toast.show('Error log deleted', 'success');
        this.refresh();
        if (this.selectedLog()?.id === log.id) this.closeDetail();
      },
      error: (err) => this.toast.show(err?.error?.detail ?? 'Failed to delete error log', 'error'),
    });
  }
}
