import React, { useState } from 'react';
import { Login } from './Login';
import { Register } from './Registration';
import styles from './Auth.module.css';
import mapImage from '../../assets/map.svg';

interface AuthContainerProps {
  onAuthSuccess?: (data?: { username?: string; avatar_id?: number }) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className={styles.authPage}>
      <header className={styles.authNavbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">◆</span>
          <span>Kincskereső Robot</span>
        </div>
        <nav className={styles.authTabs} aria-label="Fiók">
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
        </nav>
      </header>

      <main className={styles.authMain}>
        <div className={styles.authIntro}>
          <p className={styles.authHeroEyebrow}>// tanulj kódolni játszi könnyedséggel</p>
          <h1 className={styles.authHeroTitle}>
            Programozz, bányássz,
            <br />
            <span>és gyűjts értékes aranyat.</span>
          </h1>
          <p className={styles.authHeroDescription}>
            Írj utasításokat, vezesd a robotot a barlangon át, és gyűjtsd össze az összes aranyat.
          </p>
        </div>

        <div className={styles.authWorkspace}>
          <section className={styles.authContainer} aria-label={isLogin ? 'Bejelentkezés' : 'Regisztráció'}>
            <div className={styles.authFormContent}>
              {isLogin ? (
                <Login onLoginSuccess={onAuthSuccess} />
              ) : (
                <Register onRegisterSuccess={() => setIsLogin(true)} />
              )}
            </div>
          </section>

          <figure className={styles.authBoard}>
            <img src={mapImage} alt="Mintapálya aranyérmékkel, akadályokkal és a robottal" />
          </figure>
        </div>
      </main>
    </div>
  );
};

export default AuthContainer;