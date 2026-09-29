import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { storedUi, switchUi, UI_FLAVORS, UI_LABELS, UiFlavor } from '../../../core/ui-switcher';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  // Dev-only UI picker. `uiSwitcher` is false in environment.prod.ts, and angular.json's
  // production fileReplacements swaps that file in, so this never ships.
  readonly showUiSwitcher = environment.uiSwitcher;
  readonly uiFlavors = UI_FLAVORS;
  readonly uiLabels = UI_LABELS;
  selectedUi: UiFlavor = storedUi();

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (!this.email || !this.password) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        // switchUi returns false when the choice is this app, in which case route normally.
        if (this.showUiSwitcher && switchUi(this.selectedUi)) {
          return;
        }
        this.router.navigate(['/error-logs']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Login failed');
      },
    });
  }
}
