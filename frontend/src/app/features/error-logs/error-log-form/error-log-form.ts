import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';

import { ErrorLogsService } from '../../../core/services/error-logs.service';
import { ScreensService } from '../../../core/services/screens.service';
import { UsersService } from '../../../core/services/users.service';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  ErrorEnvironment,
  ErrorLogDetail,
  ErrorPriority,
  LOG_TYPES,
  LogType,
  Screen,
} from '../../../core/models/error-log.model';
import { User } from '../../../core/models/user.model';

const OTHER_SCREEN_VALUE = -1;
const OTHER_SCREEN_LABEL = 'Other (specify)';

export const DESCRIPTION_EDITOR_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ header: [2, 3, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block', 'link'],
    ['clean'],
  ],
};

@Component({
  selector: 'app-error-log-form',
  standalone: true,
  imports: [FormsModule, QuillEditorComponent],
  templateUrl: './error-log-form.html',
  styleUrl: './error-log-form.scss',
})
export class ErrorLogForm implements OnChanges {
  @Input() errorLog: ErrorLogDetail | null = null;
  @Output() saved = new EventEmitter<ErrorLogDetail>();
  @Output() cancelled = new EventEmitter<void>();

  readonly priorities = ERROR_PRIORITIES;
  readonly environments = ERROR_ENVIRONMENTS;
  readonly logTypes = LOG_TYPES;
  readonly otherScreenValue = OTHER_SCREEN_VALUE;
  readonly otherScreenLabel = OTHER_SCREEN_LABEL;
  readonly descriptionModules = DESCRIPTION_EDITOR_MODULES;

  screens = signal<Screen[]>([]);
  users = signal<User[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);

  title = '';
  description = '';
  priority: ErrorPriority = 'Medium';
  environment: ErrorEnvironment = 'Dev';
  logType: LogType = 'Error';
  screenId: number | null = null;
  screenFreeText = '';
  assignedToId: string | null = null;
  selectedFiles: File[] = [];

  screenQuery = '';
  screenDropdownOpen = false;

  isEdit = false;

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    private readonly screensService: ScreensService,
    private readonly usersService: UsersService,
    private readonly hostRef: ElementRef<HTMLElement>,
  ) {
    this.screensService.list().subscribe((screens) => this.screens.set(screens));
    this.usersService.list().subscribe((users) => this.users.set(users));
  }

  ngOnChanges(): void {
    this.isEdit = !!this.errorLog;
    if (this.errorLog) {
      const log = this.errorLog;
      this.title = log.title;
      this.description = log.description;
      this.priority = log.priority;
      this.environment = log.environment;
      this.logType = log.log_type;
      this.screenId = log.screen?.id ?? (log.screen_name_freetext ? OTHER_SCREEN_VALUE : null);
      this.screenFreeText = log.screen_name_freetext ?? '';
      this.assignedToId = log.assigned_to?.id ?? null;
      this.screenQuery = log.screen?.name ?? (log.screen_name_freetext ? OTHER_SCREEN_LABEL : '');
    } else {
      this.title = '';
      this.description = '';
      this.priority = 'Medium';
      this.environment = 'Dev';
      this.logType = 'Error';
      this.screenId = null;
      this.screenFreeText = '';
      this.assignedToId = null;
      this.screenQuery = '';
    }
    this.selectedFiles = [];
    this.error.set(null);
  }

  get hasDescription(): boolean {
    return this.description.replace(/<[^>]*>/g, '').trim().length > 0;
  }

  get filteredScreens(): Screen[] {
    const query = this.screenQuery.trim().toLowerCase();
    if (!query) return this.screens();
    return this.screens().filter((s) => s.name.toLowerCase().includes(query));
  }

  openScreenDropdown(): void {
    this.screenDropdownOpen = true;
  }

  onScreenQueryChange(): void {
    this.screenDropdownOpen = true;
    if (this.screenId !== null && this.screenQuery !== this.selectedScreenLabel()) {
      this.screenId = null;
    }
  }

  selectScreen(screen: Screen): void {
    this.screenId = screen.id;
    this.screenQuery = screen.name;
    this.screenDropdownOpen = false;
  }

  selectOtherScreen(): void {
    this.screenId = OTHER_SCREEN_VALUE;
    this.screenQuery = OTHER_SCREEN_LABEL;
    this.screenDropdownOpen = false;
  }

  private selectedScreenLabel(): string {
    if (this.screenId === OTHER_SCREEN_VALUE) return OTHER_SCREEN_LABEL;
    return this.screens().find((s) => s.id === this.screenId)?.name ?? '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.screenDropdownOpen && !this.hostRef.nativeElement.contains(event.target as Node)) {
      this.screenDropdownOpen = false;
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  /** Pasting a screenshot (e.g. from Snipping Tool) or a copied file attaches it directly. */
  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items || items.length === 0) {
      return;
    }
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
      this.addFiles(pastedFiles);
    }
  }

  private addFiles(files: File[]): void {
    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  removeFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
  }

  submit(): void {
    if (!this.title || !this.hasDescription) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const payload = {
      title: this.title,
      description: this.description,
      priority: this.priority,
      environment: this.environment,
      log_type: this.logType,
      screen_id: this.screenId !== null && this.screenId !== OTHER_SCREEN_VALUE ? this.screenId : null,
      screen_name_freetext: this.screenId === OTHER_SCREEN_VALUE ? this.screenFreeText : null,
      assigned_to_id: this.assignedToId,
    };

    const request$ = this.isEdit
      ? this.errorLogsService.update(this.errorLog!.id, payload)
      : this.errorLogsService.create(payload);

    request$.subscribe({
      next: (created) => {
        if (this.selectedFiles.length > 0) {
          this.errorLogsService.uploadAttachments(created.id, this.selectedFiles).subscribe({
            next: () => {
              this.saving.set(false);
              this.saved.emit(created);
            },
            error: () => {
              this.saving.set(false);
              this.saved.emit(created);
            },
          });
        } else {
          this.saving.set(false);
          this.saved.emit(created);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Failed to save error log');
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
