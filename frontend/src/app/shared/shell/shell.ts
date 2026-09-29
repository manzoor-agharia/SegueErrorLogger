import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { CURRENT_UI, switchUi, UI_FLAVORS, UI_LABELS, UiFlavor } from '../../core/ui-switcher';
import { NotificationBell } from '../notification-bell/notification-bell';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBell],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  // Dev-only; compiled out of production builds via environment.prod.ts.
  readonly showUiSwitcher = environment.uiSwitcher;
  readonly uiFlavors = UI_FLAVORS;
  readonly uiLabels = UI_LABELS;
  readonly currentUi = CURRENT_UI;

  constructor(readonly auth: AuthService) {}

  /** Reloads into the chosen UI, landing on the same page -- the session carries over. */
  switchTo(flavor: UiFlavor): void {
    switchUi(flavor);
  }

  logout(): void {
    this.auth.logout();
  }
}
