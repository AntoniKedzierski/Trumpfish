import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import './LoginPage.css';

type Mode = 'login' | 'register';

/** Where a successful sign in lands. Always the tool list, never wherever the previous session happened to end. */
const landing = '/';

export function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whoever is already signed in has no business here.
  if (!loading && user !== null) {
    return <Navigate to={landing} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, displayName.trim() === '' ? null : displayName);
      }

      navigate(landing, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <header>
          <img src="/images/card_icon.png" alt="" />
          <div>
            <h1>Trumpfish</h1>
            <p>{mode === 'login' ? 'Zaloguj się, aby przeglądać swoje systemy.' : 'Załóż konto, aby tworzyć własne systemy.'}</p>
          </div>
        </header>

        <label>
          Nazwa użytkownika
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required />
        </label>

        <label>
          Hasło
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </label>

        {mode === 'register' && (
          <label>
            Nazwa wyświetlana <span className="optional">(opcjonalnie)</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" />
          </label>
        )}

        {error !== null && <p className="login-error">{error}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Chwileczkę…' : mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}
        </button>

        <p className="login-switch">
          {mode === 'login' ? (
            <>Nie masz konta? <button type="button" className="link" onClick={() => switchMode('register')}>Zarejestruj się</button></>
          ) : (
            <>Masz już konto? <button type="button" className="link" onClick={() => switchMode('login')}>Zaloguj się</button></>
          )}
        </p>
      </form>
    </div>
  );
}
