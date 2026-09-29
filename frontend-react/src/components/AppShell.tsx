import type { JSX } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import NotificationBell from '@/components/NotificationBell';
import { selectIsSuperAdmin, useAuthStore } from '@/stores/auth';
import { CURRENT_UI, switchUi, UI_FLAVORS, UI_LABELS } from '@/utils/uiSwitcher';

export default function AppShell(): JSX.Element {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin);
  const clearSession = useAuthStore((s) => s.clearSession);

  function logout(): void {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="c-shell">
      <header className="toolbar">
        <span className="brand">ErrorLogger</span>
        <nav className="nav-links">
          <NavLink to="/error-logs" className={({ isActive }) => (isActive ? 'active' : '')}>
            Feature/Bugs Tracking
          </NavLink>
          {isSuperAdmin && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
              Users
            </NavLink>
          )}
        </nav>
        <span className="spacer" />
        {currentUser && (
          <span className="user-info">
            {currentUser.name} · {currentUser.role}
          </span>
        )}
        <div className="ui-switch" title="Dev only — switch UI framework">
          {UI_FLAVORS.map((flavor) => (
            <button
              key={flavor}
              type="button"
              className={`ui-switch-btn${flavor === CURRENT_UI ? ' ui-switch-btn--active' : ''}`}
              disabled={flavor === CURRENT_UI}
              onClick={() => switchUi(flavor)}
            >
              {UI_LABELS[flavor]}
            </button>
          ))}
        </div>
        <NotificationBell />
        <button className="btn-icon" aria-label="Logout" title="Logout" onClick={logout}>
          <i className="material-icons">logout</i>
        </button>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
