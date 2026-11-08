import React, { useEffect, useRef, useState, type ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';
import MapTileIcon, { type MapTile } from './MapTileIcon';
import styles from './MapEditor.module.css';

interface MapEditorProps {
  onBack: () => void;
  onMapSaved?: () => void;
}

type CellType = MapTile;

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

export const MapEditor: React.FC<MapEditorProps> = ({ onBack, onMapSaved }) => {
  const [mapName, setMapName] = useState<string>('Új Pálya');
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  const gridViewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 570, height: 570 });
  const availableWidth = Math.min(570, viewportSize.width - 18);
  const availableHeight = Math.min(570, viewportSize.height - 18);
  const cellSize = Math.max(
    1,
    Math.min(
      72,
      (availableWidth - (width - 1) * 3) / width,
      (availableHeight - (height - 1) * 3) / height
    )
  );
  
  const [grid, setGrid] = useState<CellType[][]>(() => createEmptyGrid(width, height));
  
  const [selectedTool, setSelectedTool] = useState<CellType>('#');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [databaseLoading, setDatabaseLoading] = useState<boolean>(false);
  const [databaseMapsVisible, setDatabaseMapsVisible] = useState<boolean>(false);
  const [databaseMaps, setDatabaseMaps] = useState<StoredMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    const viewport = gridViewportRef.current;
    if (!viewport) return;

    const resizeObserver = new ResizeObserver(() => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    });
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, []);

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

  const handleCellClick = (rIndex: number, cIndex: number) => {
    const updatedGrid = grid.map((row, r) =>
      row.map((cell, c) => {
        if (r === rIndex && c === cIndex) {
          return selectedTool;
        }
        return cell;
      })
    );

    if (['>', '<', '^', 'v'].includes(selectedTool)) {
      for (let r = 0; r < updatedGrid.length; r++) {
        for (let c = 0; c < updatedGrid[r].length; c++) {
          if (['>', '<', '^', 'v'].includes(updatedGrid[r][c]) && (r !== rIndex || c !== cIndex)) {
            updatedGrid[r][c] = '.';
          }
        }
      }
    }

    setGrid(updatedGrid);
  };

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
      const response = await axios.get<StoredMap[]>('/api/maps/', {
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
        ? `/api/maps/${editingMapId}/`
        : '/api/maps/';
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
      <button type="button" onClick={onBack} className={styles.backButton}>
        ← Vissza a főoldalra
      </button>
      <h2>Térképszerkesztő</h2>
      
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

      <div className={styles.toolBar}>
        <span><strong>Eszköz:</strong></span>
        <button onClick={() => setSelectedTool('#')} className={selectedTool === '#' ? styles.selectedTool : ''}><MapTileIcon cell="#" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Fal</button>
        <button onClick={() => setSelectedTool('.')} className={selectedTool === '.' ? styles.selectedTool : ''}><MapTileIcon cell="." className={`${styles.cellIcon} ${styles.toolIcon}`} /> Üres</button>
        <button onClick={() => setSelectedTool('@')} className={selectedTool === '@' ? styles.selectedTool : ''}><MapTileIcon cell="@" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Arany</button>
        <button onClick={() => setSelectedTool('>')} className={selectedTool === '>' ? styles.selectedTool : ''}><MapTileIcon cell=">" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Kelet</button>
        <button onClick={() => setSelectedTool('<')} className={selectedTool === '<' ? styles.selectedTool : ''}><MapTileIcon cell="<" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Nyugat</button>
        <button onClick={() => setSelectedTool('^')} className={selectedTool === '^' ? styles.selectedTool : ''}><MapTileIcon cell="^" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Észak</button>
        <button onClick={() => setSelectedTool('v')} className={selectedTool === 'v' ? styles.selectedTool : ''}><MapTileIcon cell="v" className={`${styles.cellIcon} ${styles.toolIcon}`} /> Dél</button>
      </div>

      <div ref={gridViewportRef} className={styles.gridViewport}>
        <div className={styles.gridBoard}>
          {grid.map((row, rIndex) => (
            <div key={rIndex} className={styles.gridRow}>
              {row.map((cell, cIndex) => (
                <div
                  key={cIndex}
                  onClick={() => handleCellClick(rIndex, cIndex)}
                  className={`${styles.gridCell} ${(rIndex + cIndex) % 2 === 0 ? styles.lightCell : styles.darkCell} ${cell === '#' ? styles.wallCell : ''}`}
                  style={{ width: cellSize, minWidth: cellSize, height: cellSize }}
                >
                  {cell !== '.' && <MapTileIcon cell={cell} className={styles.cellIcon} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.operations}>
        <button onClick={() => handleSaveMap()} disabled={loading} className={`${styles.operationButton} ${styles.saveButton}`}>
          {loading ? 'Mentés...' : editingMapId ? 'Pálya frissítése' : 'Mentés Szerverre'}
        </button>
        {editingMapId && (
          <button
            type="button"
            onClick={() => handleSaveMap(true)}
            disabled={loading}
            className={`${styles.operationButton} ${styles.saveButton}`}
          >
            Mentés új néven
          </button>
        )}
        <button onClick={handleExportFile} className={`${styles.operationButton} ${styles.exportButton}`}>
          Exportálás Fájlba
        </button>
        <label className={`${styles.operationButton} ${styles.importButton}`}>
          Importálás Fájlból
          <input type="file" accept=".txt" onChange={handleImportFile} className={styles.hiddenInput} />
        </label>
        <button
          type="button"
          onClick={handleShowDatabaseMaps}
          disabled={databaseLoading}
          className={`${styles.operationButton} ${styles.databaseButton}`}
        >
          {databaseLoading ? 'Pályák betöltése...' : databaseMapsVisible ? 'Lista bezárása' : 'Betöltés adatbázisból'}
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