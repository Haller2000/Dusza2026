import React, { useState, type FormEvent, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './Auth.module.css';
import PasswordInput from './PasswordInput';

interface LoginResponseData {
  token?: string;
  user_id?: number;
  username?: string;
  avatar_id?: number;
  error?: string;
  non_field_errors?: string[];
}

interface LoginProps {
  onLoginSuccess?: (data: LoginResponseData) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const normalizedUsername = username.trim();
      const response = await axios.post<LoginResponseData>(
        'http://127.0.0.1:8000/api/login/',
        {
          username: normalizedUsername,
          password: password,
        }
      );

      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      localStorage.setItem('username', normalizedUsername);

      if (onLoginSuccess) {
        onLoginSuccess({ ...response.data, username: response.data.username || normalizedUsername });
      }

    } catch (err) {
      const error = err as AxiosError<LoginResponseData>;
      if (error.response && error.response.data) {
        const data = error.response.data;
        if (data.non_field_errors) {
          setErrorMessage(data.non_field_errors.join(' '));
        } else if (data.error) {
          setErrorMessage(data.error);
        } else {
          setErrorMessage('Hibás felhasználónév vagy jelszó!');
        }
      } else {
        setErrorMessage('Nem sikerült csatlakozni a szerverhez.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.authEyebrow}>Dusza2026 · Üdv újra</div>
      <h2 className={styles.authTitle}>Folytasd a kalandot!</h2>
      <p className={styles.authSubtitle}>Jelentkezz be, és folytasd a kincskeresést a robotoddal!</p>

      {errorMessage && <div className={styles.alertError} role="alert">⚠️ {errorMessage}</div>}

      <form onSubmit={handleLogin}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="login-username">Felhasználónév</label>
          <input
            id="login-username"
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
          <label className={styles.formLabel} htmlFor="login-password">Jelszó</label>
          <PasswordInput
            id="login-password"
            className={styles.formInput}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading} className={`${styles.submitBtn} ${styles.login}`}>
          {loading ? 'Bejelentkezés...' : 'Belépés'}
        </button>
      </form>
    </>
  );
};

export default Login;