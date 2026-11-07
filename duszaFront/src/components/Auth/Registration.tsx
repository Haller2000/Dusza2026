import React, { useState, type FormEvent, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './Auth.module.css';
import PasswordInput from './PasswordInput';
import AvatarPicker from '../Profile/AvatarPicker';
import UserAvatar from '../Profile/UserAvatar';
import { AVATAR_OPTIONS } from '../Profile/avatarOptions';

interface RegisterResponseData {
  message?: string;
  error?: string;
  avatar_id?: number;
  username?: string[];
  password?: string[];
}

interface RegisterProps {
  onRegisterSuccess: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [avatarId, setAvatarId] = useState<number>(1);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('A megadott jelszavak nem egyeznek!');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post<RegisterResponseData>(
        '/api/register/',
        {
          username: username.trim(),
          password: password,
          avatar_id: avatarId,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      setSuccessMessage(response.data.message || 'Sikeres regisztráció! Most már bejelentkezhetsz.');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setAvatarId(1);
      setAvatarPickerOpen(false);

      setTimeout(() => {
        onRegisterSuccess();
      }, 1500);

    } catch (err) {
      const error = err as AxiosError<RegisterResponseData>;
      if (error.response && error.response.data) {
        const data = error.response.data;
        if (data.error) {
          setErrorMessage(data.error);
        } else if (data.username) {
          setErrorMessage(`Felhasználónév hiba: ${Array.isArray(data.username) ? data.username.join(' ') : data.username}`);
        } else if (data.password) {
          setErrorMessage(`Jelszó hiba: ${Array.isArray(data.password) ? data.password.join(' ') : data.password}`);
        } else {
          setErrorMessage('Regisztrációs hiba történt.');
        }
      } else {
        setErrorMessage('Nem sikerült csatlakozni a szerverhez.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedAvatar = AVATAR_OPTIONS.find(avatar => avatar.id === avatarId) ?? AVATAR_OPTIONS[0];

  return (
    <>
      <div className={styles.authEyebrow}>Dusza2026 · Kalandra fel</div>
      <h2 className={styles.authTitle}>Induljon a küldetés!</h2>
      <p className={styles.authSubtitle}>Hozz létre egy fiókot, válassz avatárt, és irányítsd a kincskereső robotot!</p>

      {successMessage && <div className={styles.alertSuccess} role="status">{successMessage}</div>}
      {errorMessage && <div className={styles.alertError} role="alert">⚠️ {errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="register-username">Felhasználónév</label>
          <input
            id="register-username"
            type="text"
            className={styles.formInput}
            value={username}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            placeholder="Pl. jatekos1"
            autoComplete="username"
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="register-password">Jelszó</label>
          <PasswordInput
            id="register-password"
            className={styles.formInput}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="register-confirm-password">Jelszó megerősítése</label>
          <PasswordInput
            id="register-confirm-password"
            className={styles.formInput}
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className={styles.avatarSelector}>
          <button
            type="button"
            className={styles.avatarToggle}
            aria-expanded={avatarPickerOpen}
            aria-controls="register-avatar-options"
            onClick={() => setAvatarPickerOpen(open => !open)}
            disabled={loading}
          >
            <UserAvatar avatarId={avatarId} size={36} />
            <span className={styles.avatarToggleText}>
              <strong>Profilkép</strong>
              <span>{selectedAvatar.name} · Kattints a módosításhoz</span>
            </span>
            <span className={`${styles.avatarChevron} ${avatarPickerOpen ? styles.avatarChevronOpen : ''}`} aria-hidden="true">⌄</span>
          </button>
          {avatarPickerOpen && (
            <div
              className={styles.avatarOptions}
              id="register-avatar-options"
            >
              <AvatarPicker
                selectedAvatarId={avatarId}
                onSelect={nextAvatarId => {
                  setAvatarId(nextAvatarId);
                  setAvatarPickerOpen(false);
                }}
                disabled={loading}
              />
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? 'Regisztráció...' : 'Regisztrálok'}
        </button>
      </form>
    </>
  );
};

export default Register;