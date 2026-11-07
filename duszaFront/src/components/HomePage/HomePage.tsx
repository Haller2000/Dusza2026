import React, { useState } from 'react';
import MapEditor from '../Map/MapEditor';
import MyMapsPage from '../Map/MyMapsPage';
import MapSelectionPage, { type SelectableMap } from '../Map/MapSelectionPage';
import ProfilePage from '../Profile/ProfilePage';
import Scoreboard from '../Scores/Scoreboard';
import StatisticsPage from '../Scores/StatisticsPage';
import Navbar from './Navbar/Navbar';
import mapImage from '../../assets/map.svg';
import styles from './HomePage.module.css';

interface HomePageProps {
  username: string;
  avatarId: number;
  onAvatarChange: (avatarId: number) => void;
  handleLogout: () => void;
  profileError?: string;
}

type HomePageSection = 'home' | 'editor' | 'profile' | 'statistics' | 'leaderboard' | 'maps' | 'map-selection' | 'game';

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
        <main className={styles.hero}>
          <p className={styles.eyebrow}>// tanulj kódolni játszi könnyedséggel</p>
          <h1 className={styles.heroTitle}>
            Programozz, bányássz,
            <br />
            <span>és gyűjts értékes aranyat.</span>
          </h1>
          <p className={styles.heroDescription}>
            Írj utasításokat, vezesd a robotot a barlangon át, és gyűjtsd össze az összes aranyat.
          </p>
          <div className={styles.homeActions}>
            <button
              type="button"
              onClick={() => setSection('map-selection')}
              className={`${styles.homeActionButton} ${styles.primaryAction}`}
            >
              Játék indítása <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('editor')}
              className={`${styles.homeActionButton} ${styles.secondaryAction}`}
            >
              Pályaszerkesztő
            </button>
            <button
              type="button"
              onClick={() => setSection('leaderboard')}
              className={`${styles.homeActionButton} ${styles.secondaryAction}`}
            >
              Ranglista
            </button>
          </div>
          <figure className={styles.boardFigure}>
            <img src={mapImage} alt="Robot, aranyak és akadályok egy négyzetrácsos pályán" />
            <figcaption><span aria-hidden="true">●</span> Mintapálya</figcaption>
          </figure>
        </main>
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
      {section === 'statistics' && <StatisticsPage onBack={() => setSection('home')} />}
      {section === 'leaderboard' && <Scoreboard onBack={() => setSection('home')} />}
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