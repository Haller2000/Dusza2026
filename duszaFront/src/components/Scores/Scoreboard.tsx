import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './Scoreboard.module.css';

interface LeaderboardMap {
  id: number;
  name: string;
}

interface LeaderboardResult {
  id: number;
  username: string;
  map: number;
  map_name: string;
  gold_count: number;
  step_count: number;
  points: number;
  created_at: string;
}

interface LeaderboardResponse {
  maps: LeaderboardMap[];
  results: LeaderboardResult[];
}

interface ScoreboardProps {
  onBack: () => void;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ onBack }) => {
  const [data, setData] = useState<LeaderboardResponse>({ maps: [], results: [] });
  const [selectedMapId, setSelectedMapId] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage('');

    axios.get<LeaderboardResponse>('/api/leaderboard/', {
      params: selectedMapId ? { map: selectedMapId } : {},
      signal: controller.signal,
    }).then(response => {
      setData(response.data);
    }).catch((error: AxiosError<{ detail?: string }>) => {
      if (!controller.signal.aborted) {
        setErrorMessage(error.response?.data?.detail || 'Nem sikerült betölteni a ranglistát.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [selectedMapId]);

  return (
    <main className={styles.page}>
      <button type="button" onClick={onBack} className={styles.backButton}>
        ← Vissza a főoldalra
      </button>

      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>JÁTÉKOSOK EREDMÉNYEI</span>
        <h1>Ranglista</h1>
        <p>Játékosonként a legjobb eredmény, pontszám szerint rendezve. Pontszám: arany ÷ lépések × 100.</p>
      </header>

      <section className={styles.resultsSection} aria-label="Ranglista eredményei">
        <div className={styles.sectionHeading}>
          <div>
            <h2>{selectedMapId ? 'Pálya ranglistája' : 'Összesített ranglista'}</h2>
            <p>{selectedMapId ? 'Játékosok legjobb eredménye a kiválasztott sablonpályán' : 'Játékosok legjobb eredménye az összes pályán'}</p>
          </div>
          <label className={styles.filter}>
            <span>Sablonpálya</span>
            <select value={selectedMapId} onChange={event => setSelectedMapId(event.target.value)}>
              <option value="">Minden pálya</option>
              {data.maps.map(map => (
                <option key={map.id} value={map.id}>{map.name}</option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}
        {loading ? (
          <div className={styles.status}>Ranglista betöltése...</div>
        ) : data.results.length === 0 ? (
          <div className={styles.emptyState}>Még nincs megjeleníthető eredmény ezen a ranglistán.</div>
        ) : (
          <div className={styles.tableViewport}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Helyezés</th>
                  <th>Játékos</th>
                  <th>Pálya</th>
                  <th>Pontszám</th>
                  <th>Arany</th>
                  <th>Lépések</th>
                  <th>Dátum</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((result, index) => (
                  <tr key={result.id}>
                    <td className={styles.rank}>
                      {index === 0 ? '🥇 1.' : index === 1 ? '🥈 2.' : index === 2 ? '🥉 3.' : `${index + 1}.`}
                    </td>
                    <td className={styles.player}>{result.username}</td>
                    <td>{result.map_name}</td>
                    <td className={styles.points}>
                      {Number(result.points).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>{result.gold_count}</td>
                    <td>{result.step_count}</td>
                    <td>{new Date(result.created_at).toLocaleDateString('hu-HU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default Scoreboard;
