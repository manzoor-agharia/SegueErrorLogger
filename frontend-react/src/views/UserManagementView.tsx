import { useCallback, useEffect, useState, type JSX, type MouseEvent } from 'react';

import { apiErrorMessage } from '@/api/client';
import UserForm from '@/components/UserForm';
import { useDocumentEvent } from '@/hooks/useEventListener';
import { usersService } from '@/services/users';
import { toast } from '@/stores/toast';
import type { User } from '@/types/user';
import { formatDate } from '@/utils/date';

export default function UserManagementView(): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formEditUser, setFormEditUser] = useState<User | null>(null);

  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setUsers(await usersService.list());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function closeMenu(): void {
    setOpenMenuUserId(null);
    setMenuPosition(null);
  }

  function openCreate(): void {
    setFormEditUser(null);
    setFormOpen(true);
  }

  function openEdit(user: User, event: MouseEvent): void {
    event.stopPropagation();
    closeMenu();
    setFormEditUser(user);
    setFormOpen(true);
  }

  async function onFormSaved(user: User): Promise<void> {
    const wasEdit = formEditUser !== null;
    setFormOpen(false);
    toast.show(wasEdit ? `${user.name} updated` : `${user.name} created`, 'success');
    await refresh();
  }

  async function deleteUser(user: User, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    closeMenu();
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;

    try {
      await usersService.remove(user.id);
      toast.show(`${user.name} deleted`, 'success');
      await refresh();
    } catch (err) {
      toast.show(apiErrorMessage(err, 'Failed to delete user'), 'error');
    }
  }

  // ---- Row "more actions" menu ----

  function toggleMenu(user: User, event: MouseEvent): void {
    event.stopPropagation();
    if (openMenuUserId === user.id) {
      closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Fixed positioning (computed from the button's actual screen position) so the menu can
    // never be clipped by an ancestor's `overflow: hidden`.
    setMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setOpenMenuUserId(user.id);
  }

  /** Any click outside an open row menu closes it -- the menu itself stops propagation. */
  useDocumentEvent('click', closeMenu, openMenuUserId !== null);

  return (
    <div className="c-user-management">
      <div className="page-header">
        <h1 className="text-page-title">User Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <i className="material-icons">person_add</i>
          Create User
        </button>
      </div>

      <table className="data-table users-table">
        <thead className="data-table__header">
          <tr>
            <th />
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="data-table__row">
              <td className="col-menu" onClick={(e) => e.stopPropagation()}>
                <div className="kebab-wrap">
                  <button className="btn-icon btn-more" title="More actions" onClick={(e) => toggleMenu(user, e)}>
                    <i className="material-icons">more_vert</i>
                  </button>

                  {openMenuUserId === user.id && menuPosition && (
                    <div
                      className="kebab-menu"
                      style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="kebab-menu-item" type="button" onClick={(e) => openEdit(user, e)}>
                        <i className="material-icons">edit</i> Edit
                      </button>
                      <div className="kebab-menu-divider" />
                      <button
                        className="kebab-menu-item kebab-menu-item--danger"
                        type="button"
                        onClick={(e) => deleteUser(user, e)}
                      >
                        <i className="material-icons">delete</i> Delete
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <span className={`status-pill status-pill--${user.is_active ? 'active' : 'inactive'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{formatDate(user.created_at, 'mediumDate')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <UserForm user={formEditUser} onSaved={onFormSaved} onCancel={() => setFormOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
