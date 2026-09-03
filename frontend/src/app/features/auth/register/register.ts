import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
})
export class Register {
  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (!this.name || !this.email || !this.password) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.register(this.name, this.email, this.password).subscribe({
      next: () => this.router.navigate(['/error-logs']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Registration failed');
      },
    });
  }
}
