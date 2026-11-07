import React from 'react';
import MapTileIcon, { type MapTile } from './MapTileIcon';
import styles from './MapGridPreview.module.css';

interface MapGridPreviewProps {
  mapData: string;
  width: number;
  height: number;
  className?: string;
}

const MapGridPreview: React.FC<MapGridPreviewProps> = ({ mapData, width, height, className }) => {
  const rows = mapData.trim().split(/\r?\n/);
  const isValidGrid = rows.length === height && rows.every(row =>
    row.length === width && [...row].every(cell => '.#@><^v'.includes(cell))
  );

  if (!isValidGrid) return null;

  return (
    <div
      className={`${styles.grid} ${className ?? ''}`}
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
      aria-label={`${width} oszlopos, ${height} soros pálya`}
    >
      {rows.flatMap((row, rowIndex) =>
        [...row].map((cell, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={styles.tile}
            style={{ backgroundColor: (rowIndex + columnIndex) % 2 === 0 ? '#e6ecd6' : '#dde7ca' }}
          >
            {cell !== '.' && <MapTileIcon cell={cell as MapTile} className={styles.tileIcon} />}
          </span>
        ))
      )}
    </div>
  );
};

export default MapGridPreview;
