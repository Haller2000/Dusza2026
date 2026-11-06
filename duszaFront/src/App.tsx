import React, { useState } from 'react';
import AuthContainer from './components/Auth/AuthContainer';
import MapEditor from './components/Map/MapEditor';
import Scoreboard from './components/Scores/Scoreboard';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('authToken'));
  const [currentView, setCurrentView] = useState<'editor' | 'scores'>('editor');

  const handleAuthSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      {isLoggedIn ? (
        <div>
          {/* Navigációs sáv */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
            <div>
              <button 
                onClick={() => setCurrentView('editor')}
                style={{ marginRight: '10px', padding: '8px 16px', background: currentView === 'editor' ? '#2563eb' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🗺️ Térképszerkesztő
              </button>
              <button 
                onClick={() => setCurrentView('scores')}
                style={{ padding: '8px 16px', background: currentView === 'scores' ? '#2563eb' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🏆 Ranglista (Scoreboard)
              </button>
            </div>
            <button 
              onClick={handleLogout}
              style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Kijelentkezés
            </button>
          </div>

          {/* Nézetek váltása */}
          {currentView === 'editor' ? <MapEditor /> : <Scoreboard />}
        </div>
      ) : (
        <AuthContainer onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
};

export default App;