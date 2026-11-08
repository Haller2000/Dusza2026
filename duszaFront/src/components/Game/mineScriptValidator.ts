export interface MineScriptDiagnostic {
  start: number;
  end: number;
  line: number;
  message: string;
}

interface Token {
  value: string;
  start: number;
  end: number;
}

interface SourceLine {
  indent: number;
  tokens: Token[];
  line: number;
  start: number;
  end: number;
}

type Expression =
  | { kind: 'simple'; value: Token }
  | { kind: 'not'; value: Token }
  | { kind: 'isThere'; value: Token }
  | { kind: 'binary'; left: Token; operator: Token; right: Token };

type Command =
  | { kind: 'set'; name: Token; expression: Expression; line: number }
  | { kind: 'print' | 'step' | 'turn'; value: Token; line: number }
  | { kind: 'mine'; line: number }
  | { kind: 'if' | 'while'; condition: Expression; body: Command[]; elseBody: Command[] | null; line: number };

type ValueType = 'int' | 'bool';

const binaryOperators = new Set(['+', '-', '*', '=', '==', '<>', '!=', '<', '<=', '>', '>=', 'and', 'or']);
const reservedWords = new Set([
  'and', 'by', 'else', 'false', 'forward', 'here', 'if', 'isthere', 'mine', 'not',
  'or', 'print', 'set', 'step', 'to', 'true', 'turn', 'while',
]);

export const validateMineScript = (source: string): MineScriptDiagnostic[] => {
  if (!source.length) return [];

  const diagnostics: MineScriptDiagnostic[] = [];
  const report = (token: Token, message: string) => {
    diagnostics.push({ start: token.start, end: token.end, line: 0, message });
  };

  const lines: SourceLine[] = [];
  const rawLines = source.split('\n');
  if (source.endsWith('\n')) rawLines.pop();
  let sourceOffset = 0;

  rawLines.forEach((sourceLine, index) => {
    const raw = sourceLine.replace(/\r$/, '');
    const lineNumber = index + 1;
    const lineStart = sourceOffset;
    sourceOffset += sourceLine.length + 1;

    if (!raw.trim()) {
      const markerStart = Math.max(lineStart, lineStart + raw.length - 1);
      diagnostics.push({
        start: markerStart,
        end: markerStart + (raw.length ? 1 : 0),
        line: lineNumber,
        message: 'Üres sor nem szerepelhet a programban.',
      });
      return;
    }

    const tabIndex = raw.indexOf('\t');
    if (tabIndex !== -1) {
      diagnostics.push({
        start: lineStart + tabIndex,
        end: lineStart + tabIndex + 1,
        line: lineNumber,
        message: 'Behúzáshoz csak szóköz használható, tabulátor nem.',
      });
    }

    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const content = raw.slice(indent);
    const trailingSpaces = content.match(/ +$/)?.[0].length ?? 0;
    if (trailingSpaces) {
      const trailingStart = raw.length - trailingSpaces;
      diagnostics.push({
        start: lineStart + trailingStart,
        end: lineStart + raw.length,
        line: lineNumber,
        message: 'A sor végén nem lehet szóköz.',
      });
    }

    const tokens: Token[] = [];
    const tokenPattern = /[^ ]+/g;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(content)) !== null) {
      tokens.push({
        value: match[0],
        start: lineStart + indent + match.index,
        end: lineStart + indent + match.index + match[0].length,
      });
    }

    for (let tokenIndex = 1; tokenIndex < tokens.length; tokenIndex += 1) {
      const previous = tokens[tokenIndex - 1];
      const current = tokens[tokenIndex];
      if (source.slice(previous.end, current.start) !== ' ') {
        diagnostics.push({
          start: previous.end,
          end: current.start,
          line: lineNumber,
          message: 'A tokenek között pontosan egy szóköz lehet.',
        });
      }
    }

    lines.push({
      indent,
      tokens,
      line: lineNumber,
      start: lineStart,
      end: lineStart + raw.length,
    });
  });

  const invalidSimple = (token: Token): boolean => {
    if (/^\d+$/.test(token.value)) {
      const number = Number(token.value);
      if (number > 100) report(token, 'A számérték csak 0 és 100 közötti lehet.');
      return false;
    }
    if (token.value === 'true' || token.value === 'false') return false;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(token.value)) {
      report(token, 'Érvénytelen simpleval: változó, 0–100 közötti szám vagy true/false szükséges.');
      return true;
    }
    if (reservedWords.has(token.value.toLowerCase())) {
      report(token, 'A kulcsszavak nem használhatók változónévként.');
      return true;
    }
    return false;
  };

  const parseSimple = (token: Token | undefined): Token | null => {
    if (!token) return null;
    invalidSimple(token);
    return token;
  };

  const parseExpression = (tokens: Token[]): Expression | null => {
    if (tokens.length === 1) {
      const value = parseSimple(tokens[0]);
      return value ? { kind: 'simple', value } : null;
    }
    if (tokens.length === 2 && (tokens[0].value === 'not' || tokens[0].value === 'isThere')) {
      const value = parseSimple(tokens[1]);
      return value ? { kind: tokens[0].value, value } : null;
    }
    if (tokens.length === 3 && binaryOperators.has(tokens[1].value)) {
      const left = parseSimple(tokens[0]);
      const right = parseSimple(tokens[2]);
      return left && right ? { kind: 'binary', left, operator: tokens[1], right } : null;
    }

    const marker = tokens[0] ?? tokens[tokens.length - 1];
    if (marker) report(marker, 'A set értéke csak simpleval, isThere, not vagy kétoperandusú művelet lehet.');
    return null;
  };

  const requireLength = (line: SourceLine, expected: number, label: string) => {
    if (line.tokens.length === expected) return;
    const marker = line.tokens[Math.min(expected, line.tokens.length - 1)] ?? line.tokens[0];
    if (marker) report(marker, line.tokens.length < expected ? `Hiányos ${label} utasítás.` : `Túl sok token a(z) ${label} utasításban.`);
  };

  const parseBlock = (startIndex: number, indent: number, stopAtElse = false): { commands: Command[]; nextIndex: number } => {
    const commands: Command[] = [];
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      if (line.indent < indent) break;
      if (line.indent > indent) {
        diagnostics.push({
          start: line.start,
          end: Math.min(line.start + line.indent, line.end),
          line: line.line,
          message: 'A behúzás nem egyezik a blokk többi sorának szintjével.',
        });
        index += 1;
        continue;
      }

      const [keyword, ...args] = line.tokens;
      if (keyword.value === 'else') {
        if (stopAtElse) break;
        report(keyword, 'Az else csak egy if utasításhoz kapcsolódhat.');
        index += 1;
        continue;
      }

      if (keyword.value === 'set') {
        if (line.tokens.length < 4) {
          requireLength(line, 4, 'set');
        } else {
          const name = line.tokens[1];
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name.value)) report(name, 'Érvénytelen változónév.');
          else if (reservedWords.has(name.value.toLowerCase())) report(name, 'A kulcsszavak nem használhatók változónévként.');
          if (line.tokens[2].value !== 'to') report(line.tokens[2], 'A változónév után a to kulcsszónak kell állnia.');
          const expression = parseExpression(line.tokens.slice(3));
          if (expression) commands.push({ kind: 'set', name, expression, line: line.line });
        }
      } else if (keyword.value === 'print') {
        requireLength(line, 2, 'print');
        const value = parseSimple(args[0]);
        if (value && args.length === 1) commands.push({ kind: 'print', value, line: line.line });
      } else if (keyword.value === 'step' || keyword.value === 'turn') {
        requireLength(line, 3, keyword.value);
        const requiredWord = keyword.value === 'step' ? 'forward' : 'by';
        if (args[0]?.value !== requiredWord) {
          if (args[0]) report(args[0], `A(z) ${keyword.value} után a(z) ${requiredWord} kulcsszónak kell állnia.`);
        }
        const value = parseSimple(args[1]);
        if (value && args.length === 2 && args[0].value === requiredWord) {
          commands.push({ kind: keyword.value, value, line: line.line });
        }
      } else if (keyword.value === 'mine') {
        requireLength(line, 2, 'mine');
        if (args[0]?.value !== 'here' && args[0]) report(args[0], 'A mine utasítás alakja: mine here.');
        if (args.length === 1 && args[0].value === 'here') commands.push({ kind: 'mine', line: line.line });
      } else if (keyword.value === 'if' || keyword.value === 'while') {
        const condition = parseExpression(args);
        if (!args.length) requireLength(line, 2, keyword.value);
        const kind = keyword.value;
        index += 1;
        let body: Command[] = [];
        if (lines[index]?.indent > line.indent) {
          const nested = parseBlock(index, lines[index].indent, kind === 'if');
          body = nested.commands;
          index = nested.nextIndex;
        }

        let elseBody: Command[] | null = null;
        if (kind === 'if' && lines[index]?.indent === line.indent && lines[index].tokens[0]?.value === 'else') {
          const elseLine = lines[index];
          requireLength(elseLine, 1, 'else');
          index += 1;
          if (lines[index]?.indent > elseLine.indent) {
            const nested = parseBlock(index, lines[index].indent);
            elseBody = nested.commands;
            index = nested.nextIndex;
          } else {
            elseBody = [];
          }
        }
        if (condition) {
          commands.push({ kind, condition, body, elseBody, line: line.line });
        }
        continue;
      } else if (keyword.value === 'else') {
        requireLength(line, 1, 'else');
        report(keyword, 'Az else csak egy if utasításhoz kapcsolódhat.');
      } else {
        report(keyword, 'Ismeretlen utasítás.');
      }

      index += 1;
    }

    return { commands, nextIndex: index };
  };

  const parsed = parseBlock(0, 0);

  const inferSimple = (token: Token, variables: Map<string, ValueType>): ValueType | undefined => {
    if (/^\d+$/.test(token.value)) return 'int';
    if (token.value === 'true' || token.value === 'false') return 'bool';
    const type = variables.get(token.value);
    if (!type) report(token, `A(z) ${token.value} változó még nincs inicializálva.`);
    return type;
  };

  const inferExpression = (expression: Expression, variables: Map<string, ValueType>): ValueType | undefined => {
    if (expression.kind === 'simple') return inferSimple(expression.value, variables);
    if (expression.kind === 'not') {
      const type = inferSimple(expression.value, variables);
      if (type && type !== 'bool') report(expression.value, 'A not operandusának logikai értéknek kell lennie.');
      return type ? 'bool' : undefined;
    }
    if (expression.kind === 'isThere') {
      const type = inferSimple(expression.value, variables);
      if (type && type !== 'int') report(expression.value, 'Az isThere paraméterének egész számnak kell lennie.');
      if (/^\d+$/.test(expression.value.value) && Number(expression.value.value) > 2) {
        report(expression.value, 'Az isThere paramétere csak 0, 1 vagy 2 lehet.');
      }
      return type ? 'bool' : undefined;
    }

    const leftType = inferSimple(expression.left, variables);
    const rightType = inferSimple(expression.right, variables);
    const operator = expression.operator.value;
    const numericOperator = ['+', '-', '*', '<', '<=', '>', '>='].includes(operator);
    const booleanOperator = ['and', 'or'].includes(operator);

    if (numericOperator || booleanOperator) {
      const expected = booleanOperator ? 'bool' : 'int';
      if (leftType && leftType !== expected) report(expression.left, `A(z) ${operator} művelet operandusának ${expected === 'int' ? 'egésznek' : 'logikainak'} kell lennie.`);
      if (rightType && rightType !== expected) report(expression.right, `A(z) ${operator} művelet operandusának ${expected === 'int' ? 'egésznek' : 'logikainak'} kell lennie.`);
      return leftType && rightType ? (booleanOperator || operator === '<' || operator === '<=' || operator === '>' || operator === '>=' ? 'bool' : 'int') : undefined;
    }

    if (leftType && rightType && leftType !== rightType) {
      report(expression.operator, 'Az egyenlőségvizsgálat operandusainak azonos típusúnak kell lenniük.');
      return undefined;
    }
    return leftType && rightType ? 'bool' : undefined;
  };

  const analyze = (commands: Command[], initial: Map<string, ValueType>): Map<string, ValueType> => {
    const variables = new Map(initial);
    commands.forEach(command => {
      if (command.kind === 'set') {
        const valueType = inferExpression(command.expression, variables);
        const existingType = variables.get(command.name.value);
        if (valueType && existingType && existingType !== valueType) {
          report(command.name, 'A változó típusa az első értékadáskor rögzül, később nem változhat.');
        } else if (valueType) {
          variables.set(command.name.value, valueType);
        }
      } else if (command.kind === 'print' || command.kind === 'step' || command.kind === 'turn') {
        const valueType = inferSimple(command.value, variables);
        if ((command.kind === 'step' || command.kind === 'turn') && valueType && valueType !== 'int') {
          report(command.value, `${command.kind === 'step' ? 'A step' : 'A turn'} paraméterének egész számnak kell lennie.`);
        }
      } else if (command.kind === 'if' || command.kind === 'while') {
        const conditionType = inferExpression(command.condition, variables);
        const conditionToken = command.condition.kind === 'binary' ? command.condition.operator : command.condition.value;
        if (conditionType && conditionType !== 'bool') report(conditionToken, 'Az if/while feltételének logikai értéknek kell lennie.');
        if (command.kind === 'while') {
          analyze(command.body, variables);
        } else {
          const thenVariables = analyze(command.body, variables);
          if (command.elseBody) {
            const elseVariables = analyze(command.elseBody, variables);
            variables.clear();
            for (const [name, type] of thenVariables) {
              if (elseVariables.get(name) === type) variables.set(name, type);
            }
          }
        }
      }
    });
    return variables;
  };

  analyze(parsed.commands, new Map());
  return diagnostics
    .map(diagnostic => ({ ...diagnostic, line: diagnostic.line || lines.find(line => diagnostic.start >= line.start && diagnostic.start <= line.end)?.line || 1 }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
};