import { Component, Input } from '@angular/core';

import { ErrorStatus, STATUS_LABELS } from '../../core/models/error-log.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge-' + status">{{ label }}</span>`,
  styles: [
    `
      .badge-YetToStart {
        background: var(--color-side);
        color: var(--color-muted);
      }
      .badge-InProgress {
        background: var(--color-warning-soft);
        color: var(--color-warning-strong);
      }
      .badge-Fixed {
        background: var(--color-info-soft);
        color: var(--color-info-strong);
      }
      .badge-TestedByQA {
        background: var(--color-success-soft);
        color: var(--color-success-strong);
      }
      .badge-Reopened {
        background: var(--color-error-soft);
        color: var(--color-error-strong);
      }
      .badge-Closed {
        background: #e2e8f0;
        color: var(--color-ink-2);
      }
    `,
  ],
})
export class StatusBadge {
  @Input({ required: true }) status!: ErrorStatus;

  get label(): string {
    return STATUS_LABELS[this.status];
  }
}
