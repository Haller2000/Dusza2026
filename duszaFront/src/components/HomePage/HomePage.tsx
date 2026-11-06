import React, { useState } from 'react';
import MapEditor from '../Map/MapEditor';
import ProfilePage from '../Profile/ProfilePage';
import Navbar from './Navbar/Navbar';
import styles from './HomePage.module.css';

interface HomePageProps {
  username: string;
  avatarId: number;
  onAvatarChange: (avatarId: number) => void;
  handleLogout: () => void;
  profileError?: string;
}

type HomePageSection = 'home' | 'editor' | 'profile' | 'statistics' | 'maps';

const HomePage: React.FC<HomePageProps> = ({ username, avatarId, onAvatarChange, handleLogout, profileError }) => {
  const [section, setSection] = useState<HomePageSection>('home');

  return (
    <div className={styles.homePage}>
      <Navbar
        username={username}
        avatarId={avatarId}
        handleLogout={handleLogout}
        onNavigate={setSection}
      />
      {profileError && <div role="alert" className={styles.profileError}>{profileError}</div>}
      {section === 'home' && (
        <>
          <div className={styles.homeActions}>
            <button type="button" className={styles.homeActionButton}>
              Játék
            </button>
            <button
              type="button"
              onClick={() => setSection('editor')}
              className={styles.homeActionButton}
            >
              Pályaszerkesztő
            </button>
          </div>
          <main className={styles.homeContent}>
            <h1>HomePage</h1>
          </main>
        </>
      )}
      {section === 'editor' && (
        <>
          <button
            type="button"
            onClick={() => setSection('home')}
            className={styles.backButton}
          >
            Vissza a főoldalra
          </button>
          <MapEditor />
        </>
      )}
      {section === 'statistics' && (
        <main className={styles.pageContent}>
          <button type="button" onClick={() => setSection('home')} className={styles.backButton}>
            Vissza a főoldalra
          </button>
          <h1>Statisztika</h1>
          <p className={styles.pageDescription}>A játékok és eredmények statisztikái itt jelennek majd meg.</p>
          <div className={styles.statisticsGrid}>
            <section className={styles.statisticCard}>
              <span>Lejátszott játékok</span>
              <strong>—</strong>
            </section>
            <section className={styles.statisticCard}>
              <span>Összegyűjtött arany</span>
              <strong>—</strong>
            </section>
            <section className={styles.statisticCard}>
              <span>Összes lépés</span>
              <strong>—</strong>
            </section>
          </div>
        </main>
      )}
      {section === 'profile' && (
        <ProfilePage
          onBack={() => setSection('home')}
          onAvatarChange={onAvatarChange}
        />
      )}
      {section === 'maps' && (
        <main className={styles.pageContent}>
          <button type="button" onClick={() => setSection('home')} className={styles.backButton}>
            Vissza a főoldalra
          </button>
          <h1>Saját pályák</h1>
          <p className={styles.pageDescription}>Az általad készített pályák itt jelennek majd meg.</p>
          <section className={styles.mapsPlaceholder}>
            <span className={styles.mapsPlaceholderIcon} aria-hidden="true">▦</span>
            <strong>Még nincsenek megjeleníthető pályák</strong>
            <span>A pályáid listája később itt lesz elérhető.</span>
          </section>
        </main>
      )}
    </div>
  );
};

export default HomePage;