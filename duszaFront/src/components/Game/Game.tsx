import React, { useRef, useState } from 'react';
import type { SelectableMap } from '../Map/MapSelectionPage';
import MapGridPreview from '../Map/MapGridPreview';
import { validateMineScript, type MineScriptDiagnostic } from './mineScriptValidator';
import styles from './Game.module.css';

interface GameProps {
	map: SelectableMap;
	onBack: () => void;
}

const renderScriptHighlight = (code: string, diagnostics: MineScriptDiagnostic[]) => {
	let lineStart = 0;
	return code.split('\n').map((line, lineIndex) => {
		const lineEnd = lineStart + line.length;
		const lineDiagnostics = diagnostics.filter(diagnostic => diagnostic.line === lineIndex + 1);
		const ranges = lineDiagnostics
			.filter(diagnostic => diagnostic.start < lineEnd && diagnostic.end > lineStart)
			.map(diagnostic => ({
				start: Math.max(0, diagnostic.start - lineStart),
				end: Math.min(line.length, diagnostic.end - lineStart),
			}));
		lineStart = lineEnd + 1;

		if (!line.length) {
			return (
				<span key={lineIndex} className={lineDiagnostics.length ? styles.invalidCodeLine : undefined}>
					{lineDiagnostics.length ? <span className={styles.invalidCode}>{'\u00a0'}</span> : '\u00a0'}
				</span>
			);
		}

		const mergedRanges = ranges.sort((left, right) => left.start - right.start).reduce<Array<{ start: number; end: number }>>((merged, range) => {
			const previous = merged[merged.length - 1];
			if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
			else merged.push({ ...range });
			return merged;
		}, []);
		const segments: React.ReactNode[] = [];
		let cursor = 0;
		mergedRanges.forEach((range, rangeIndex) => {
			if (range.start > cursor) segments.push(line.slice(cursor, range.start));
			segments.push(<span key={rangeIndex} className={styles.invalidCode}>{line.slice(range.start, range.end)}</span>);
			cursor = range.end;
		});
		if (cursor < line.length) segments.push(line.slice(cursor));

		return (
			<span key={lineIndex} className={lineDiagnostics.length ? styles.invalidCodeLine : undefined}>
				{segments}
			</span>
		);
	});
};

const Game: React.FC<GameProps> = ({ map, onBack }) => {
	const [scripts, setScripts] = useState([{ id: 1, name: 'Script 1', code: '' }]);
	const [activeScriptId, setActiveScriptId] = useState<number | null>(null);
	const [isRenamingScript, setIsRenamingScript] = useState(false);
	const [scriptNameDraft, setScriptNameDraft] = useState('');
	const scriptEditorRef = useRef<HTMLTextAreaElement>(null);
	const scriptHighlightRef = useRef<HTMLPreElement>(null);
	const activeScript = scripts.find(script => script.id === activeScriptId);
	const diagnostics = activeScript ? validateMineScript(activeScript.code) : [];

	const addScript = () => {
		const id = Math.max(...scripts.map(script => script.id)) + 1;
		setScripts(current => [...current, { id, name: `Script ${id}`, code: '' }]);
		setActiveScriptId(null);
		setIsRenamingScript(false);
	};

	const updateScriptName = (id: number, name: string) => {
		setScripts(current => current.map(script =>
			script.id === id ? { ...script, name } : script
		));
	};

	const saveScriptName = () => {
		if (!activeScript) return;
		updateScriptName(activeScript.id, scriptNameDraft.trim() || `Script ${activeScript.id}`);
		setIsRenamingScript(false);
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
								{isRenamingScript ? (
									<form
										className={styles.scriptNameForm}
										onSubmit={event => {
											event.preventDefault();
											saveScriptName();
										}}
									>
										<label htmlFor="script-name-edit">Script neve</label>
										<input
											id="script-name-edit"
											className={styles.scriptNameInput}
											value={scriptNameDraft}
											maxLength={40}
											autoFocus
											onChange={event => setScriptNameDraft(event.target.value)}
										/>
										<button type="submit" className={styles.saveNameButton}>Név mentése</button>
										<button type="button" onClick={() => setIsRenamingScript(false)} className={styles.backToScriptsButton}>
											Mégse
										</button>
									</form>
								) : (
									<strong className={styles.activeScriptName}>{activeScript.name}</strong>
								)}
								<div className={styles.editorActions}>
									<button type="button" onClick={() => { setActiveScriptId(null); setIsRenamingScript(false); }} className={styles.backToScriptsButton}>
										← Vissza a scriptekhez
									</button>
									{!isRenamingScript && (
										<button
											type="button"
											onClick={() => { setScriptNameDraft(activeScript.name); setIsRenamingScript(true); }}
											className={styles.backToScriptsButton}
										>
											Név módosítása
										</button>
									)}
									{scripts.length > 1 && (
										<button type="button" onClick={removeActiveScript} className={styles.removeButton}>
											Script törlése
										</button>
									)}
								</div>
							</div>
							<div className={styles.scriptEditorFrame}>
								<pre ref={scriptHighlightRef} className={styles.scriptHighlight} aria-hidden="true">
									{renderScriptHighlight(activeScript.code, diagnostics)}
								</pre>
								<textarea
									ref={scriptEditorRef}
									id="script-editor"
									className={styles.scriptEditor}
									value={activeScript.code}
									onChange={event => updateActiveScript(event.target.value)}
									onScroll={event => {
										if (scriptHighlightRef.current) {
											scriptHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
											scriptHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
										}
									}}
									spellCheck={false}
									aria-label={`${activeScript.name} kódja`}
									aria-invalid={diagnostics.length > 0}
									aria-describedby="script-validation"
									placeholder={'Írd ide a robot utasításait...\nPéldául: step 1'}
									wrap="off"
								/>
							</div>
							<div id="script-validation" className={diagnostics.length ? styles.scriptDiagnostics : styles.scriptValid} role="status" aria-live="polite">
								{diagnostics.length ? (
									<>
										<strong>{diagnostics.length} hiba</strong>
										<span>{diagnostics[0].line}. sor: {diagnostics[0].message}</span>
									</>
								) : 'A script megfelel az ellenőrzött szabályoknak.'}
							</div>
						</div>
					) : (
						<div className={styles.scriptList} aria-label="Script kiválasztása">
							{scripts.map(script => (
								<article key={script.id} className={styles.scriptCard}>
									<strong className={styles.scriptCardName}>{script.name}</strong>
									<button
										type="button"
										onClick={() => setActiveScriptId(script.id)}
										className={styles.scriptCardOpen}
									>
										<span className={styles.scriptSummary}>
											{script.code.trim() || 'Üres script'}
										</span>
										<span className={styles.scriptCardHint}>Kattints a szerkesztéshez</span>
									</button>
								</article>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
};

export default Game;
