import { Routes } from '@angular/router';

import { authGuard, superAdminGuard } from './core/auth/auth.guard';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ErrorLogList } from './features/error-logs/error-log-list/error-log-list';
import { UserManagement } from './features/users/user-management/user-management';
import { Shell } from './shared/shell/shell';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'error-logs', pathMatch: 'full' },
      { path: 'error-logs', component: ErrorLogList },
      { path: 'users', component: UserManagement, canActivate: [superAdminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
