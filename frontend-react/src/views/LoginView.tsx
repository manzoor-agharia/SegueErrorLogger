import { useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { storedUi, switchUi, UI_FLAVORS, UI_LABELS, type UiFlavor } from '@/utils/uiSwitcher';

export default function LoginView(): JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dev-only UI picker -- lands you in whichever framework you tick.
  const [selectedUi, setSelectedUi] = useState<UiFlavor>(storedUi);

  const isValid = email.length > 0 && password.length > 0;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      // switchUi returns false when the choice is this app, in which case route normally.
      if (switchUi(selectedUi)) return;
      navigate('/error-logs');
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="c-auth">
      <div className="auth-page">
        <div className="auth-card card">
          <h1 className="text-page-title">ErrorLogger</h1>
          <p className="subtitle text-body-sm">Sign in to continue</p>

          <form onSubmit={submit}>
            <div className="form-field">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="form-error-msg">{error}</p>}

            <button className="btn btn-primary full-width" type="submit" disabled={!isValid || loading}>
              {loading ? <span className="spinner" /> : 'Log in'}
            </button>
          </form>

          <p className="switch text-body-sm">
            Don&apos;t have an account? <Link to="/register">Create one</Link>
          </p>

          <div className="ui-switcher">
            <span className="ui-switcher-label">Open with</span>
            <div className="ui-switcher-options">
              {UI_FLAVORS.map((flavor) => (
                <label
                  key={flavor}
                  className={`ui-switcher-option${selectedUi === flavor ? ' ui-switcher-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="ui-flavor"
                    value={flavor}
                    checked={selectedUi === flavor}
                    onChange={() => setSelectedUi(flavor)}
                  />
                  <span>{UI_LABELS[flavor]}</span>
                </label>
              ))}
            </div>
            <p className="ui-switcher-hint">
              Dev only — requires all three served from one origin via dev-proxy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
