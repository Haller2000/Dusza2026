import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import MapCard from '../Map/MapCard';
import MapTileIcon, { type MapTile } from '../Map/MapTileIcon';
import type { SelectableMap } from '../Map/MapSelectionPage';
import styles from './StatisticsPage.module.css';

interface MapSnapshot {
  name: string;
  width: number;
  height: number;
  map_data: string;
  is_builtin: boolean;
}

interface RecentGame {
  id: number;
  map_name: string;
  map_snapshot: MapSnapshot;
  points: number;
  gold_count: number;
  step_count: number;
  steps: SavedStep[];
  created_at: string;
}

interface SavedStep {
  x?: number;
  y?: number;
  robot?: [number, number];
  facing?: string | number;
  gold?: number;
  line?: number;
}

interface PlaybackFrame {
  x: number;
  y: number;
  facing: MapTile;
  gold: number;
  line: number;
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

const normalizeStep = (step: SavedStep): PlaybackFrame | null => {
  const [robotX, robotY] = Array.isArray(step.robot) ? step.robot : [undefined, undefined];
  const x = Number.isInteger(step.x) ? step.x : robotX;
  const y = Number.isInteger(step.y) ? step.y : robotY;
  if (typeof x !== 'number' || !Number.isInteger(x)
    || typeof y !== 'number' || !Number.isInteger(y)) return null;

  const facing = typeof step.facing === 'number'
    ? (['^', '<', 'v', '>'] as const)[step.facing]
    : step.facing;
  const validFacing: MapTile[] = ['^', '<', 'v', '>'];

  return {
    x,
    y,
    facing: validFacing.includes(facing as MapTile) ? facing as MapTile : '>',
    gold: Number.isFinite(step.gold) ? Number(step.gold) : 0,
    line: Number.isFinite(step.line) ? Number(step.line) : 0,
  };
};

const Timelapse: React.FC<{ game: RecentGame }> = ({ game }) => {
  const frames = game.steps.map(normalizeStep).filter((frame): frame is PlaybackFrame => frame !== null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mapRows = game.map_snapshot.map_data.split(/\r?\n/);
  const frame = frames[frameIndex];

  useEffect(() => {
    if (!isPlaying || frames.length < 2) return;
    const timer = window.setInterval(() => {
      if (frameIndex >= frames.length - 1) {
        setIsPlaying(false);
        return;
      }
      setFrameIndex(frameIndex + 1);
    }, 350);
    return () => window.clearInterval(timer);
  }, [frameIndex, frames.length, isPlaying]);

  if (!frames.length) {
    return <p className={styles.timelapseEmpty}>Ehhez a játékhoz nincs mentett mozgáselőzmény.</p>;
  }

  return (
    <div className={styles.timelapse}>
      <div
        className={styles.timelapseGrid}
        style={{ gridTemplateColumns: `repeat(${game.map_snapshot.width}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${game.map_name} robotmozgásának ${frameIndex + 1}. állapota`}
      >
        {Array.from({ length: game.map_snapshot.height }, (_, y) =>
          Array.from({ length: game.map_snapshot.width }, (_, x) => {
            const isRobot = frame.x === x && frame.y === y;
            const cell = isRobot ? frame.facing : (mapRows[y]?.[x] ?? '.') as MapTile;
            return (
              <span key={`${x}-${y}`} className={`${styles.timelapseTile} ${isRobot ? styles.timelapseRobot : ''}`}>
                <MapTileIcon cell={cell} className={styles.timelapseTileIcon} />
              </span>
            );
          })
        )}
      </div>
      <div className={styles.timelapseStats} aria-live="polite">
        <span>Állapot: {frameIndex + 1} / {frames.length}</span>
        <span>Robot: {frame.x + 1}, {frame.y + 1} · {frame.facing}</span>
        <span>Arany: {frame.gold}</span>
        {frame.line > 0 && <span>Script {frame.line}. sora</span>}
      </div>
      <div className={styles.timelapseControls}>
        <button
          type="button"
          onClick={() => {
            if (frameIndex >= frames.length - 1) setFrameIndex(0);
            setIsPlaying(current => !current);
          }}
          className={styles.timelapseButton}
        >
          {isPlaying ? 'Szünet' : frameIndex >= frames.length - 1 ? 'Újra lejátszás' : 'Lejátszás'}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={frameIndex}
          onChange={event => {
            setIsPlaying(false);
            setFrameIndex(Number(event.target.value));
          }}
          aria-label="Timelapse állapota"
        />
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            setFrameIndex(0);
          }}
          className={styles.timelapseButton}
        >
          Elejére
        </button>
      </div>
    </div>
  );
};

const StatisticsPage: React.FC<StatisticsPageProps> = ({ onBack }) => {
  const [statistics, setStatistics] = useState<StatisticsData>(EMPTY_STATISTICS);
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('authToken')));
  const [errorMessage, setErrorMessage] = useState<string>(() =>
    localStorage.getItem('authToken') ? '' : 'A statisztika megtekintéséhez be kell jelentkezni.'
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.get<StatisticsData>('/api/statistics/', {
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
        <p>A mentett játékok és eredmények összesítése. Pontszám: arany ÷ lépések × 100.</p>
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
                    <details className={styles.mapDetails}>
                      <summary>Pálya megtekintése</summary>
                      <div className={styles.mapDetailsContent}>
                        <MapCard
                          map={{
                            ...game.map_snapshot,
                            id: game.id,
                          } satisfies SelectableMap}
                        />
                        <div className={styles.mapDetailsInfo}>
                          <strong>{game.map_snapshot.name}</strong>
                          <span>{game.map_snapshot.width} × {game.map_snapshot.height} mező</span>
                          <span>{[...game.map_snapshot.map_data].filter(cell => cell === '@').length} arany a pályán</span>
                          <span>Teljesített eredmény: {game.gold_count} arany, {game.step_count} lépés</span>
                        </div>
                      </div>
                    </details>
                    <details className={styles.mapDetails}>
                      <summary>Robotmozgás timelapse</summary>
                      <Timelapse game={game} />
                    </details>
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
