import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { SelectableMap } from '../Map/MapSelectionPage';
import MapTileIcon, { type MapTile } from '../Map/MapTileIcon';
import { validateMineScript, type MineScriptDiagnostic } from './mineScriptValidator';
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

const renderFoggedMap = (map: SelectableMap) => {
	const rows = map.map_data.trim().split(/\r?\n/).map(row => [...row]);
	const robot = rows.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y })))
		.find(({ cell }) => ['>', '<', '^', 'v'].includes(cell));
	const direction = robot ? {
		'>': [1, 0],
		'<': [-1, 0],
		'^': [0, -1],
		'v': [0, 1],
	}[robot.cell] : undefined;
	const frontX = robot && direction ? robot.x + direction[0] : -1;
	const frontY = robot && direction ? robot.y + direction[1] : -1;
	const frontInBounds = frontY >= 0 && frontY < rows.length && frontX >= 0 && frontX < (rows[frontY]?.length ?? 0);

	return (
		<div
			className={styles.fogGrid}
			style={{ gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))` }}
			role="img"
			aria-label={`${map.name}: a robot és az előtte lévő mező látható`}
		>
			{Array.from({ length: map.height }, (_, y) =>
				Array.from({ length: map.width }, (_, x) => {
					const isRobot = robot?.x === x && robot.y === y;
					const isFront = frontInBounds && frontX === x && frontY === y;
					const tile = isRobot || isFront ? rows[y]?.[x] ?? '.' : '.';
					const className = [
						styles.fogTile,
						isRobot ? styles.robotTile : '',
						isFront ? styles.litTile : '',
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
	const scriptEditorRef = useRef<HTMLTextAreaElement>(null);
	const scriptHighlightRef = useRef<HTMLPreElement>(null);
	const activeScript = scripts.find(script => script.id === activeScriptId);
	const diagnostics = activeScript ? validateMineScript(activeScript.code) : [];

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
						{renderFoggedMap(map)}
					</div>
				</section>
				<section className={styles.scriptsPanel} aria-label="Scriptek">
					<div className={styles.panelHeading}>
						<h2>Scriptek</h2>
						<button type="button" onClick={addScript} className={styles.addButton} title="Új script" disabled={isLoadingScripts}>
							<span aria-hidden="true">+</span> Új
						</button>
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
