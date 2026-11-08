import React from 'react';
import type { SelectableMap } from '../Map/MapSelectionPage';
import MapGridPreview from '../Map/MapGridPreview';
import styles from './Game.module.css';

interface GameProps {
	map: SelectableMap;
	onBack: () => void;
}

const Game: React.FC<GameProps> = ({ map, onBack }) => (
	<main className={styles.gamePage}>
		<button type="button" onClick={onBack} className={styles.backButton}>
			← Vissza a pályaválasztóhoz
		</button>
		<header className={styles.gameHeader}>
			<span className={styles.gameEyebrow}>JÁTÉK</span>
			<h1>{map.name}</h1>
			<p>{map.width} × {map.height}</p>
		</header>
		<section className={styles.board} aria-label={`${map.name} pálya`}>
			<MapGridPreview mapData={map.map_data} width={map.width} height={map.height} className={styles.mapGrid} />
		</section>
	</main>
);

export default Game;
