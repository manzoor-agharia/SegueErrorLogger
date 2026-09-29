import { useEffect, useState, type JSX } from 'react';

import { apiErrorMessage } from '@/api/client';
import { usersService } from '@/services/users';
import { USER_ROLES, type User, type UserRole } from '@/types/user';

interface Props {
  user: User | null;
  onSaved: (user: User) => void;
  onCancel: () => void;
}

export default function UserForm({ user, onSaved, onCancel }: Props): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Dev');
  const [isActive, setIsActive] = useState(true);

  const isEdit = user !== null;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.is_active);
    } else {
      setName('');
      setEmail('');
      setRole('Dev');
      setIsActive(true);
    }
    setPassword('');
    setError(null);
  }, [user]);

  // Password is only collected on create -- editing leaves the existing one untouched.
  const isValid = Boolean(name && email) && (isEdit || password.length >= 8);

  async function submit(): Promise<void> {
    if (!isValid) return;
    setSaving(true);
    setError(null);

    try {
      const saved = user
        ? await usersService.update(user.id, { name, email, role, is_active: isActive })
        : await usersService.create({ name, email, password, role });
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save user'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="c-user-form">
      <div className="modal-topbar">
        <span className="modal-title">{isEdit ? 'Edit User' : 'Create User'}</span>
        <button className="btn-icon" type="button" aria-label="Close" title="Close" onClick={onCancel}>
          <i className="material-icons">close</i>
        </button>
      </div>

      <div className="modal-body">
        <div className="form-grid">
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="user-name">
              Name <span className="form-req">*</span>
            </label>
            <input
              id="user-name"
              type="text"
              maxLength={200}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="user-email">
              Email <span className="form-req">*</span>
            </label>
            <input
              id="user-email"
              type="email"
              maxLength={255}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="form-field form-field--full">
              <label className="form-label" htmlFor="user-password">
                Password <span className="form-req">*</span>
              </label>
              <input
                id="user-password"
                type="password"
                maxLength={128}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="user-role">
              Role
            </label>
            <div className="select-wrap">
              <select id="user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="form-field form-field--checkbox">
              <label className="form-label">Active</label>
              <label className="switch">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="switch-track" />
              </label>
            </div>
          )}
        </div>

        {error && <p className="form-error-msg">{error}</p>}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" disabled={saving || !isValid} onClick={submit}>
          {saving && <span className="spinner" />}
          {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}
