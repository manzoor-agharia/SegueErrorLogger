import { Component, ElementRef, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

export interface MultiSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  templateUrl: './multi-select-dropdown.html',
  styleUrl: './multi-select-dropdown.scss',
})
export class MultiSelectDropdown {
  @Input({ required: true }) options: MultiSelectOption[] = [];
  @Input() selected: string[] = [];
  @Input() allLabel = 'All';
  @Output() selectedChange = new EventEmitter<string[]>();

  open = signal(false);

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  get summary(): string {
    if (this.selected.length === 0) return this.allLabel;
    if (this.selected.length === 1) {
      return this.options.find((o) => o.value === this.selected[0])?.label ?? this.selected[0];
    }
    return `${this.selected.length} selected`;
  }

  isChecked(value: string): boolean {
    return this.selected.includes(value);
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  toggleOption(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = checked ? [...this.selected, value] : this.selected.filter((v) => v !== value);
    this.selectedChange.emit(next);
  }

  clear(): void {
    this.selectedChange.emit([]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.hostRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
