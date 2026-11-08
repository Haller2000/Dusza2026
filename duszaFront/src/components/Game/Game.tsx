import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
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

interface StoredScript {
	id: number;
	name: string;
	code: string;
}

interface EditorScript extends StoredScript {
	savedId: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseImportedScripts = (file: File, text: string, firstId: number): EditorScript[] => {
	const baseName = file.name.replace(/\.(json|txt|ms|minescript)$/i, '').trim() || 'Importált script';
	let entries: unknown[];
	if (/\.json$/i.test(file.name)) {
		let payload: unknown;
		try {
			payload = JSON.parse(text);
		} catch {
			throw new Error('A JSON fájl formátuma érvénytelen.');
		}

		if (Array.isArray(payload)) {
			entries = payload;
		} else if (isRecord(payload) && Array.isArray(payload.scripts)) {
			entries = payload.scripts;
		} else if (isRecord(payload) && typeof payload.code === 'string') {
			entries = [payload];
		} else {
			throw new Error('A JSON fájlnak scriptet vagy scripts listát kell tartalmaznia.');
		}
	} else {
		if (!text.trim()) throw new Error('Az importált script üres.');
		return [{ id: firstId, savedId: null, name: baseName, code: text }];
	}

	if (!entries.length) throw new Error('A fájl nem tartalmaz importálható scripteket.');
	return entries.map((entry, index) => {
		if (!isRecord(entry) || typeof entry.code !== 'string') {
			throw new Error('Minden scriptnek szöveges code mezőt kell tartalmaznia.');
		}
		const name = typeof entry.name === 'string' && entry.name.trim()
			? entry.name.trim()
			: `${baseName} ${index + 1}`;
		return { id: firstId + index, savedId: null, name, code: entry.code };
	});
};

const downloadFile = (fileName: string, blob: Blob) => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
		for (const key of ['name', 'code', 'detail', 'non_field_errors']) {
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

const renderFoggedMap = (map: SelectableMap, frame: RuntimeFrame) => {
	const direction: Record<RuntimeFrame['facing'], [number, number]> = {
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
			aria-label={`${map.name}: a robot és a felfedezett mezők láthatók`}
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
						<span key={`${y}-${x}`} className={className}>
							<MapTileIcon cell={tile as MapTile} className={styles.fogTileIcon} />
						</span>
					);
				})
			)}
		</div>
	);
};

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
	const [scripts, setScripts] = useState<EditorScript[]>([
		{ id: 1, savedId: null, name: 'Script 1', code: '' },
	]);
	const [activeScriptId, setActiveScriptId] = useState<number | null>(null);
	const [isRenamingScript, setIsRenamingScript] = useState(false);
	const [scriptNameDraft, setScriptNameDraft] = useState('');
	const [isLoadingScripts, setIsLoadingScripts] = useState(
		() => Boolean(localStorage.getItem('authToken'))
	);
	const [isSavingScript, setIsSavingScript] = useState(false);
	const [isDeletingScript, setIsDeletingScript] = useState(false);
	const [scriptError, setScriptError] = useState(() =>
		localStorage.getItem('authToken') ? '' : 'A scriptek mentéséhez be kell jelentkezni.'
	);
	const [scriptStatus, setScriptStatus] = useState('');
	const [runtimeFrame, setRuntimeFrame] = useState<RuntimeFrame>(() => createInitialRuntimeFrame(map));
	const [runtimeError, setRuntimeError] = useState<MineScriptRuntimeError | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const importFileRef = useRef<HTMLInputElement>(null);
	const scriptEditorRef = useRef<HTMLTextAreaElement>(null);
	const scriptHighlightRef = useRef<HTMLPreElement>(null);
	const executionRef = useRef<Generator<RuntimeFrame> | null>(null);
	const executionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activeScript = scripts.find(script => script.id === activeScriptId);
	const diagnostics = activeScript ? validateMineScript(activeScript.code) : [];

	const cancelExecution = () => {
		if (executionTimerRef.current !== null) window.clearTimeout(executionTimerRef.current);
		executionTimerRef.current = null;
		executionRef.current?.return(undefined);
		executionRef.current = null;
	};

	useEffect(() => () => cancelExecution(), []);

	useEffect(() => {
		let isMounted = true;
		const token = localStorage.getItem('authToken');
		if (!token) {
			return () => {
				isMounted = false;
			};
		}

		axios.get<StoredScript[]>('/api/scripts/', {
			headers: { Authorization: `Token ${token}` },
		}).then(response => {
			if (isMounted && response.data.length > 0) {
				setScripts(response.data.map(script => ({ ...script, savedId: script.id })));
			}
		}).catch((error: unknown) => {
			if (isMounted) {
				const responseData = axios.isAxiosError(error) ? error.response?.data : null;
				setScriptError(
					getApiErrorMessage(responseData) || 'Nem sikerült betölteni a mentett scripteket.'
				);
			}
		}).finally(() => {
			if (isMounted) setIsLoadingScripts(false);
		});

		return () => {
			isMounted = false;
		};
	}, []);

	const addScript = () => {
		const id = Math.max(...scripts.map(script => script.id)) + 1;
		setScripts(current => [...current, { id, savedId: null, name: `Script ${id}`, code: '' }]);
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

	const removeActiveScript = async () => {
		if (!activeScript || scripts.length < 2) return;
		setScriptError('');
		setScriptStatus('');
		if (activeScript.savedId !== null) {
			const token = localStorage.getItem('authToken');
			if (!token) {
				setScriptError('A script törléséhez be kell jelentkezni.');
				return;
			}
			setIsDeletingScript(true);
			try {
				await axios.delete(`/api/scripts/${activeScript.savedId}/`, {
					headers: { Authorization: `Token ${token}` },
				});
			} catch (error: unknown) {
				const responseData = axios.isAxiosError(error) ? error.response?.data : null;
				setScriptError(
					getApiErrorMessage(responseData) || 'Nem sikerült törölni a scriptet.'
				);
				setIsDeletingScript(false);
				return;
			}
			setIsDeletingScript(false);
		}
		const remainingScripts = scripts.filter(script => script.id !== activeScriptId);
		setScripts(remainingScripts);
		setActiveScriptId(remainingScripts[0].id);
		setScriptStatus('A script törölve.');
	};

	const saveActiveScript = async () => {
		if (!activeScript) return;
		const token = localStorage.getItem('authToken');
		if (!token) {
			setScriptError('A script mentéséhez be kell jelentkezni.');
			return;
		}

		setIsSavingScript(true);
		setScriptError('');
		setScriptStatus('');
		try {
			const request = {
				name: activeScript.name,
				code: activeScript.code,
			};
			const config = { headers: { Authorization: `Token ${token}` } };
			const response = activeScript.savedId === null
				? await axios.post<StoredScript>('/api/scripts/', request, config)
				: await axios.patch<StoredScript>(
					`/api/scripts/${activeScript.savedId}/`,
					request,
					config,
				);
			setScripts(current => current.map(script =>
				script.id === activeScript.id
					? { ...response.data, savedId: response.data.id }
					: script
			));
			setScriptStatus('A script külön elmentve.');
		} catch (error: unknown) {
			const responseData = axios.isAxiosError(error) ? error.response?.data : null;
			setScriptError(
				getApiErrorMessage(responseData) || 'Nem sikerült elmenteni a scriptet.'
			);
		} finally {
			setIsSavingScript(false);
		}
	};

	const updateActiveScript = (code: string) => {
		setScriptError('');
		setScriptStatus('');
		setScripts(current => current.map(script =>
			script.id === activeScriptId ? { ...script, code } : script
		));
	};

	const startExecution = () => {
		if (!activeScript || diagnostics.length > 0) return;
		cancelExecution();
		setScriptError('');
		setScriptStatus('');
		setRuntimeError(null);
		setRuntimeFrame(createInitialRuntimeFrame(map));
		setIsRunning(true);
		executionRef.current = executeMineScript(activeScript.code, map);

		const advance = () => {
			const execution = executionRef.current;
			if (!execution) return;
			try {
				const result = execution.next();
				if (result.done) {
					cancelExecution();
					setIsRunning(false);
					setScriptStatus('A script futtatása befejeződött.');
					return;
				}
				setRuntimeFrame(result.value);
				executionTimerRef.current = window.setTimeout(advance, 350);
			} catch (error: unknown) {
				cancelExecution();
				setIsRunning(false);
				setRuntimeError(error instanceof MineScriptRuntimeError
					? error
					: new MineScriptRuntimeError('E_RUNTIME', 0, 'Váratlan futásidejű hiba történt.'));
			}
		};

		executionTimerRef.current = window.setTimeout(advance, 0);
	};

	const stopExecution = () => {
		if (!isRunning) return;
		cancelExecution();
		setIsRunning(false);
		setScriptStatus('A futtatás leállítva.');
	};

	const resetExecution = () => {
		cancelExecution();
		setIsRunning(false);
		setRuntimeError(null);
		setRuntimeFrame(createInitialRuntimeFrame(map));
		setScriptStatus('');
	};

	const importScripts = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		setScriptError('');
		setScriptStatus('');
		if (file.size > 1_000_000) {
			setScriptError('Az import fájl legfeljebb 1 MB lehet.');
			return;
		}

		try {
			const firstId = Math.max(0, ...scripts.map(script => script.id)) + 1;
			const importedScripts = parseImportedScripts(file, await file.text(), firstId);
			setScripts(current => [...current, ...importedScripts]);
			setActiveScriptId(importedScripts[0].id);
			setIsRenamingScript(false);
			setScriptStatus(importedScripts.length === 1
				? `A(z) „${importedScripts[0].name}” új scriptként importálva.`
				: `${importedScripts.length} új script importálva.`);
		} catch (error: unknown) {
			setScriptError(error instanceof Error ? error.message : 'Nem sikerült importálni a scripteket.');
		}
	};

	const exportScripts = () => {
		const bundle = {
			format: 'dusza-mine-scripts',
			version: 1,
			mapName: map.name,
			scripts: scripts.map(({ name, code }) => ({ name, code })),
		};
		downloadFile(
			'duszabot-scriptek.json',
			new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
		);
		setScriptStatus(`${scripts.length} script exportálva.`);
		setScriptError('');
	};

	const exportActiveScript = () => {
		if (!activeScript) return;
		const baseName = activeScript.name
			.replace(/\.txt$/i, '')
			.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
			.trim() || 'minescript';
		downloadFile(`${baseName}.txt`, new Blob([activeScript.code], { type: 'text/plain;charset=utf-8' }));
		setScriptStatus(`A(z) „${activeScript.name}” TXT fájlként exportálva.`);
		setScriptError('');
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
						<h2>Scriptek</h2>
						<div className={styles.scriptActions}>
							<input
								ref={importFileRef}
								type="file"
								accept=".json,.txt,.ms,.minescript,application/json,text/plain"
								hidden
								onChange={importScripts}
							/>
							<button type="button" onClick={() => importFileRef.current?.click()} className={styles.addButton} disabled={isLoadingScripts}>
								Importálás
							</button>
							<button type="button" onClick={exportActiveScript} className={styles.addButton} disabled={isLoadingScripts || !activeScript} title="Az aktív script mentése .txt fájlba">
								TXT mentése
							</button>
							<button type="button" onClick={exportScripts} className={styles.addButton} disabled={isLoadingScripts || scripts.length === 0}>
								Összes exportálása (JSON)
							</button>
							<button type="button" onClick={addScript} className={styles.addButton} title="Új script" disabled={isLoadingScripts}>
								<span aria-hidden="true">+</span> Új
							</button>
						</div>
					</div>
					<div className={styles.runtimeToolbar}>
						<span>{activeScript ? `Futtatás: ${activeScript.name}` : 'Válassz scriptet a futtatáshoz.'}</span>
						<div className={styles.runtimeActions}>
							<button type="button" onClick={startExecution} className={styles.runButton} disabled={!activeScript || diagnostics.length > 0 || isRunning || isLoadingScripts}>
								Futtatás
							</button>
							<button type="button" onClick={stopExecution} className={styles.controlButton} disabled={!isRunning}>
								Leállítás
							</button>
							<button type="button" onClick={resetExecution} className={styles.controlButton}>
								Alaphelyzet
							</button>
						</div>
					</div>
					{isLoadingScripts && <div className={styles.scriptFeedback}>Mentett scriptek betöltése...</div>}
					{scriptError && <div className={styles.scriptFeedbackError} role="alert">{scriptError}</div>}
					{scriptStatus && <div className={styles.scriptFeedback} role="status">{scriptStatus}</div>}
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
										<>
											<button type="button" onClick={saveActiveScript} className={styles.saveNameButton} disabled={isSavingScript || isDeletingScript}>
												{isSavingScript ? 'Mentés...' : activeScript.savedId === null ? 'Script mentése' : 'Script frissítése'}
											</button>
											<button
												type="button"
												onClick={() => { setScriptNameDraft(activeScript.name); setIsRenamingScript(true); }}
												className={styles.backToScriptsButton}
											>
												Név módosítása
											</button>
										</>
									)}
									{scripts.length > 1 && (
										<button type="button" onClick={removeActiveScript} className={styles.removeButton} disabled={isDeletingScript || isSavingScript}>
											{isDeletingScript ? 'Törlés...' : 'Script törlése'}
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
