import React, { useState } from 'react';
import type { SelectableMap } from '../Map/MapSelectionPage';
import MapGridPreview from '../Map/MapGridPreview';
import styles from './Game.module.css';

interface GameProps {
	map: SelectableMap;
	onBack: () => void;
}

const Game: React.FC<GameProps> = ({ map, onBack }) => {
	const [scripts, setScripts] = useState([{ id: 1, name: 'Script 1', code: '' }]);
	const [activeScriptId, setActiveScriptId] = useState<number | null>(null);
	const activeScript = scripts.find(script => script.id === activeScriptId);

	const addScript = () => {
		const id = Math.max(...scripts.map(script => script.id)) + 1;
		setScripts(current => [...current, { id, name: `Script ${id}`, code: '' }]);
		setActiveScriptId(id);
	};

	const removeActiveScript = () => {
		if (scripts.length < 2) return;
		const remainingScripts = scripts.filter(script => script.id !== activeScriptId);
		setScripts(remainingScripts);
		setActiveScriptId(remainingScripts[0].id);
	};

	const updateActiveScript = (code: string) => {
		setScripts(current => current.map(script =>
			script.id === activeScriptId ? { ...script, code } : script
		));
	};

	return (
		<main className={styles.gamePage}>
			<button type="button" onClick={onBack} className={styles.backButton}>
				← Vissza a pályaválasztóhoz
			</button>
			<header className={styles.gameHeader}>
				<span className={styles.gameEyebrow}>JÁTÉK</span>
				<h1>{map.name}</h1>
			</header>
			<div className={styles.workspace}>
				<section className={styles.mapPanel} aria-label="Kiválasztott pálya">
					<div className={styles.panelHeading}>
						<h2>Pálya</h2>
						<span>{map.width} × {map.height}</span>
					</div>
					<div className={styles.board}>
						<MapGridPreview mapData={map.map_data} width={map.width} height={map.height} className={styles.mapGrid} />
					</div>
				</section>
				<section className={styles.scriptsPanel} aria-label="Scriptek">
					<div className={styles.panelHeading}>
						<h2>Scriptek</h2>
						<button type="button" onClick={addScript} className={styles.addButton} title="Új script">
							<span aria-hidden="true">+</span> Új
						</button>
					</div>
					{activeScript ? (
						<div className={styles.scriptEditorPanel}>
							<div className={styles.editorToolbar}>
								<label htmlFor="script-editor">{activeScript.name}</label>
								<div className={styles.editorActions}>
									<button type="button" onClick={() => setActiveScriptId(null)} className={styles.backToScriptsButton}>
										← Vissza a scriptekhez
									</button>
									{scripts.length > 1 && (
										<button type="button" onClick={removeActiveScript} className={styles.removeButton}>
											Script törlése
										</button>
									)}
								</div>
							</div>
							<textarea
								id="script-editor"
								className={styles.scriptEditor}
								value={activeScript.code}
								onChange={event => updateActiveScript(event.target.value)}
								spellCheck={false}
								aria-label={`${activeScript.name} kódja`}
								placeholder={'Írd ide a robot utasításait...\nPéldául: step 1'}
							/>
						</div>
					) : (
						<div className={styles.scriptList} aria-label="Script kiválasztása">
							{scripts.map(script => (
								<button
									key={script.id}
									type="button"
									aria-pressed={false}
									onClick={() => setActiveScriptId(script.id)}
									className={styles.scriptCard}
								>
									<strong>{script.name}</strong>
									<span className={styles.scriptSummary}>
										{script.code.trim() || 'Üres script'}
									</span>
									<span className={styles.scriptCardHint}>Kattints a szerkesztéshez</span>
								</button>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
};

export default Game;
