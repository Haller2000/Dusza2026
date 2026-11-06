import React, { useState } from 'react';
import MapEditor from '../Map/MapEditor';
import Navbar from './Navbar/Navbar';
import styles from './HomePage.module.css';

interface HomePageProps {
  username: string;
  handleLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ username, handleLogout }) => {
  const [showMapEditor, setShowMapEditor] = useState<boolean>(false);

  return (
    <div className={styles.homePage}>
      <Navbar username={username} handleLogout={handleLogout} />
      <div className={styles.homeActions}>
        <button type="button" className={styles.homeActionButton}>
          Játék
        </button>
        <button
          type="button"
          onClick={() => setShowMapEditor(true)}
          className={styles.homeActionButton}
        >
          Pályaszerkesztő
        </button>
      </div>
      {showMapEditor ? (
        <>
          <button
            type="button"
            onClick={() => setShowMapEditor(false)}
            className={styles.backButton}
          >
            Vissza a főoldalra
          </button>
          <MapEditor />
        </>
      ) : (
        <main className={styles.homeContent}>
          <h1>HomePage</h1>
        </main>
      )}
    </div>
  );
};

export default HomePage;