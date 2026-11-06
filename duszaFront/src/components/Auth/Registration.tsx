import React, { useState, type FormEvent, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './Auth.module.css';
import PasswordInput from './PasswordInput';
import AvatarPicker from '../Profile/AvatarPicker';

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
        'http://127.0.0.1:8000/api/register/',
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
        setErrorMessage('Nem sikerült csatlakozni a szerverhez (http://127.0.0.1:8000).');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className={styles.authTitle}>🚀 Dusza2026 - Regisztráció</h2>
      <p className={styles.authSubtitle}>Hozz létre egy fiókot a kincskereső robot irányításához!</p>

      {successMessage && <div className={styles.alertSuccess}>{successMessage}</div>}
      {errorMessage && <div className={styles.alertError}>⚠️ {errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Felhasználónév:</label>
          <input
            type="text"
            className={styles.formInput}
            value={username}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            placeholder="Pl. jatekos1"
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Jelszó:</label>
          <PasswordInput
            className={styles.formInput}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Jelszó megerősítése:</label>
          <PasswordInput
            className={styles.formInput}
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <AvatarPicker selectedAvatarId={avatarId} onSelect={setAvatarId} disabled={loading} />

        <button type="submit" disabled={loading} className={`${styles.submitBtn} ${styles.register}`}>
          {loading ? 'Regisztráció...' : 'Regisztrálok'}
        </button>
      </form>
    </>
  );
};

export default Register;