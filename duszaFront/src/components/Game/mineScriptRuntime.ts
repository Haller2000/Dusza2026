import type { SelectableMap } from '../Map/MapSelectionPage';

type RobotTile = '^' | '<' | 'v' | '>';
type Value = { type: 'int'; value: number } | { type: 'bool'; value: boolean };

interface ScriptLine {
  indent: number;
  line: number;
  tokens: string[];
}

type Command =
  | { kind: 'set'; line: number; name: string; expression: string[] }
  | { kind: 'print' | 'step' | 'turn'; line: number; value: string }
  | { kind: 'mine'; line: number }
  | { kind: 'if' | 'while'; line: number; condition: string[]; body: Command[]; elseBody: Command[]; elseLine?: number };

export interface RuntimeFrame {
  mapGrid: string[][];
  robotX: number;
  robotY: number;
  facing: RobotTile;
  explored: string[];
  goldCollected: number;
  instructionCount: number;
  currentLine: number;
  consoleOutput: string[];
}

export class MineScriptRuntimeError extends Error {
  public readonly code: string;
  public readonly line: number;

  constructor(
    code: string,
    line: number,
    message: string,
  ) {
    super(message);
    this.name = 'MineScriptRuntimeError';
    this.code = code;
    this.line = line;
  }
}

const directions: RobotTile[] = ['^', '<', 'v', '>'];
const directionOffsets: Record<RobotTile, [number, number]> = {
  '^': [0, -1],
  '<': [-1, 0],
  'v': [0, 1],
  '>': [1, 0],
};

const toScriptLines = (source: string): ScriptLine[] => source
  .split(/\r?\n/)
  .flatMap((rawLine, index) => {
    if (!rawLine.length) return [];
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    return [{ indent, line: index + 1, tokens: rawLine.slice(indent).split(' ') }];
  });

const parseBlock = (lines: ScriptLine[], start: number, indent: number): [Command[], number] => {
  const commands: Command[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new MineScriptRuntimeError('E_SYNTAX', line.line, 'Hibás behúzás a blokkban.');
    }

    const [keyword, ...args] = line.tokens;
    if (keyword === 'else') break;

    if (keyword === 'if' || keyword === 'while') {
      index += 1;
      let body: Command[] = [];
      if (lines[index] && lines[index].indent > line.indent) {
        [body, index] = parseBlock(lines, index, lines[index].indent);
      }

      let elseBody: Command[] = [];
      let elseLine: number | undefined;
      if (keyword === 'if' && lines[index]?.indent === line.indent && lines[index].tokens[0] === 'else') {
        elseLine = lines[index].line;
        index += 1;
        if (lines[index] && lines[index].indent > line.indent) {
          [elseBody, index] = parseBlock(lines, index, lines[index].indent);
        }
      }

      commands.push({ kind: keyword, line: line.line, condition: args, body, elseBody, elseLine });
      continue;
    }

    if (keyword === 'else') {
      throw new MineScriptRuntimeError('E_SYNTAX', line.line, 'Az else nem kapcsolódik if utasításhoz.');
    }
    if (keyword === 'set') {
      commands.push({ kind: 'set', line: line.line, name: args[0], expression: args.slice(2) });
    } else if (keyword === 'print') {
      commands.push({ kind: 'print', line: line.line, value: args[0] });
    } else if (keyword === 'step') {
      commands.push({ kind: 'step', line: line.line, value: args[1] });
    } else if (keyword === 'turn') {
      commands.push({ kind: 'turn', line: line.line, value: args[1] });
    } else if (keyword === 'mine') {
      commands.push({ kind: 'mine', line: line.line });
    } else {
      throw new MineScriptRuntimeError('E_SYNTAX', line.line, `Ismeretlen utasítás: ${keyword}`);
    }
    index += 1;
  }

  return [commands, index];
};

const formatValue = (value: Value): string => value.type === 'bool' ? String(value.value) : String(value.value);

export const createInitialRuntimeFrame = (map: SelectableMap): RuntimeFrame => {
  const mapGrid = map.map_data.trim().split(/\r?\n/).map(row => [...row]);
  let robotX = -1;
  let robotY = -1;
  let facing: RobotTile = '>';

  mapGrid.forEach((row, y) => row.forEach((cell, x) => {
    if (directions.includes(cell as RobotTile)) {
      robotX = x;
      robotY = y;
      facing = cell as RobotTile;
      row[x] = '.';
    }
  }));

  if (robotX < 0 || robotY < 0) {
    throw new MineScriptRuntimeError('E_BAD_MAP', 0, 'A pályán nem található robot.');
  }

  return {
    mapGrid,
    robotX,
    robotY,
    facing,
    explored: [`${robotX},${robotY}`],
    goldCollected: 0,
    instructionCount: 0,
    currentLine: 0,
    consoleOutput: [],
  };
};

export function* executeMineScript(source: string, map: SelectableMap): Generator<RuntimeFrame> {
  const lines = toScriptLines(source);
  const [commands] = parseBlock(lines, 0, 0);
  const initialFrame = createInitialRuntimeFrame(map);
  const state = {
    ...initialFrame,
    explored: new Set(initialFrame.explored),
    variables: new Map<string, Value>(),
  };

  const snapshot = (): RuntimeFrame => ({
    mapGrid: state.mapGrid.map(row => [...row]),
    robotX: state.robotX,
    robotY: state.robotY,
    facing: state.facing,
    explored: [...state.explored],
    goldCollected: state.goldCollected,
    instructionCount: state.instructionCount,
    currentLine: state.currentLine,
    consoleOutput: [...state.consoleOutput],
  });

  const tick = (line: number) => {
    if (state.instructionCount >= 1000) {
      throw new MineScriptRuntimeError('INSTRUCTION_COUNT_LIMIT_EXCEEDED', line, 'A program túllépte az 1000 feldolgozott soros limitet.');
    }
    state.instructionCount += 1;
    state.currentLine = line;
  };

  const fail = (code: string, line: number, message: string): never => {
    throw new MineScriptRuntimeError(code, line, message);
  };

  const readSimple = (token: string, line: number): Value => {
    if (/^\d+$/.test(token)) {
      const value = Number(token);
      if (value > 100) fail('E_BAD_ARG', line, 'A számérték csak 0 és 100 közötti lehet.');
      return { type: 'int', value };
    }
    if (token === 'true' || token === 'false') return { type: 'bool', value: token === 'true' };
    const value = state.variables.get(token);
    if (!value) return fail('E_UNINITIALIZED', line, `A(z) ${token} változó még nincs inicializálva.`);
    return value;
  };

  const asInt = (value: Value, line: number, message: string): number => {
    if (value.type !== 'int') return fail('E_BAD_OPERAND', line, message);
    return value.value;
  };

  const asBool = (value: Value, line: number, message: string, code = 'E_BAD_OPERAND'): boolean => {
    if (value.type !== 'bool') return fail(code, line, message);
    return value.value;
  };

  const evaluateExpression = (tokens: string[], line: number): Value => {
    if (tokens.length === 1) return readSimple(tokens[0], line);
    if (tokens.length === 2 && tokens[0] === 'not') {
      const value = readSimple(tokens[1], line);
      if (value.type !== 'bool') fail('E_BAD_OPERAND', line, 'A not operandusának logikai értéknek kell lennie.');
      return { type: 'bool', value: !value.value };
    }
    if (tokens.length === 2 && tokens[0] === 'isThere') {
      const value = readSimple(tokens[1], line);
      if (value.type !== 'int' || value.value < 0 || value.value > 2) {
        fail('E_BAD_ARG', line, 'Az isThere paramétere csak 0, 1 vagy 2 egész szám lehet.');
      }
      const [dx, dy] = directionOffsets[state.facing];
      const x = state.robotX + dx;
      const y = state.robotY + dy;
      const target = state.mapGrid[y]?.[x];
      if (target !== undefined) state.explored.add(`${x},${y}`);
      return {
        type: 'bool',
        value: value.value === 0 ? target === '.' : value.value === 1 ? target === undefined || target === '#' : target === '@',
      };
    }
    if (tokens.length !== 3) fail('E_SYNTAX', line, 'Érvénytelen kifejezés.');

    const left = readSimple(tokens[0], line);
    const operator = tokens[1];
    const right = readSimple(tokens[2], line);
    const numericOperators = ['+', '-', '*', '<', '<=', '>', '>='];
    const booleanOperators = ['and', 'or'];

    if (numericOperators.includes(operator)) {
      const leftNumber = asInt(left, line, `A ${operator} művelet egész operandusokat igényel.`);
      const rightNumber = asInt(right, line, `A ${operator} művelet egész operandusokat igényel.`);
      if (operator === '+') return { type: 'int', value: leftNumber + rightNumber };
      if (operator === '-') return { type: 'int', value: leftNumber - rightNumber };
      if (operator === '*') return { type: 'int', value: leftNumber * rightNumber };
      if (operator === '<') return { type: 'bool', value: leftNumber < rightNumber };
      if (operator === '<=') return { type: 'bool', value: leftNumber <= rightNumber };
      if (operator === '>') return { type: 'bool', value: leftNumber > rightNumber };
      return { type: 'bool', value: leftNumber >= rightNumber };
    }

    if (booleanOperators.includes(operator)) {
      const leftBoolean = asBool(left, line, `A ${operator} művelet logikai operandusokat igényel.`);
      const rightBoolean = asBool(right, line, `A ${operator} művelet logikai operandusokat igényel.`);
      return { type: 'bool', value: operator === 'and' ? leftBoolean && rightBoolean : leftBoolean || rightBoolean };
    }

    if (operator === '=' || operator === '==') {
      if (left.type !== right.type) fail('E_BAD_OPERAND', line, 'Az egyenlőségvizsgálat operandusainak azonos típusúnak kell lenniük.');
      return { type: 'bool', value: left.value === right.value };
    }
    if (operator === '<>' || operator === '!=') {
      if (left.type !== right.type) fail('E_BAD_OPERAND', line, 'Az egyenlőségvizsgálat operandusainak azonos típusúnak kell lenniük.');
      return { type: 'bool', value: left.value !== right.value };
    }

    return fail('E_SYNTAX', line, `Ismeretlen operátor: ${operator}`);
  };

  const executeBlock = function* (block: Command[]): Generator<RuntimeFrame> {
    for (const command of block) {
      if (command.kind === 'set') {
        tick(command.line);
        const value = evaluateExpression(command.expression, command.line);
        const previous = state.variables.get(command.name);
        if (previous && previous.type !== value.type) {
          fail('E_TYPE_MISMATCH', command.line, `A(z) ${command.name} változó típusa nem változtatható meg.`);
        }
        state.variables.set(command.name, value);
        yield snapshot();
      } else if (command.kind === 'print') {
        tick(command.line);
        state.consoleOutput.push(formatValue(readSimple(command.value, command.line)));
        yield snapshot();
      } else if (command.kind === 'if') {
        tick(command.line);
        const condition = evaluateExpression(command.condition, command.line);
        const conditionValue = asBool(condition, command.line, 'Az if feltételének logikai értéknek kell lennie.', 'E_NON_BOOL_CONDITION');
        yield snapshot();
        if (conditionValue) {
          yield* executeBlock(command.body);
        } else if (command.elseLine !== undefined) {
          tick(command.elseLine);
          yield snapshot();
          yield* executeBlock(command.elseBody);
        }
      } else if (command.kind === 'while') {
        while (true) {
          tick(command.line);
          const condition = evaluateExpression(command.condition, command.line);
          const conditionValue = asBool(condition, command.line, 'A while feltételének logikai értéknek kell lennie.', 'E_NON_BOOL_CONDITION');
          yield snapshot();
          if (!conditionValue) break;
          yield* executeBlock(command.body);
        }
      } else if (command.kind === 'step') {
        tick(command.line);
        const distance = readSimple(command.value, command.line);
        const distanceValue = asInt(distance, command.line, 'A step paraméterének egész számnak kell lennie.');
        if (distanceValue < 0) fail('E_BAD_ARG', command.line, 'A step paramétere nem lehet negatív.');
        if (distanceValue === 0) yield snapshot();
        const [dx, dy] = directionOffsets[state.facing];
        for (let step = 0; step < distanceValue; step += 1) {
          const x = state.robotX + dx;
          const y = state.robotY + dy;
          const target = state.mapGrid[y]?.[x];
          if (target === undefined || target === '#') {
            fail('E_BEDROCK_HIT', command.line, 'A robot falnak ütközne vagy lelépne a térképről.');
          }
          state.robotX = x;
          state.robotY = y;
          state.explored.add(`${x},${y}`);
          yield snapshot();
        }
      } else if (command.kind === 'turn') {
        tick(command.line);
        const amount = readSimple(command.value, command.line);
        const amountValue = asInt(amount, command.line, 'A turn paraméterének egész számnak kell lennie.');
        if (amountValue < 0) fail('E_BAD_ARG', command.line, 'A turn paramétere nem lehet negatív.');
        state.facing = directions[(directions.indexOf(state.facing) + amountValue % directions.length) % directions.length];
        yield snapshot();
      } else if (command.kind === 'mine') {
        tick(command.line);
        if (state.mapGrid[state.robotY][state.robotX] !== '@') {
          fail('E_NO_GOLD', command.line, 'Ezen a mezőn nincs kibányászható arany.');
        }
        state.mapGrid[state.robotY][state.robotX] = '.';
        state.goldCollected += 1;
        yield snapshot();
      }
    }
  };

  yield* executeBlock(commands);
}