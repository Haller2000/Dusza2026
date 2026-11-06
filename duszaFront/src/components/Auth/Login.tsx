import React, { useState, type FormEvent, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './Auth.module.css';

interface LoginResponseData {
  token?: string;
  user_id?: number;
  username?: string;
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
      const response = await axios.post<LoginResponseData>(
        'http://127.0.0.1:8000/api/login/',
        {
          username: username.trim(),
          password: password,
        }
      );

      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      localStorage.setItem('username', username);

      if (onLoginSuccess) {
        onLoginSuccess(response.data);
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
      <h2 className={styles.authTitle}>🔐 Bejelentkezés</h2>
      <p className={styles.authSubtitle}>Lépj be a robot irányításához és a ranglistához!</p>

      {errorMessage && <div className={styles.alertError}>⚠️ {errorMessage}</div>}

      <form onSubmit={handleLogin}>
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
          <input
            type="password"
            className={styles.formInput}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
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