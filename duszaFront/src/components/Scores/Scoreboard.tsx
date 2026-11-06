import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ScoreItem {
  id: number;
  user: number;
  username: string;
  map: number;
  gold_count: number;
  step_count: number;
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

  if (loading) return <div style={{ padding: '20px' }}>Ranglista betöltése...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>⚠️ {error}</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h2>🏆 Ranglista (Scoreboard)</h2>

      {scores.length === 0 ? (
        <p>Még nincsenek elmentett eredmények.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Helyezés</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Játékos</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>🪙 Arany</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>🐾 Lépés</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Dátum</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, index) => (
              <tr key={score.id} style={{ background: index % 2 === 0 ? '#f8fafc' : '#fff' }}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {index === 0 ? '🥇 1.' : index === 1 ? '🥈 2.' : index === 2 ? '🥉 3.' : `${index + 1}.`}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{score.username}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', color: '#d97706' }}>
                  {score.gold_count} db
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{score.step_count} lépés</td>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '12px', color: '#64748b' }}>
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