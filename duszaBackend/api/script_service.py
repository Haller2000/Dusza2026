import copy

class Interpreter:
    def __init__(self, map_grid):
        self.map_grid = copy.deepcopy(map_grid)
        self.robot_x, self.robot_y = 0, 0
        self.facing_direction = 0 # 0=Észak, 1=Nyugat, 2=Dél, 3=Kelet
        self.variables = {}
        self.console_output = []
        self.instruction_count = 0
        self.explored_tiles = set()
        self.gold_collected = 0
        self.history = []
        
        self._find_robot()
        self.explored_tiles.add((self.robot_x, self.robot_y))

    def _find_robot(self):
        # A PDF szerint: ^ észak, < nyugat, v dél, > kelet
        dirs = {'^': 0, '<': 1, 'v': 2, '>': 3}
        for y, row in enumerate(self.map_grid):
            for x, cell in enumerate(row):
                if cell in dirs:
                    self.robot_x, self.robot_y = x, y
                    self.facing_direction = dirs[cell]
                    return

    # --- Tokenizer ---
    def _tokenize(self, script_text):
        if not script_text.strip():
            return []
            
        lines = script_text.split('\n')
        tokens = []
        for idx, raw in enumerate(lines, start=1):
            
            stripped = raw.lstrip(" ")
            indent = len(raw) - len(stripped)
            parts = stripped.split(" ")
            
            tokens.append({"indent": indent, "tokens": parts, "line": idx})
        return tokens

    # --- Parser ---
    def _parse_block(self, tokens, start, indent):
        tree = []
        i = start
        while i < len(tokens):
            item = tokens[i]
            if item["indent"] < indent:
                break

            kw = item["tokens"][0]
            line = item["line"]

            if kw in ("set", "print", "step", "turn", "mine"):
                tree.append(self._parse_simple(item))
                i += 1
            elif kw == "if":
                cond = item["tokens"][1:]
                body, rest = self._parse_block(tokens, i + 1, item["indent"] + 1)
                consumed = len(tokens[i + 1:]) - len(rest)
                
                else_body = []
                if rest and rest[0]["indent"] == item["indent"] and rest[0]["tokens"][0] == "else":
                    else_body, rest2 = self._parse_block(tokens, len(tokens) - len(rest) + 1, item["indent"] + 1)
                    consumed = len(tokens[i + 1:]) - len(rest2)
                
                tree.append({"type": "if", "condition": cond, "body": body, "else": else_body, "line": line})
                i += 1 + consumed
            elif kw == "while":
                cond = item["tokens"][1:]
                body, rest = self._parse_block(tokens, i + 1, item["indent"] + 1)
                consumed = len(tokens[i + 1:]) - len(rest)
                tree.append({"type": "while", "condition": cond, "body": body, "line": line})
                i += 1 + consumed

        return tree, tokens[i:]

    def _parse_simple(self, item):
        kw = item["tokens"][0]
        toks = item["tokens"]
        line = item["line"]
        if kw == "set":
            return {"type": "set", "name": toks[1], "expr": toks[3:], "line": line}
        if kw == "print":
            return {"type": "print", "expr": toks[1:], "line": line}
        if kw == "step":
            return {"type": "step", "expr": toks[2:], "line": line}
        if kw == "turn":
            return {"type": "turn", "expr": toks[2:], "line": line}
        if kw == "mine":
            return {"type": "mine", "line": line}

    # --- Expression Evaluator ---
    def _eval_expr(self, expr, line):
        if expr[0] == "not":
            val, typ = self._eval_single(expr[1], line)
            return not val, "bool"

        if expr[0] == "isThere":
            w_val, w_typ = self._eval_single(expr[1], line)
            return self._check_is_there(w_val), "bool"

        if len(expr) == 1:
            return self._eval_single(expr[0], line)
        
        op = expr[1]

        left_val, left_type = self._eval_single(expr[0], line)
        right_val, right_type = self._eval_single(expr[2], line)

        if op in ('+', '-', '*'):
            if op == '+': return left_val + right_val, "int"
            if op == '-': return left_val - right_val, "int"
            if op == '*': return left_val * right_val, "int"
        
        if op in ('<', '<=', '>', '>='):
            if op == '<': return left_val < right_val, "bool"
            if op == '<=': return left_val <= right_val, "bool"
            if op == '>': return left_val > right_val, "bool"
            if op == '>=': return left_val >= right_val, "bool"

        if op in ('=', '<>'):
            if op == '=': return left_val == right_val, "bool"
            if op == '<>': return left_val != right_val, "bool"

        if op in ('and', 'or'):
            if op == 'and': return left_val and right_val, "bool"
            if op == 'or': return left_val or right_val, "bool"


    def _eval_single(self, token, line):
        if token.isdigit(): return int(token), "int"
        if token.lower() in ("true", "false"): return (token.lower() == "true"), "bool"
        if token in self.variables: return self.variables[token]
        raise ValueError(f"Ismeretlen változó: {token} a(z) {line}. sorban.")

    def _check_is_there(self, w):
        dx, dy = 0, 0
        if self.facing_direction == 0: dy = -1  # Észak
        elif self.facing_direction == 1: dx = -1 # Nyugat
        elif self.facing_direction == 2: dy = 1  # Dél
        elif self.facing_direction == 3: dx = 1  # Kelet

        nx, ny = self.robot_x + dx, self.robot_y + dy
        
        if not (0 <= ny < len(self.map_grid) and 0 <= nx < len(self.map_grid[0])):
            return w == 1
        
        cell = self.map_grid[ny][nx]
        if w == 0: return cell == '.'
        if w == 1: return cell == '#'
        if w == 2: return cell == '@'
        return False

    def _save_snapshot(self, line):
        self.history.append({
            "line": line,
            "robot": [self.robot_x, self.robot_y],
            "facing": self.facing_direction,
            "gold": self.gold_collected,
            "explored": list(self.explored_tiles),
            "console": list(self.console_output),
            "variables": {k: v[0] for k, v in self.variables.items()}
        })

    # --- Végrehajtó ---
    def execute(self, script_text):
        self.variables = {}
        self.console_output = []
        self.instruction_count = 0
        self.explored_tiles = set()
        self.gold_collected = 0
        self.history = []
        
        tokens = self._tokenize(script_text)
        if not tokens:
            return {
                "status": "success", 
                "output": [], 
                "robot": [self.robot_x, self.robot_y], 
                "facing": self.facing_direction,
                "gold": 0, 
                "steps": 0,
                "explored": list(self.explored_tiles),
                "history": []
            }
            
        tree, rest = self._parse_block(tokens, 0, tokens[0]["indent"])

        self._run_block(tree)
        return {
            "status": "success",
            "output": self.console_output,
            "robot": [self.robot_x, self.robot_y],
            "facing": self.facing_direction,
            "gold": self.gold_collected,
            "steps": self.instruction_count,
            "explored": list(self.explored_tiles),
            "history": self.history
        }

    def _run_block(self, block):
        for node in block:
            self.instruction_count += 1
            
            if node["type"] == "set":
                val, typ = self._eval_expr(node["expr"], node["line"])
                self.variables[node["name"]] = (val, typ)
            
            elif node["type"] == "print":
                val, _ = self._eval_expr(node["expr"], node["line"])
                self.console_output.append(str(val).lower() if isinstance(val, bool) else str(val))
                self._save_snapshot(node["line"])
            
            elif node["type"] == "if":
                cond_val, cond_type = self._eval_expr(node["condition"], node["line"])
                if cond_val:
                    self._run_block(node["body"])
                else:
                    self._run_block(node["else"])
            
            elif node["type"] == "while":
                while True:
                    self.instruction_count += 1
                    if self.instruction_count >= 1000:
                        raise ValueError("INSTRUCTION_COUNT_LIMIT_EXCEEDED")
                    
                    cond_val, cond_type = self._eval_expr(node["condition"], node["line"])
                    if not cond_val:
                        break
                    self._run_block(node["body"])
            
            elif node["type"] == "step":
                n, typ = self._eval_expr(node["expr"], node["line"])
                for _ in range(n):
                    self._step_forward(node["line"])
                    self._save_snapshot(node["line"])
            
            elif node["type"] == "turn":
                n, typ = self._eval_expr(node["expr"], node["line"])
                # Balra forgás: (irány - n) % 4
                self.facing_direction = (self.facing_direction - n) % 4
                self._save_snapshot(node["line"])
            
            elif node["type"] == "mine":
                self.map_grid[self.robot_y][self.robot_x] = '.'
                self.gold_collected += 1
                self._save_snapshot(node["line"])

    def _step_forward(self, line):
        dx, dy = 0, 0
        if self.facing_direction == 0: dy = -1  # Észak
        elif self.facing_direction == 1: dx = -1 # Nyugat
        elif self.facing_direction == 2: dy = 1  # Dél
        elif self.facing_direction == 3: dx = 1  # Kelet

        nx, ny = self.robot_x + dx, self.robot_y + dy

        self.robot_x, self.robot_y = nx, ny
        self.explored_tiles.add((nx, ny))