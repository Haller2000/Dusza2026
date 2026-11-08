import React, { useEffect, useRef, useState } from 'react';
import type { SelectableMap } from '../Map/MapSelectionPage';
import MapTileIcon, { type MapTile } from '../Map/MapTileIcon';
import { validateMineScript, type MineScriptDiagnostic } from './mineScriptValidator';
import {
	createInitialRuntimeFrame,
	executeMineScript,
	MineScriptRuntimeError,
	type RuntimeFrame,
} from './mineScriptRuntime';
import styles from './Game.module.css';

interface GameProps {
	map: SelectableMap;
	onBack: () => void;
}

const renderFoggedMap = (map: SelectableMap, frame: RuntimeFrame) => {
	const direction: Record<RobotDirection, [number, number]> = {
		'>': [1, 0],
		'<': [-1, 0],
		'^': [0, -1],
		'v': [0, 1],
	};
	const [dx, dy] = direction[frame.facing];
	const frontX = frame.robotX + dx;
	const frontY = frame.robotY + dy;
	const frontInBounds = frontY >= 0 && frontY < frame.mapGrid.length && frontX >= 0 && frontX < (frame.mapGrid[frontY]?.length ?? 0);
	const explored = new Set(frame.explored);

	return (
		<div
			className={styles.fogGrid}
			style={{ gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))` }}
			role="img"
			aria-label={`${map.name}: a robot és az előtte lévő mező látható`}
		>
			{Array.from({ length: map.height }, (_, y) =>
				Array.from({ length: map.width }, (_, x) => {
					const isRobot = frame.robotX === x && frame.robotY === y;
					const isFront = frontInBounds && frontX === x && frontY === y;
					const isExplored = explored.has(`${x},${y}`);
					const tile = isRobot ? frame.facing : isFront || isExplored ? frame.mapGrid[y]?.[x] ?? '.' : '.';
					const className = [
						styles.fogTile,
						isRobot ? styles.robotTile : '',
						isFront ? styles.litTile : '',
						!isRobot && !isFront && !isExplored ? styles.hiddenTile : '',
					].filter(Boolean).join(' ');

					return (
						<span key={`${x}-${y}`} className={className}>
							<MapTileIcon cell={tile as MapTile} className={styles.fogTileIcon} />
						</span>
					);
				})
			)}
		</div>
	);
};

type RobotDirection = RuntimeFrame['facing'];

interface GameScript {
	id: number;
	name: string;
	code: string;
}

const emptyScript: GameScript = { id: 1, name: 'Script 1', code: '' };

const getScriptsStorageKey = (map: SelectableMap) => {
	const username = localStorage.getItem('username') || 'guest';
	return `dusza2026:scripts:${encodeURIComponent(username)}:${map.id}`;
};

const loadScripts = (storageKey: string): GameScript[] => {
	try {
		const storedScripts: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
		if (
			Array.isArray(storedScripts) &&
			storedScripts.length > 0 &&
			storedScripts.every(script =>
				script &&
				typeof script.id === 'number' &&
				typeof script.name === 'string' &&
				typeof script.code === 'string'
			)
		) {
			return storedScripts;
		}
	} catch {
		return [emptyScript];
	}
	return [emptyScript];
};

const renderScriptHighlight = (code: string, diagnostics: MineScriptDiagnostic[], currentLine: number) => {
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
				<span key={lineIndex} className={`${lineDiagnostics.length ? styles.invalidCodeLine : ''} ${currentLine === lineIndex + 1 ? styles.runningCodeLine : ''}`}>
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
			<span key={lineIndex} className={`${lineDiagnostics.length ? styles.invalidCodeLine : ''} ${currentLine === lineIndex + 1 ? styles.runningCodeLine : ''}`}>
				{segments}
			</span>
		);
	});
};

const Game: React.FC<GameProps> = ({ map, onBack }) => {
	const storageKey = getScriptsStorageKey(map);
	const [scripts, setScripts] = useState<GameScript[]>(() => loadScripts(storageKey));
	const [saveStatus, setSaveStatus] = useState('Automatikus mentés');
	const [activeScriptId, setActiveScriptId] = useState<number | null>(null);
	const [isRenamingScript, setIsRenamingScript] = useState(false);
	const [scriptNameDraft, setScriptNameDraft] = useState('');
	const [runtimeFrame, setRuntimeFrame] = useState<RuntimeFrame>(() => createInitialRuntimeFrame(map));
	const [isRunning, setIsRunning] = useState(false);
	const [runtimeError, setRuntimeError] = useState<MineScriptRuntimeError | null>(null);
	const scriptEditorRef = useRef<HTMLTextAreaElement>(null);
	const scriptHighlightRef = useRef<HTMLPreElement>(null);
	const timerRef = useRef<number | null>(null);
	const executionRef = useRef<Generator<RuntimeFrame> | null>(null);
	const activeScript = scripts.find(script => script.id === activeScriptId);
	const diagnostics = activeScript ? validateMineScript(activeScript.code) : [];

	const saveScripts = (nextScripts: GameScript[]) => {
		setScripts(nextScripts);
		try {
			localStorage.setItem(storageKey, JSON.stringify(nextScripts));
			setSaveStatus('Automatikusan mentve');
		} catch {
			setSaveStatus('Nem sikerült menteni');
		}
	};

	useEffect(() => () => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		executionRef.current?.return(undefined);
	}, []);

	const addScript = () => {
		const id = Math.max(...scripts.map(script => script.id)) + 1;
		saveScripts([...scripts, { id, name: `Script ${id}`, code: '' }]);
		setActiveScriptId(null);
		setIsRenamingScript(false);
	};

	const updateScriptName = (id: number, name: string) => {
		saveScripts(scripts.map(script =>
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
		saveScripts(remainingScripts);
		setActiveScriptId(remainingScripts[0].id);
	};

	const updateActiveScript = (code: string) => {
		saveScripts(scripts.map(script =>
			script.id === activeScriptId ? { ...script, code } : script
		));
	};

	const stopExecution = () => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = null;
		executionRef.current?.return(undefined);
		executionRef.current = null;
		setIsRunning(false);
	};

	const resetExecution = () => {
		stopExecution();
		setRuntimeFrame(createInitialRuntimeFrame(map));
		setRuntimeError(null);
	};

	const startExecution = () => {
		if (!activeScript || diagnostics.length || isRunning) return;
		stopExecution();
		setRuntimeFrame(createInitialRuntimeFrame(map));
		setRuntimeError(null);
		setIsRunning(true);

		const execution = executeMineScript(activeScript.code, map);
		executionRef.current = execution;
		const advance = () => {
			try {
				const result = execution.next();
				if (result.done) {
					executionRef.current = null;
					setIsRunning(false);
					return;
				}
				setRuntimeFrame(result.value);
				timerRef.current = window.setTimeout(advance, 350);
			} catch (error) {
				executionRef.current = null;
				setIsRunning(false);
				setRuntimeError(error instanceof MineScriptRuntimeError
					? error
					: new MineScriptRuntimeError('E_RUNTIME', runtimeFrame.currentLine, 'Váratlan futásidejű hiba történt.'));
			}
		};
		advance();
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
						{renderFoggedMap(map, runtimeFrame)}
					</div>
					<div className={styles.runtimeStats}>
						<div><span>Arany</span><strong>{runtimeFrame.goldCollected}</strong></div>
						<div><span>Utasítás</span><strong>{runtimeFrame.instructionCount} / 1000</strong></div>
						<div><span>Robot</span><strong>{runtimeFrame.robotX + 1}, {runtimeFrame.robotY + 1}</strong></div>
						<div><span>Irány</span><strong>{runtimeFrame.facing}</strong></div>
					</div>
					{runtimeError && (
						<div className={styles.runtimeError} role="alert">
							<strong>{runtimeError.code}</strong>
							<span>{runtimeError.line > 0 ? `${runtimeError.line}. sor: ` : ''}{runtimeError.message}</span>
						</div>
					)}
					<div className={styles.runtimeConsole} aria-live="polite">
						<strong>Konzol</strong>
						<div className={styles.consoleOutput}>
							{runtimeFrame.consoleOutput.length ? runtimeFrame.consoleOutput.map((output, index) => (
								<div key={`${index}-${output}`}>{output}</div>
							)) : <span className={styles.emptyConsole}>Nincs kimenet</span>}
						</div>
					</div>
				</section>
				<section className={styles.scriptsPanel} aria-label="Scriptek">
					<div className={styles.panelHeading}>
						<div className={styles.scriptsHeading}>
							<h2>Scriptek</h2>
							<span className={saveStatus === 'Nem sikerült menteni' ? styles.saveError : styles.saveStatus} role="status">{saveStatus}</span>
						</div>
						<button type="button" onClick={addScript} className={styles.addButton} title="Új script">
							<span aria-hidden="true">+</span> Új
						</button>
					</div>
					<div className={styles.runtimeToolbar}>
						<span>{activeScript ? `Futtatás: ${activeScript.name}` : 'Nyiss meg egy scriptet a futtatáshoz.'}</span>
						<div className={styles.runtimeActions}>
							<button type="button" onClick={startExecution} disabled={!activeScript || diagnostics.length > 0 || isRunning} className={styles.runButton}>
								Futtatás
							</button>
							<button type="button" onClick={stopExecution} disabled={!isRunning} className={styles.controlButton}>
								Leállítás
							</button>
							<button type="button" onClick={resetExecution} className={styles.controlButton}>
								Alaphelyzet
							</button>
						</div>
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
									{renderScriptHighlight(activeScript.code, diagnostics, runtimeFrame.currentLine)}
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
