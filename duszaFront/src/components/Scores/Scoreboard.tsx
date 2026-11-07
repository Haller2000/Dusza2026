import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from './Scoreboard.module.css';

interface ScoreItem {
  id: number;
  user: number;
  username: string;
  map: number;
  gold_count: number;
  step_count: number;
  points: number;
  created_at: string;
}

export const Scoreboard: React.FC = () => {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ScoreItem[]>('http://127.0.0.1:8000/api/scores/');
      setScores(response.data);
    } catch (err) {
      setError('Nem sikerült betölteni a ranglistát.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className={styles.status}>Ranglista betöltése...</div>;
  if (error) return <div className={`${styles.status} ${styles.error}`}>⚠️ {error}</div>;

  return (
    <div className={styles.scoreboard}>
      <h2>🏆 Ranglista (Scoreboard)</h2>
      <p>A pontszám az összegyűjtött arany és a lépések számának hányadosa.</p>

      {scores.length === 0 ? (
        <p>Még nincsenek elmentett eredmények.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.headerCell}>Helyezés</th>
              <th className={styles.headerCell}>Játékos</th>
              <th className={styles.headerCell}>Pontszám</th>
              <th className={styles.headerCell}>🪙 Arany</th>
              <th className={styles.headerCell}>🐾 Lépés</th>
              <th className={styles.headerCell}>Dátum</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, index) => (
              <tr key={score.id} className={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                <td className={`${styles.cell} ${styles.rankCell}`}>
                  {index === 0 ? '🥇 1.' : index === 1 ? '🥈 2.' : index === 2 ? '🥉 3.' : `${index + 1}.`}
                </td>
                <td className={styles.cell}>{score.username}</td>
                <td className={styles.cell}>
                  {Number(score.points).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`${styles.cell} ${styles.goldCell}`}>
                  {score.gold_count} db
                </td>
                <td className={styles.cell}>{score.step_count} lépés</td>
                <td className={`${styles.cell} ${styles.dateCell}`}>
                  {new Date(score.created_at).toLocaleString('hu-HU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Scoreboard;