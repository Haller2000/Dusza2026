import React from 'react';
import type { SelectableMap } from './MapSelectionPage';
import MapGridPreview from './MapGridPreview';
import styles from './MapSelectionPage.module.css';

interface MapCardProps {
  map: SelectableMap;
  selected?: boolean;
  onSelect?: (map: SelectableMap) => void;
  showPreview?: boolean;
}

const MapCard: React.FC<MapCardProps> = ({ map, selected = false, onSelect, showPreview = false }) => {
  const goldCount = [...map.map_data].filter(cell => cell === '@').length;
  const className = `${styles.mapCard} ${selected ? styles.selectedCard : ''}`;

  const content = (
    <>
      {showPreview && (
        <div className={styles.mapPreviewArea}>
          <MapGridPreview
            mapData={map.map_data}
            width={map.width}
            height={map.height}
            className={styles.mapPreview}
          />
        </div>
      )}
      <span className={styles.cardContent}>
        <strong className={styles.mapName}>{map.name}</strong>
        <span className={styles.badges}>
          <span className={styles.badge}>{map.width} × {map.height}</span>
          <span className={`${styles.badge} ${styles.goldBadge}`}>◆ {goldCount} arany</span>
          <span className={`${styles.badge} ${map.is_builtin ? styles.sharedBadge : styles.ownBadge}`}>
            {map.is_builtin ? 'Közös pálya' : 'Saját pálya'}
          </span>
        </span>
        {onSelect && (
          <span className={styles.cardHint}>
            {selected ? 'Kiválasztva' : 'Kattints a pálya kiválasztásához'}
          </span>
        )}
      </span>
    </>
  );

  if (!onSelect) {
    return <article className={className}>{content}</article>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(map)}
      className={className}
    >
      {content}
    </button>
  );
};

export default MapCard;
