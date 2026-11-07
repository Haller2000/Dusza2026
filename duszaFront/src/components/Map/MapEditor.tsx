import React, { useState, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import styles from './MapEditor.module.css';

interface MapEditorProps {
  onMapSaved?: () => void;
}

type CellType = '.' | '#' | '@' | '>' | '<' | '^' | 'v';

const isCellType = (cell: string): cell is CellType =>
  ['.', '#', '@', '>', '<', '^', 'v'].includes(cell);

const renderCellIcon = (cell: CellType, iconClassName = styles.cellIcon) => {
  if (cell === '.') {
    return (
      <svg className={iconClassName} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="7" fill="#e2e9d2" stroke="#b9c5a5" strokeWidth="2.5" />
        <path d="M10 10h8" stroke="#f7f8ee" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (cell === '#') {
    return (
      <svg className={iconClassName} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="7" fill="#b98a5c" stroke="#8a5f3a" strokeWidth="2.5" />
        <path d="M5 17h38M5 31h38M18 5v12m12 0v14M16 31v12m17-12v12" stroke="#8a5f3a" strokeWidth="1.7" strokeLinecap="round" opacity=".7" />
      </svg>
    );
  }

  if (cell === '@') {
    return (
      <svg className={iconClassName} viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="40" rx="11" ry="3" fill="#6b5a3a" opacity=".2" />
        <circle cx="24" cy="23" r="12" fill="#f4b83f" stroke="#a8721a" strokeWidth="2.5" />
        <circle cx="24" cy="23" r="6.5" fill="none" stroke="#a8721a" strokeWidth="1.6" opacity=".65" />
        <path d="M19 18a7 7 0 0 1 5-2" stroke="#fff8e0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (['>', '<', '^', 'v'].includes(cell)) {
    const rotation = cell === '^' ? -90 : cell === 'v' ? 90 : 0;
    const transform = cell === '<'
      ? 'translate(48 0) scale(-1 1)'
      : `rotate(${rotation} 24 24)`;

    return (
      <svg className={iconClassName} viewBox="0 0 48 48" aria-hidden="true">
        <g transform={transform}>
          <rect x="8" y="19" width="32" height="22" rx="8" fill="#7bc9a8" stroke="#3d6b54" strokeWidth="2.5" />
          <rect x="12" y="6" width="24" height="20" rx="8" fill="#9bdcc0" stroke="#3d6b54" strokeWidth="2.5" />
          <circle cx="19" cy="15" r="3" fill="#28453a" />
          <circle cx="29" cy="15" r="3" fill="#28453a" />
          <circle cx="20" cy="14" r=".8" fill="#d5f3df" />
          <circle cx="30" cy="14" r=".8" fill="#d5f3df" />
          <circle cx="24" cy="25" r="2.2" fill="#28453a" opacity=".7" />
          <path d="M18 33h12" stroke="#3d6b54" strokeWidth="2" strokeLinecap="round" />
          <rect x="34" y="25" width="4" height="12" rx="2" fill="#d5f3df" stroke="#3d6b54" strokeWidth="1.2" />
          <circle cx="5" cy="31" r="3.5" fill="#5a5f52" stroke="#3d6b54" strokeWidth="1.8" />
          <circle cx="43" cy="31" r="3.5" fill="#5a5f52" stroke="#3d6b54" strokeWidth="1.8" />
        </g>
      </svg>
    );
  }

  return null;
};

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
  is_builtin: boolean;
}

const getApiErrorMessage = (data: unknown): string | null => {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const message = getApiErrorMessage(item);
      if (message) return message;
    }
    return null;
  }
  if (data && typeof data === 'object') {
    const errors = data as Record<string, unknown>;
    const preferredKeys = ['name', 'detail', 'non_field_errors'];
    for (const key of preferredKeys) {
      if (key in errors) {
        const message = getApiErrorMessage(errors[key]);
        if (message) return message;
      }
    }
    for (const value of Object.values(errors)) {
      const message = getApiErrorMessage(value);
      if (message) return message;
    }
  }
  return null;
};

export const MapEditor: React.FC<MapEditorProps> = ({ onMapSaved }) => {
  const [mapName, setMapName] = useState<string>('Új Pálya');
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  const cellSize = Math.min(570 / Math.max(width, height), 72);
  
  // A rács 2D tömbként tárolva
  const [grid, setGrid] = useState<CellType[][]>(() => createEmptyGrid(width, height));
  
  // Az aktuálisan kiválasztott "festő" eszköz
  const [selectedTool, setSelectedTool] = useState<CellType>('#');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [databaseLoading, setDatabaseLoading] = useState<boolean>(false);
  const [databaseMapsVisible, setDatabaseMapsVisible] = useState<boolean>(false);
  const [databaseMaps, setDatabaseMaps] = useState<StoredMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
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
      setEditingMapId(selectedMap.is_builtin ? null : selectedMap.id);
      setDatabaseMapsVisible(false);
      setErrorMessage('');
      setSuccessMessage(`A(z) „${selectedMap.name}” pálya betöltve az adatbázisból.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Nem sikerült betölteni a kiválasztott pályát.');
    }
  };

  // Mentés a backendre a token használatával
  const handleSaveMap = async (saveAsNew = false) => {
    setErrorMessage('');
    setSuccessMessage('');
    const cells = grid.flat();
    const robotCount = cells.filter(cell => ['>', '<', '^', 'v'].includes(cell)).length;
    if (robotCount !== 1) {
      setErrorMessage('A pálya csak pontosan egy robottal menthető el.');
      return;
    }
    if (!cells.includes('@')) {
      setErrorMessage('A pálya csak legalább egy arannyal menthető el.');
      return;
    }
    setLoading(true);

    const mapDataText = gridToString();
    const token = localStorage.getItem('authToken');

    try {
      const updateExistingMap = editingMapId !== null && !saveAsNew;
      const url = updateExistingMap
        ? `http://127.0.0.1:8000/api/maps/${editingMapId}/`
        : 'http://127.0.0.1:8000/api/maps/';
      const response = await axios({
        method: updateExistingMap ? 'put' : 'post',
        url,
        data: {
          name: mapName,
          width,
          height,
          map_data: mapDataText,
        },
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
      });

      setEditingMapId(response.data.id);
      setSuccessMessage(
        updateExistingMap
          ? 'A pálya frissítése sikeres.'
          : saveAsNew
            ? 'A pálya új példányként sikeresen elmentve.'
            : 'Sikeres térképmentés a szerverre!'
      );
      if (onMapSaved) onMapSaved();
    } catch (err) {
      const error = err as AxiosError<unknown>;
      if (error.response?.data) {
        setErrorMessage(
          getApiErrorMessage(error.response.data) ||
          `Nem sikerült menteni a pályát (HTTP ${error.response.status}).`
        );
      } else {
        setErrorMessage(error.message || 'Nem sikerült elérni a szervert.');
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
        setEditingMapId(null);
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
        <button onClick={() => setSelectedTool('#')} className={selectedTool === '#' ? styles.selectedTool : ''}>{renderCellIcon('#', styles.toolIcon)} Fal</button>
        <button onClick={() => setSelectedTool('.')} className={selectedTool === '.' ? styles.selectedTool : ''}>{renderCellIcon('.', styles.toolIcon)} Üres</button>
        <button onClick={() => setSelectedTool('@')} className={selectedTool === '@' ? styles.selectedTool : ''}>{renderCellIcon('@', styles.toolIcon)} Arany</button>
        <button onClick={() => setSelectedTool('>')} className={selectedTool === '>' ? styles.selectedTool : ''}>{renderCellIcon('>', styles.toolIcon)} Kelet</button>
        <button onClick={() => setSelectedTool('<')} className={selectedTool === '<' ? styles.selectedTool : ''}>{renderCellIcon('<', styles.toolIcon)} Nyugat</button>
        <button onClick={() => setSelectedTool('^')} className={selectedTool === '^' ? styles.selectedTool : ''}>{renderCellIcon('^', styles.toolIcon)} Észak</button>
        <button onClick={() => setSelectedTool('v')} className={selectedTool === 'v' ? styles.selectedTool : ''}>{renderCellIcon('v', styles.toolIcon)} Dél</button>
      </div>

      {/* Rács (Grid) nézet */}
      <div className={styles.gridViewport}>
        <div className={styles.gridBoard}>
          {grid.map((row, rIndex) => (
            <div key={rIndex} className={styles.gridRow}>
              {row.map((cell, cIndex) => (
                <div
                  key={cIndex}
                  onClick={() => handleCellClick(rIndex, cIndex)}
                  className={`${styles.gridCell} ${cell === '#' ? styles.wallCell : cell === '@' ? styles.goldCell : ['>', '<', '^', 'v'].includes(cell) ? styles.robotCell : styles.emptyCell}`}
                  style={{ width: cellSize, minWidth: cellSize, height: cellSize }}
                >
                  {cell === '.' ? null : renderCellIcon(cell)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Műveleti gombok */}
      <div className={styles.operations}>
        <button onClick={() => handleSaveMap()} disabled={loading} className={`${styles.operationButton} ${styles.saveButton}`}>
          {loading ? 'Mentés...' : editingMapId ? '💾 Pálya frissítése' : '💾 Mentés Szerverre'}
        </button>
        {editingMapId && (
          <button
            type="button"
            onClick={() => handleSaveMap(true)}
            disabled={loading}
            className={`${styles.operationButton} ${styles.saveButton}`}
          >
            💾 Mentés új néven
          </button>
        )}
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