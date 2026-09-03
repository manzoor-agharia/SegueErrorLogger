import { Component } from '@angular/core';

import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    @for (msg of toast.messages(); track msg.id) {
      <div class="toast" [class]="'toast-' + msg.variant" (click)="toast.dismiss(msg.id)">
        {{ msg.text }}
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .toast {
        cursor: pointer;
      }
    `,
  ],
})
export class ToastHost {
  constructor(readonly toast: ToastService) {}
}
