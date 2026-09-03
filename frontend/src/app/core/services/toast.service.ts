import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly messages = signal<ToastMessage[]>([]);

  show(text: string, variant: ToastMessage['variant'] = 'info', durationMs = 3000): void {
    const id = this.nextId++;
    this.messages.update((msgs) => [...msgs, { id, text, variant }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== id));
  }
}
