import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
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

  openEdit(user: User): void {
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

  deleteUser(user: User): void {
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
}
