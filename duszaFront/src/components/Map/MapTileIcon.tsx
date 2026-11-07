import React from 'react';

export type MapTile = '.' | '#' | '@' | '>' | '<' | '^' | 'v';

interface MapTileIconProps {
  cell: MapTile;
  className?: string;
}

const MapTileIcon: React.FC<MapTileIconProps> = ({ cell, className }) => {
  if (cell === '.') {
    return (
      <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="7" fill="#e6ecd6" stroke="#b9c5a5" strokeWidth="2.5" />
      </svg>
    );
  }

  if (cell === '#') {
    return (
      <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="7" fill="#b98a5c" stroke="#8a5f3a" strokeWidth="2.5" />
        <path d="M5 17h38M5 31h38M18 5v12m12 0v14M16 31v12m17-12v12" stroke="#8a5f3a" strokeWidth="1.7" strokeLinecap="round" opacity=".7" />
      </svg>
    );
  }

  if (cell === '@') {
    return (
      <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="40" rx="11" ry="3" fill="#6b5a3a" opacity=".2" />
        <circle cx="24" cy="23" r="12" fill="#f4b83f" stroke="#a8721a" strokeWidth="2.5" />
        <circle cx="24" cy="23" r="6.5" fill="none" stroke="#a8721a" strokeWidth="1.6" opacity=".65" />
        <path d="M19 18a7 7 0 0 1 5-2" stroke="#fff8e0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  const rotation = cell === '^' ? -90 : cell === 'v' ? 90 : 0;
  const transform = cell === '<'
    ? 'translate(48 0) scale(-1 1)'
    : `rotate(${rotation} 24 24)`;

  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
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
};

export default MapTileIcon;
