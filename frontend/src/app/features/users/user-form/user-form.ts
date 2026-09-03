import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UsersService } from '../../../core/services/users.service';
import { User, UserRole } from '../../../core/models/user.model';

const ROLES: UserRole[] = ['Dev', 'QA', 'SuperAdmin'];

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnChanges {
  @Input() user: User | null = null;
  @Output() saved = new EventEmitter<User>();
  @Output() cancelled = new EventEmitter<void>();

  readonly roles = ROLES;

  saving = signal(false);
  error = signal<string | null>(null);

  name = '';
  email = '';
  password = '';
  role: UserRole = 'Dev';
  isActive = true;

  isEdit = false;

  constructor(private readonly usersService: UsersService) {}

  ngOnChanges(): void {
    this.isEdit = !!this.user;
    if (this.user) {
      this.name = this.user.name;
      this.email = this.user.email;
      this.role = this.user.role;
      this.isActive = this.user.is_active;
    } else {
      this.name = '';
      this.email = '';
      this.role = 'Dev';
      this.isActive = true;
    }
    this.password = '';
    this.error.set(null);
  }

  get isValid(): boolean {
    if (!this.name || !this.email) return false;
    if (!this.isEdit && this.password.length < 8) return false;
    return true;
  }

  submit(): void {
    if (!this.isValid) return;
    this.saving.set(true);
    this.error.set(null);

    const request$ = this.isEdit
      ? this.usersService.update(this.user!.id, {
          name: this.name,
          email: this.email,
          role: this.role,
          is_active: this.isActive,
        })
      : this.usersService.create({
          name: this.name,
          email: this.email,
          password: this.password,
          role: this.role,
        });

    request$.subscribe({
      next: (user) => {
        this.saving.set(false);
        this.saved.emit(user);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Failed to save user');
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
