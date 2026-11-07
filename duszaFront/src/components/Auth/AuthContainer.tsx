import React, { useState } from 'react';
import { Login } from './Login';
import { Register } from './Registration';
import styles from './Auth.module.css';

interface AuthContainerProps {
  onAuthSuccess?: (data?: { username?: string; avatar_id?: number }) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className={styles.authPage}>
      <section className={styles.authContainer}>
        <div className={styles.authTabs}>
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            aria-pressed={isLogin}
            className={`${styles.tabBtn} ${isLogin ? styles.loginActive : ''}`}
          >
            Bejelentkezés
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            aria-pressed={!isLogin}
            className={`${styles.tabBtn} ${!isLogin ? styles.registerActive : ''}`}
          >
            Regisztráció
          </button>
        </div>

        <div className={styles.authFormContent}>
          {isLogin ? (
            <Login onLoginSuccess={onAuthSuccess} />
          ) : (
            <Register onRegisterSuccess={() => setIsLogin(true)} />
          )}
        </div>
      </section>
    </div>
  );
};

export default AuthContainer;