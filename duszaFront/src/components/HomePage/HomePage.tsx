import React, { useState } from 'react';
import MapEditor from '../Map/MapEditor';
import MyMapsPage from '../Map/MyMapsPage';
import MapSelectionPage, { type SelectableMap } from '../Map/MapSelectionPage';
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

type HomePageSection = 'home' | 'editor' | 'profile' | 'statistics' | 'maps' | 'map-selection' | 'game';

const HomePage: React.FC<HomePageProps> = ({ username, avatarId, onAvatarChange, handleLogout, profileError }) => {
  const [section, setSection] = useState<HomePageSection>('home');
  const [selectedGameMap, setSelectedGameMap] = useState<SelectableMap | null>(null);

  const handleStartSelectedMap = (map: SelectableMap) => {
    setSelectedGameMap(map);
    setSection('game');
  };

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
            <button
              type="button"
              onClick={() => setSection('map-selection')}
              className={styles.homeActionButton}
            >
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
      {section === 'map-selection' && (
        <MapSelectionPage
          onBack={() => setSection('home')}
          onStart={handleStartSelectedMap}
        />
      )}
      {section === 'game' && selectedGameMap && (
        <main className={styles.gamePlaceholder}>
          <button type="button" onClick={() => setSection('map-selection')} className={styles.backButton}>
            ← Vissza a pályaválasztóhoz
          </button>
          <span className={styles.gameEyebrow}>KIVÁLASZTOTT PÁLYA</span>
          <h1>{selectedGameMap.name}</h1>
          <p>A játékmenet később kerül ide.</p>
        </main>
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
      {section === 'maps' && <MyMapsPage onBack={() => setSection('home')} />}
    </div>
  );
};

export default HomePage;