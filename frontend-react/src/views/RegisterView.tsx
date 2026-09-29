import { useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

export default function RegisterView(): JSX.Element {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = name.length > 0 && email.length > 0 && password.length >= 8;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      await register(name, email, password);
      navigate('/error-logs');
    } catch (err) {
      setError(apiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="c-auth">
      <div className="auth-page">
        <div className="auth-card card">
          <h1 className="text-page-title">Create account</h1>
          <p className="subtitle text-body-sm">The first registered user becomes SuperAdmin</p>

          <form onSubmit={submit}>
            <div className="form-field">
              <label className="form-label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                required
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

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
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="form-error-msg">{error}</p>}

            <button className="btn btn-primary full-width" type="submit" disabled={!isValid || loading}>
              {loading ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>

          <p className="switch text-body-sm">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
