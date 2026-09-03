import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { UsersService } from '../../../core/services/users.service';
import { User, UserRole } from '../../../core/models/user.model';

const ROLES: UserRole[] = ['Dev', 'QA', 'SuperAdmin'];

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [DatePipe, FormsModule, MatTableModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {
  readonly roles = ROLES;
  readonly displayedColumns = ['name', 'email', 'role', 'createdAt'];

  users = signal<User[]>([]);

  constructor(
    private readonly usersService: UsersService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.usersService.list().subscribe((users) => this.users.set(users));
  }

  changeRole(user: User, role: UserRole): void {
    this.usersService.updateRole(user.id, role).subscribe({
      next: () => {
        this.snackBar.open(`${user.name} is now ${role}`, 'Dismiss', { duration: 3000 });
        this.refresh();
      },
      error: () => this.snackBar.open('Failed to update role', 'Dismiss', { duration: 3000 }),
    });
  }
}
