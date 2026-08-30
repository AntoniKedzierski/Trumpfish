import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword, updateProfile } from '@/api/auth';
import { useAuth } from '@/auth/useAuth';
import './AccountPage.css';

export function AccountPage() {
  const { user, logout, applyUser } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user === null) {
    return null;
  }

  const run = async (operation: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      setNotice(await operation());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      applyUser(await updateProfile(displayName.trim() === '' ? null : displayName));
      return 'Zapisano profil.';
    });
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();

    if (newPassword !== repeatPassword) {
      setNotice(null);
      setError('Nowe hasła nie są takie same.');
      return;
    }

    return run(async () => {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      return 'Hasło zostało zmienione.';
    });
  };

  const signOut = () => run(async () => {
    await logout();
    navigate('/login', { replace: true });
    return '';
  });

  return (
    <div className="account">
      <header className="page-header">
        <Link to="/" className="back-link">← Narzędzia</Link>
        <h1>Konto</h1>
      </header>

      <section className="account-card">
        <h2>{user.displayName ?? user.username}</h2>
        <dl>
          <dt>Nazwa użytkownika</dt>
          <dd>{user.username}</dd>
          <dt>Rola</dt>
          <dd>{user.isAdmin ? 'Administrator' : 'Użytkownik'}</dd>
        </dl>
        <button type="button" onClick={signOut} disabled={busy}>Wyloguj się</button>
      </section>

      {notice !== null && notice !== '' && <p className="account-notice">{notice}</p>}
      {error !== null && <p className="account-error">{error}</p>}

      <form className="account-card" onSubmit={saveProfile}>
        <h2>Profil</h2>
        <label>
          Nazwa wyświetlana
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" />
        </label>
        <button type="submit" disabled={busy}>Zapisz</button>
      </form>

      <form className="account-card" onSubmit={savePassword}>
        <h2>Zmiana hasła</h2>
        <label>
          Aktualne hasło
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          Nowe hasło
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <label>
          Powtórz nowe hasło
          <input type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <button type="submit" disabled={busy}>Zmień hasło</button>
      </form>
    </div>
  );
}
