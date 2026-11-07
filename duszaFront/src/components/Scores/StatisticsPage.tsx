import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './StatisticsPage.module.css';

interface RecentGame {
  id: number;
  map_name: string;
  points: number;
  gold_count: number;
  step_count: number;
  created_at: string;
}

interface StatisticsData {
  games_played: number;
  total_gold: number;
  total_steps: number;
  total_points: number;
  average_points: number;
  best_points: number;
  best_gold: number;
  recent_games: RecentGame[];
}

interface StatisticsPageProps {
  onBack: () => void;
}

const EMPTY_STATISTICS: StatisticsData = {
  games_played: 0,
  total_gold: 0,
  total_steps: 0,
  total_points: 0,
  average_points: 0,
  best_points: 0,
  best_gold: 0,
  recent_games: [],
};

const statisticCards: Array<{ label: string; value: keyof Omit<StatisticsData, 'recent_games'> }> = [
  { label: 'Mentett játékok', value: 'games_played' },
  { label: 'Összegyűjtött arany', value: 'total_gold' },
  { label: 'Megtett lépések', value: 'total_steps' },
  { label: 'Összes pont', value: 'total_points' },
  { label: 'Átlagpontszám', value: 'average_points' },
  { label: 'Legjobb pontszám', value: 'best_points' },
];

const StatisticsPage: React.FC<StatisticsPageProps> = ({ onBack }) => {
  const [statistics, setStatistics] = useState<StatisticsData>(EMPTY_STATISTICS);
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('authToken')));
  const [errorMessage, setErrorMessage] = useState<string>(() =>
    localStorage.getItem('authToken') ? '' : 'A statisztika megtekintéséhez be kell jelentkezni.'
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.get<StatisticsData>('http://127.0.0.1:8000/api/statistics/', {
      headers: { Authorization: `Token ${token}` },
    }).then(response => {
      setStatistics(response.data);
    }).catch((err: AxiosError<{ detail?: string }>) => {
      setErrorMessage(err.response?.data?.detail || 'Nem sikerült betölteni a statisztikát.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <main className={styles.statisticsPage}>
      <button type="button" onClick={onBack} className={styles.backButton}>
        ← Vissza a főoldalra
      </button>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>JÁTÉKOSI ÁTTEKINTÉS</span>
        <h1>Statisztika</h1>
        <p>A mentett játékok és eredmények összesítése. Pontszám: összegyűjtött arany / lépések.</p>
      </header>

      {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
      {loading ? (
        <div className={styles.statusMessage}>Statisztika betöltése...</div>
      ) : (
        <>
          <section className={styles.statisticsGrid} aria-label="Összesített statisztika">
            {statisticCards.map(card => (
              <article key={card.value} className={styles.statisticCard}>
                <span>{card.label}</span>
                <strong>
                  {card.value.includes('points')
                    ? Number(statistics[card.value]).toLocaleString('hu-HU', { maximumFractionDigits: 2 })
                    : Number(statistics[card.value]).toLocaleString('hu-HU')}
                </strong>
              </article>
            ))}
          </section>

          <section className={styles.recentSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Legutóbbi játékok</h2>
                <p>A legutóbb elmentett eredményeid</p>
              </div>
              <span className={styles.gameCount}>{statistics.games_played} játék</span>
            </div>

            {statistics.recent_games.length > 0 ? (
              <div className={styles.gameList}>
                {statistics.recent_games.map(game => (
                  <article key={game.id} className={styles.gameRow}>
                    <div className={styles.gameMap}>
                      <strong>{game.map_name}</strong>
                      <time dateTime={game.created_at}>
                        {new Date(game.created_at).toLocaleString('hu-HU')}
                      </time>
                    </div>
                    <div className={styles.gameMetrics}>
                      <span><b>◆</b> {game.gold_count} arany</span>
                      <span>{game.step_count} lépés</span>
                      <strong>{Number(game.points).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} pont</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">▤</span>
                <strong>Még nincs mentett játékod</strong>
                <span>Amint eredmény kerül az adatbázisba, az összesítés itt automatikusan megjelenik.</span>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default StatisticsPage;
