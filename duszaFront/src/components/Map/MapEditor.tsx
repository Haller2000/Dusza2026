import React, { useState, useEffect, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';

interface MapEditorProps {
  onMapSaved?: () => void;
}

type CellType = '.' | '#' | '@' | '>' | '<' | '^' | 'v';

export const MapEditor: React.FC<MapEditorProps> = ({ onMapSaved }) => {
  const [mapName, setMapName] = useState<string>('Új Pálya');
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  
  // A rács 2D tömbként tárolva
  const [grid, setGrid] = useState<CellType[][]>([]);
  
  // Az aktuálisan kiválasztott "festő" eszköz
  const [selectedTool, setSelectedTool] = useState<CellType>('#');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Rács inicializálása vagy átméretezése, ha a width/height változik
  useEffect(() => {
    generateEmptyGrid(width, height);
  }, [width, height]);

  const generateEmptyGrid = (w: number, h: number) => {
    const newGrid: CellType[][] = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => '.')
    );
    // Kezdésként teszünk egy robotot a bal felső sarokba
    newGrid[0][0] = '>';
    setGrid(newGrid);
  };

  // Mezőre kattintás a rácson
  const handleCellClick = (rIndex: number, cIndex: number) => {
    const updatedGrid = grid.map((row, r) =>
      row.map((cell, c) => {
        if (r === rIndex && c === cIndex) {
          return selectedTool;
        }
        return cell;
      })
    );

    // Ha robotot (> < ^ v) helyezünk el, biztosítsuk, hogy csak 1 legyen a pályán
    if (['>', '<', '^', 'v'].includes(selectedTool)) {
      for (let r = 0; r < updatedGrid.length; r++) {
        for (let c = 0; c < updatedGrid[r].length; c++) {
          if (['>', '<', '^', 'v'].includes(updatedGrid[r][c]) && (r !== rIndex || c !== cIndex)) {
            updatedGrid[r][c] = '.'; // A régi robot helyére üres kamra kerül
          }
        }
      }
    }

    setGrid(updatedGrid);
  };

  // Konvertálás a backend által elvárt szöveges formátumra
  const gridToString = (): string => {
    return grid.map(row => row.join('')).join('\n');
  };

  // Mentés a backendre a token használatával
  const handleSaveMap = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    const mapDataText = gridToString();
    const token = localStorage.getItem('authToken');

    try {
      await axios.post(
        'http://127.0.0.1:8000/api/maps/',
        {
          name: mapName,
          width: width,
          height: height,
          map_data: mapDataText,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Token ${token}` } : {}),
          },
        }
      );

      setSuccessMessage('Sikeres térképmentés a szerverre!');
      if (onMapSaved) onMapSaved();
    } catch (err) {
      const error = err as AxiosError<any>;
      if (error.response && error.response.data) {
        const data = error.response.data;
        // Kigyűjtjük a backend serializers hibáit
        const firstKey = Object.keys(data)[0];
        const errorMsg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
        setErrorMessage(typeof errorMsg === 'string' ? errorMsg : 'Hiba történt a mentés során.');
      } else {
        setErrorMessage('Nem sikerült elérni a szervert.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Térkép exportálása szöveges fájlként
  const handleExportFile = () => {
    const fileContent = `${width} ${height}\n${gridToString()}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapName.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Térkép importálása fájlból
  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) {
          alert('Hibás fájlformátum!');
          return;
        }

        const [wStr, hStr] = lines[0].trim().split(' ');
        const parsedW = parseInt(wStr, 10);
        const parsedH = parseInt(hStr, 10);

        if (isNaN(parsedW) || isNaN(parsedH) || parsedW < 1 || parsedW > 15 || parsedH < 1 || parsedH > 15) {
          alert('Érvénytelen méretek a fájl fejlécében (1-15 közötti érték kell)!');
          return;
        }

        const mapRows = lines.slice(1, 1 + parsedH);
        if (mapRows.length !== parsedH) {
          alert('A sorok száma nem egyezik a megadott magassággal!');
          return;
        }

        const newGrid: CellType[][] = mapRows.map(rowLine => {
          return rowLine.trim().split('') as CellType[];
        });

        setWidth(parsedW);
        setHeight(parsedH);
        setGrid(newGrid);
        setSuccessMessage('Sikeres fájl importálás!');
      } catch (err) {
        alert('Hiba a fájl feldolgozása közben!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h2>🗺️ Térképszerkesztő</h2>
      
      {errorMessage && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', marginBottom: '10px', borderRadius: '6px' }}>⚠️ {errorMessage}</div>}
      {successMessage && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px', marginBottom: '10px', borderRadius: '6px' }}>✅ {successMessage}</div>}

      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <div>
          <label>Pálya neve: </label>
          <input 
            type="text" 
            value={mapName} 
            onChange={(e) => setMapName(e.target.value)} 
          />
        </div>
        <div>
          <label>Szélesség (1-15): </label>
          <input 
            type="number" 
            min="1" 
            max="15" 
            value={width} 
            onChange={(e) => setWidth(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))} 
          />
        </div>
        <div>
          <label>Magasság (1-15): </label>
          <input 
            type="number" 
            min="1" 
            max="15" 
            value={height} 
            onChange={(e) => setHeight(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))} 
          />
        </div>
      </div>

      {/* Festő eszközök */}
      <div style={{ marginBottom: '15px', padding: '10px', background: '#f1f5f9', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderRadius: '6px' }}>
        <span><strong>Eszköz:</strong></span>
        <button onClick={() => setSelectedTool('#')} style={{ fontWeight: selectedTool === '#' ? 'bold' : 'normal' }}>🧱 Fal (#)</button>
        <button onClick={() => setSelectedTool('.')} style={{ fontWeight: selectedTool === '.' ? 'bold' : 'normal' }}>🔲 Üres (.)</button>
        <button onClick={() => setSelectedTool('@')} style={{ fontWeight: selectedTool === '@' ? 'bold' : 'normal' }}>🪙 Arany (@)</button>
        <button onClick={() => setSelectedTool('>')} style={{ fontWeight: selectedTool === '>' ? 'bold' : 'normal' }}>🤖 Kelet (&gt;)</button>
        <button onClick={() => setSelectedTool('<')} style={{ fontWeight: selectedTool === '<' ? 'bold' : 'normal' }}>🤖 Nyugat (&lt;)</button>
        <button onClick={() => setSelectedTool('^')} style={{ fontWeight: selectedTool === '^' ? 'bold' : 'normal' }}>🤖 Észak (^)</button>
        <button onClick={() => setSelectedTool('v')} style={{ fontWeight: selectedTool === 'v' ? 'bold' : 'normal' }}>🤖 Dél (v)</button>
      </div>

      {/* Rács (Grid) nézet */}
      <div style={{ overflowX: 'auto', marginBottom: '20px', border: '2px solid #ccc', display: 'inline-block', background: '#fff' }}>
        {grid.map((row, rIndex) => (
          <div key={rIndex} style={{ display: 'flex' }}>
            {row.map((cell, cIndex) => (
              <div
                key={cIndex}
                onClick={() => handleCellClick(rIndex, cIndex)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: cell === '#' ? '#334155' : cell === '@' ? '#fde047' : ['>', '<', '^', 'v'].includes(cell) ? '#3b82f6' : '#fff',
                  color: ['>', '<', '^', 'v'].includes(cell) ? '#fff' : '#000',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  userSelect: 'none',
                }}
              >
                {cell === '.' ? '' : cell}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Műveleti gombok */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleSaveMap} disabled={loading} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? 'Mentés...' : '💾 Mentés Szerverre'}
        </button>
        <button onClick={handleExportFile} style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          📥 Exportálás Fájlba
        </button>
        <label style={{ padding: '10px 20px', background: '#9333ea', color: '#fff', borderRadius: '6px', cursor: 'pointer', display: 'inline-block' }}>
          📂 Importálás Fájlból
          <input type="file" accept=".txt" onChange={handleImportFile} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
};

export default MapEditor;