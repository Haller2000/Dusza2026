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
    <div className={styles.authContainer}>
      <div className={styles.authTabs}>
        <button
          onClick={() => setIsLogin(true)}
          className={`${styles.tabBtn} ${isLogin ? styles.loginActive : ''}`}
        >
          Bejelentkezés
        </button>
        <button
          onClick={() => setIsLogin(false)}
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
    </div>
  );
};

export default AuthContainer;