import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../../../core/services/toast.service';
import { UsersService } from '../../../core/services/users.service';
import { User } from '../../../core/models/user.model';
import { UserForm } from '../user-form/user-form';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [DatePipe, FormsModule, UserForm],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {
  users = signal<User[]>([]);

  formOpen = signal(false);
  formEditUser = signal<User | null>(null);

  openMenuUserId = signal<string | null>(null);
  menuPosition = signal<{ top: number; left: number } | null>(null);

  constructor(
    private readonly usersService: UsersService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.usersService.list().subscribe((users) => this.users.set(users));
  }

  openCreate(): void {
    this.formEditUser.set(null);
    this.formOpen.set(true);
  }

  openEdit(user: User, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.formEditUser.set(user);
    this.formOpen.set(true);
  }

  onFormSaved(user: User): void {
    const wasEdit = !!this.formEditUser();
    this.formOpen.set(false);
    this.toast.show(wasEdit ? `${user.name} updated` : `${user.name} created`, 'success');
    this.refresh();
  }

  onFormCancelled(): void {
    this.formOpen.set(false);
  }

  deleteUser(user: User, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) {
      return;
    }
    this.usersService.delete(user.id).subscribe({
      next: () => {
        this.toast.show(`${user.name} deleted`, 'success');
        this.refresh();
      },
      error: (err) => this.toast.show(err?.error?.detail ?? 'Failed to delete user', 'error'),
    });
  }

  // ---- Row "more actions" menu ----

  toggleMenu(user: User, event: Event): void {
    event.stopPropagation();
    if (this.openMenuUserId() === user.id) {
      this.closeMenu();
      return;
    }
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    // Fixed positioning (computed from the button's actual screen position) so the menu
    // can never be clipped by an ancestor's `overflow: hidden`.
    this.menuPosition.set({ top: rect.bottom + 4, left: rect.left });
    this.openMenuUserId.set(user.id);
  }

  closeMenu(): void {
    this.openMenuUserId.set(null);
    this.menuPosition.set(null);
  }

  /** Any click outside an open row menu closes it -- the menu itself stops propagation. */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }
}
