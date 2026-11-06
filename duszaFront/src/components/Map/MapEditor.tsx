import React, { useState, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './MapEditor.module.css';

interface MapEditorProps {
  onMapSaved?: () => void;
}

type CellType = '.' | '#' | '@' | '>' | '<' | '^' | 'v';

const isCellType = (cell: string): cell is CellType =>
  ['.', '#', '@', '>', '<', '^', 'v'].includes(cell);

const createEmptyGrid = (width: number, height: number): CellType[][] => {
  const grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => '.' as CellType)
  );
  grid[0][0] = '>';
  return grid;
};

interface StoredMap {
  id: number;
  name: string;
  width: number;
  height: number;
  map_data: string;
}

export const MapEditor: React.FC<MapEditorProps> = ({ onMapSaved }) => {
  const [mapName, setMapName] = useState<string>('Új Pálya');
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  
  // A rács 2D tömbként tárolva
  const [grid, setGrid] = useState<CellType[][]>(() => createEmptyGrid(width, height));
  
  // Az aktuálisan kiválasztott "festő" eszköz
  const [selectedTool, setSelectedTool] = useState<CellType>('#');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [databaseLoading, setDatabaseLoading] = useState<boolean>(false);
  const [databaseMapsVisible, setDatabaseMapsVisible] = useState<boolean>(false);
  const [databaseMaps, setDatabaseMaps] = useState<StoredMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleWidthChange = (value: string) => {
    const newWidth = Math.max(1, Math.min(15, parseInt(value, 10) || 1));
    setWidth(newWidth);
    setGrid(createEmptyGrid(newWidth, height));
  };

  const handleHeightChange = (value: string) => {
    const newHeight = Math.max(1, Math.min(15, parseInt(value, 10) || 1));
    setHeight(newHeight);
    setGrid(createEmptyGrid(width, newHeight));
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

  const handleShowDatabaseMaps = async () => {
    if (databaseMapsVisible) {
      setDatabaseMapsVisible(false);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setDatabaseLoading(true);
    setDatabaseMapsVisible(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get<StoredMap[]>('http://127.0.0.1:8000/api/maps/', {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      setDatabaseMaps(response.data);
      setSelectedMapId(response.data.length > 0 ? String(response.data[0].id) : '');
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      setErrorMessage(error.response?.data?.detail || 'Nem sikerült betölteni az adatbázisban tárolt pályákat.');
      setDatabaseMapsVisible(false);
    } finally {
      setDatabaseLoading(false);
    }
  };

  const handleLoadDatabaseMap = () => {
    const selectedMap = databaseMaps.find(map => String(map.id) === selectedMapId);
    if (!selectedMap) {
      setErrorMessage('Válassz ki egy betöltendő pályát!');
      return;
    }

    try {
      if (
        !Number.isInteger(selectedMap.width) ||
        !Number.isInteger(selectedMap.height) ||
        selectedMap.width < 1 ||
        selectedMap.width > 15 ||
        selectedMap.height < 1 ||
        selectedMap.height > 15
      ) {
        throw new Error('A kiválasztott pálya méretei érvénytelenek.');
      }

      const rows = selectedMap.map_data.trim().split(/\r?\n/);
      if (rows.length !== selectedMap.height) {
        throw new Error('A kiválasztott pálya sorainak száma hibás.');
      }

      const loadedGrid = rows.map(row => {
        const cells = row.trim().split('');
        if (cells.length !== selectedMap.width || !cells.every(isCellType)) {
          throw new Error('A kiválasztott pálya rácsa hibás formátumú.');
        }

        return cells;
      });
      const robotCount = loadedGrid.flat().filter(cell => ['>', '<', '^', 'v'].includes(cell)).length;

      if (robotCount !== 1) {
        throw new Error('A kiválasztott pályán pontosan egy robotnak kell lennie.');
      }

      setMapName(selectedMap.name);
      setWidth(selectedMap.width);
      setHeight(selectedMap.height);
      setGrid(loadedGrid);
      setDatabaseMapsVisible(false);
      setErrorMessage('');
      setSuccessMessage(`A(z) „${selectedMap.name}” pálya betöltve az adatbázisból.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Nem sikerült betölteni a kiválasztott pályát.');
    }
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
      } catch {
        alert('Hiba a fájl feldolgozása közben!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.editorShell}>
      <h2>🗺️ Térképszerkesztő</h2>
      
      {errorMessage && <div className={styles.alertError}>⚠️ {errorMessage}</div>}
      {successMessage && <div className={styles.alertSuccess}>✅ {successMessage}</div>}

      <div className={styles.fieldsRow}>
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
            onChange={(e) => handleWidthChange(e.target.value)}
          />
        </div>
        <div>
          <label>Magasság (1-15): </label>
          <input 
            type="number" 
            min="1" 
            max="15" 
            value={height} 
            onChange={(e) => handleHeightChange(e.target.value)}
          />
        </div>
      </div>

      {/* Festő eszközök */}
      <div className={styles.toolBar}>
        <span><strong>Eszköz:</strong></span>
        <button onClick={() => setSelectedTool('#')} className={selectedTool === '#' ? styles.selectedTool : ''}>🧱 Fal (#)</button>
        <button onClick={() => setSelectedTool('.')} className={selectedTool === '.' ? styles.selectedTool : ''}>🔲 Üres (.)</button>
        <button onClick={() => setSelectedTool('@')} className={selectedTool === '@' ? styles.selectedTool : ''}>🪙 Arany (@)</button>
        <button onClick={() => setSelectedTool('>')} className={selectedTool === '>' ? styles.selectedTool : ''}>🤖 Kelet (&gt;)</button>
        <button onClick={() => setSelectedTool('<')} className={selectedTool === '<' ? styles.selectedTool : ''}>🤖 Nyugat (&lt;)</button>
        <button onClick={() => setSelectedTool('^')} className={selectedTool === '^' ? styles.selectedTool : ''}>🤖 Észak (^)</button>
        <button onClick={() => setSelectedTool('v')} className={selectedTool === 'v' ? styles.selectedTool : ''}>🤖 Dél (v)</button>
      </div>

      {/* Rács (Grid) nézet */}
      <div className={styles.gridViewport}>
        {grid.map((row, rIndex) => (
          <div key={rIndex} className={styles.gridRow}>
            {row.map((cell, cIndex) => (
              <div
                key={cIndex}
                onClick={() => handleCellClick(rIndex, cIndex)}
                className={`${styles.gridCell} ${cell === '#' ? styles.wallCell : cell === '@' ? styles.goldCell : ['>', '<', '^', 'v'].includes(cell) ? styles.robotCell : styles.emptyCell}`}
              >
                {cell === '.' ? '' : cell}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Műveleti gombok */}
      <div className={styles.operations}>
        <button onClick={handleSaveMap} disabled={loading} className={`${styles.operationButton} ${styles.saveButton}`}>
          {loading ? 'Mentés...' : '💾 Mentés Szerverre'}
        </button>
        <button onClick={handleExportFile} className={`${styles.operationButton} ${styles.exportButton}`}>
          📥 Exportálás Fájlba
        </button>
        <label className={`${styles.operationButton} ${styles.importButton}`}>
          📂 Importálás Fájlból
          <input type="file" accept=".txt" onChange={handleImportFile} className={styles.hiddenInput} />
        </label>
        <button
          type="button"
          onClick={handleShowDatabaseMaps}
          disabled={databaseLoading}
          className={`${styles.operationButton} ${styles.databaseButton}`}
        >
          {databaseLoading ? 'Pályák betöltése...' : databaseMapsVisible ? 'Lista bezárása' : '🗄️ Betöltés adatbázisból'}
        </button>
      </div>
      {databaseMapsVisible && (
        <div className={styles.databaseLoader}>
          {databaseMaps.length > 0 ? (
            <>
              <label htmlFor="stored-map">Mentett pálya:</label>
              <select
                id="stored-map"
                value={selectedMapId}
                onChange={event => setSelectedMapId(event.target.value)}
              >
                {databaseMaps.map(map => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.width} × {map.height})
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleLoadDatabaseMap}>
                Pálya betöltése
              </button>
            </>
          ) : (
            <span>{databaseLoading ? 'Mentett pályák keresése...' : 'Nincs mentett pálya az adatbázisban.'}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default MapEditor;