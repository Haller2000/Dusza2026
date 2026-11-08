import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import MapCard from './MapCard';
import type { SelectableMap } from './MapSelectionPage';
import styles from './MapSelectionPage.module.css';

interface MyMapsPageProps {
  onBack: () => void;
}

const MyMapsPage: React.FC<MyMapsPageProps> = ({ onBack }) => {
  const [maps, setMaps] = useState<SelectableMap[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('authToken')));
  const [errorMessage, setErrorMessage] = useState<string>(() =>
    localStorage.getItem('authToken') ? '' : 'A saját pályák megtekintéséhez be kell jelentkezni.'
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.get<SelectableMap[]>('/api/maps/', {
      headers: { Authorization: `Token ${token}` },
    }).then(response => {
      setMaps(response.data.filter(map => !map.is_builtin));
    }).catch((err: AxiosError<{ detail?: string }>) => {
      setErrorMessage(err.response?.data?.detail || 'Nem sikerült betölteni a saját pályáidat.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <main className={styles.selectionPage}>
      <button type="button" onClick={onBack} className={styles.backButton}>
        ← Vissza a főoldalra
      </button>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>PÁLYATÁR</span>
        <h1>Saját pályáim</h1>
        <p>Az általad létrehozott pályák előnézetei.</p>
      </header>

      {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
      {loading ? (
        <div className={styles.statusMessage}>Saját pályák betöltése...</div>
      ) : maps.length > 0 ? (
        <>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Az én pályáim</h2>
              <p>{maps.length} mentett pálya</p>
            </div>
            <span className={styles.sectionCount}>{maps.length} pálya</span>
          </div>
          <div className={styles.mapGrid}>
            {maps.map(map => <MapCard key={map.id} map={map} showPreview />)}
          </div>
        </>
      ) : !errorMessage && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">▦</span>
          <strong>Még nincs saját pályád</strong>
          <span>A pályaszerkesztőben elkészített pályáid itt jelennek majd meg.</span>
        </div>
      )}
    </main>
  );
};

export default MyMapsPage;
