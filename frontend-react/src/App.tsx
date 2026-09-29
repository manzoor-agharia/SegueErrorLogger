import type { JSX, ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from '@/components/AppShell';
import ToastHost from '@/components/ToastHost';
import { selectIsAuthenticated, selectIsSuperAdmin, useAuthStore } from '@/stores/auth';
import ErrorLogListView from '@/views/ErrorLogListView';
import LoginView from '@/views/LoginView';
import RegisterView from '@/views/RegisterView';
import UserManagementView from '@/views/UserManagementView';

/** Replaces Angular's `authGuard` CanActivateFn. */
function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/** Replaces Angular's `superAdminGuard` CanActivateFn. */
function RequireSuperAdmin({ children }: { children: ReactElement }): ReactElement {
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin);
  return isSuperAdmin ? children : <Navigate to="/error-logs" replace />;
}

export default function App(): JSX.Element {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/error-logs" replace />} />
          <Route path="error-logs" element={<ErrorLogListView />} />
          <Route
            path="users"
            element={
              <RequireSuperAdmin>
                <UserManagementView />
              </RequireSuperAdmin>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastHost />
    </>
  );
}
