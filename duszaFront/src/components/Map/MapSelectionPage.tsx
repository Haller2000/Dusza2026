import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './MapSelectionPage.module.css';

export interface SelectableMap {
  id: number;
  name: string;
  width: number;
  height: number;
  map_data: string;
  is_builtin: boolean;
}

interface MapSelectionPageProps {
  onBack: () => void;
  onStart: (map: SelectableMap) => void;
}

const MapPreview: React.FC<{ map: SelectableMap }> = ({ map }) => {
  const rows = map.map_data.trim().split(/\r?\n/);
  const goldCount = rows.reduce((count, row) => count + [...row].filter(cell => cell === '@').length, 0);

  return (
    <div className={styles.previewArea}>
      <div
        className={styles.mapPreview}
        style={{ gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))` }}
        aria-label={`${map.width} oszlopos, ${map.height} soros pálya`}
      >
        {rows.flatMap((row, rowIndex) =>
          [...row].map((cell, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className={`${styles.cell} ${
                cell === '#' ? styles.wallCell :
                cell === '@' ? styles.goldCell :
                ['>', '<', '^', 'v'].includes(cell) ? styles.robotCell :
                styles.emptyCell
              }`}
              aria-hidden="true"
            />
          ))
        )}
      </div>
      <span className={styles.previewGoldCount}>◆ {goldCount}</span>
    </div>
  );
};

const MapSelectionPage: React.FC<MapSelectionPageProps> = ({ onBack, onStart }) => {
  const [maps, setMaps] = useState<SelectableMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('authToken')));
  const [errorMessage, setErrorMessage] = useState<string>(() =>
    localStorage.getItem('authToken') ? '' : 'A pályák megtekintéséhez be kell jelentkezni.'
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.get<SelectableMap[]>('http://127.0.0.1:8000/api/maps/', {
      headers: { Authorization: `Token ${token}` },
    }).then(response => {
      setMaps(response.data);
      setSelectedMapId(response.data.length > 0 ? response.data[0].id : null);
    }).catch((err: AxiosError<{ detail?: string }>) => {
      setErrorMessage(err.response?.data?.detail || 'Nem sikerült betölteni a pályákat.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const builtInMaps = maps.filter(map => map.is_builtin);
  const userMaps = maps.filter(map => !map.is_builtin);
  const selectedMap = maps.find(map => map.id === selectedMapId);

  const renderMapCard = (map: SelectableMap) => {
    const goldCount = [...map.map_data].filter(cell => cell === '@').length;
    const isSelected = selectedMapId === map.id;

    return (
      <button
        key={map.id}
        type="button"
        aria-pressed={isSelected}
        onClick={() => setSelectedMapId(map.id)}
        className={`${styles.mapCard} ${isSelected ? styles.selectedCard : ''}`}
      >
        <MapPreview map={map} />
        <span className={styles.cardContent}>
          <strong className={styles.mapName}>{map.name}</strong>
          <span className={styles.badges}>
            <span className={styles.badge}>{map.width} × {map.height}</span>
            <span className={`${styles.badge} ${styles.goldBadge}`}>◆ {goldCount} arany</span>
            <span className={`${styles.badge} ${map.is_builtin ? styles.sharedBadge : styles.ownBadge}`}>
              {map.is_builtin ? 'Közös pálya' : 'Saját pálya'}
            </span>
          </span>
          <span className={styles.cardHint}>
            {isSelected ? 'Kiválasztva' : 'Kattints a pálya kiválasztásához'}
          </span>
        </span>
      </button>
    );
  };

  return (
    <main className={styles.selectionPage}>
      <button type="button" onClick={onBack} className={styles.backButton}>
        ← Vissza a főoldalra
      </button>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>KINCSESKERESŐ ROBOT</span>
        <h1>Válassz pályát</h1>
        <p>Válassz egy közös sablonpályát vagy egyet a saját pályáid közül.</p>
      </header>

      {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
      {loading ? (
        <div className={styles.statusMessage}>Pályák betöltése...</div>
      ) : (
        <>
          {builtInMaps.length > 0 && (
            <section className={styles.mapSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Sablonpályák</h2>
                  <p>Minden játékos számára elérhető pályák</p>
                </div>
                <span className={styles.sectionCount}>{builtInMaps.length} pálya</span>
              </div>
              <div className={styles.mapGrid}>{builtInMaps.map(renderMapCard)}</div>
            </section>
          )}

          <section className={styles.mapSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Saját pályáim</h2>
                <p>Az általad létrehozott pályák</p>
              </div>
              <span className={styles.sectionCount}>{userMaps.length} pálya</span>
            </div>
            {userMaps.length > 0 ? (
              <div className={styles.mapGrid}>{userMaps.map(renderMapCard)}</div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">▦</span>
                <strong>Még nincs saját pályád</strong>
                <span>A pályaszerkesztőben elkészített pályáid itt jelennek majd meg.</span>
              </div>
            )}
          </section>

          {!errorMessage && maps.length === 0 && (
            <div className={styles.statusMessage}>Jelenleg nincs megjeleníthető pálya.</div>
          )}
        </>
      )}

      <footer className={styles.selectionFooter}>
        <span>{selectedMap ? `Kiválasztott pálya: ${selectedMap.name}` : 'Válassz egy pályát a folytatáshoz'}</span>
        <button
          type="button"
          disabled={!selectedMap || loading}
          onClick={() => selectedMap && onStart(selectedMap)}
          className={styles.startButton}
        >
          Pálya kiválasztása <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  );
};

export default MapSelectionPage;
