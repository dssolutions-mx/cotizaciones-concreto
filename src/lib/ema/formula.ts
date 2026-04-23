/**
 * Safe expression parser + evaluator for EMA verification templates.
 * No eval(). Supports: + - * / ^, comparisons, identifiers, numbers,
 * and functions abs, min, max, avg, sum, round, sqrt, pi.
 */

export type FormulaNode =
  | { type: 'number'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'unary'; op: '+' | '-'; expr: FormulaNode }
  | { type: 'binary'; op: BinaryOp; left: FormulaNode; right: FormulaNode }
  | { type: 'call'; name: string; args: FormulaNode[] };

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '<'
  | '>'
  | '<='
  | '>='
  | '=='
  | '!=';

const FUNC_NAMES = new Set(['abs', 'min', 'max', 'avg', 'sum', 'round', 'sqrt', 'pi']);

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'op'; op: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'eof' };

function tokenize(input: string): Token[] {
  const s = input.trim();
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (c === ',') {
      out.push({ kind: 'comma' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      if (s[j] === '.') {
        j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      if (s[j] === 'e' || s[j] === 'E') {
        j++;
        if (s[j] === '+' || s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const slice = s.slice(i, j);
      const n = parseFloat(slice);
      if (Number.isNaN(n)) throw new Error(`Número inválido: "${slice}"`);
      out.push({ kind: 'num', value: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      const name = s.slice(i, j);
      out.push({ kind: 'ident', name });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '==', '!='].includes(two)) {
      out.push({ kind: 'op', op: two });
      i += 2;
      continue;
    }
    if ('+-*/^<>'.includes(c)) {
      out.push({ kind: 'op', op: c });
      i++;
      continue;
    }
    throw new Error(`Carácter inesperado en posición ${i}: "${c}"`);
  }
  out.push({ kind: 'eof' });
  return out;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: 'eof' };
  }

  private eat(kind?: Token['kind'], op?: string): Token {
    const t = this.peek();
    if (kind && t.kind !== kind) throw new Error(`Se esperaba ${kind}, se obtuvo ${t.kind}`);
    if (op && t.kind === 'op' && (t as any).op !== op)
      throw new Error(`Se esperaba op "${op}", se obtuvo "${(t as any).op}"`);
    this.pos++;
    return t;
  }

  parseExpression(): FormulaNode {
    return this.parseComparison();
  }

  private parseComparison(): FormulaNode {
    let left = this.parseAdditive();
    for (;;) {
      const t = this.peek();
      if (t.kind !== 'op') break;
      const cmp = ['<', '>', '<=', '>=', '==', '!='];
      if (!cmp.includes((t as any).op)) break;
      const op = (t as any).op as BinaryOp;
      this.eat('op');
      const right = this.parseAdditive();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseAdditive(): FormulaNode {
    let left = this.parseMultiplicative();
    for (;;) {
      const t = this.peek();
      if (t.kind !== 'op' || ((t as any).op !== '+' && (t as any).op !== '-')) break;
      const op = (t as any).op as '+' | '-';
      this.eat('op');
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): FormulaNode {
    let left = this.parsePower();
    for (;;) {
      const t = this.peek();
      if (t.kind !== 'op' || ((t as any).op !== '*' && (t as any).op !== '/')) break;
      const op = (t as any).op as '*' | '/';
      this.eat('op');
      const right = this.parsePower();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parsePower(): FormulaNode {
    let left = this.parseUnary();
    const t = this.peek();
    if (t.kind === 'op' && (t as any).op === '^') {
      this.eat('op', '^');
      const right = this.parseUnary();
      left = { type: 'binary', op: '^', left, right };
    }
    return left;
  }

  private parseUnary(): FormulaNode {
    const t = this.peek();
    if (t.kind === 'op' && ((t as any).op === '+' || (t as any).op === '-')) {
      const op = (t as any).op as '+' | '-';
      this.eat('op');
      const expr = this.parseUnary();
      return { type: 'unary', op, expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaNode {
    const t = this.peek();
    if (t.kind === 'num') {
      this.eat('num');
      return { type: 'number', value: (t as any).value };
    }
    if (t.kind === 'ident') {
      this.eat('ident');
      const name = (t as any).name as string;
      if (name === 'pi' && this.peek().kind !== 'lparen') {
        return { type: 'number', value: Math.PI };
      }
      if (this.peek().kind === 'lparen') {
        if (!FUNC_NAMES.has(name)) throw new Error(`Función desconocida: ${name}`);
        this.eat('lparen');
        const args: FormulaNode[] = [];
        if (name === 'pi') {
          if (this.peek().kind !== 'rparen') throw new Error('pi() no admite argumentos');
          this.eat('rparen');
          return { type: 'number', value: Math.PI };
        }
        if (this.peek().kind !== 'rparen') {
          args.push(this.parseExpression());
          while (this.peek().kind === 'comma') {
            this.eat('comma');
            args.push(this.parseExpression());
          }
        }
        this.eat('rparen');
        return { type: 'call', name, args };
      }
      return { type: 'ident', name };
    }
    if (t.kind === 'lparen') {
      this.eat('lparen');
      const inner = this.parseExpression();
      this.eat('rparen');
      return inner;
    }
    throw new Error(`Expresión incompleta cerca de token ${this.pos}`);
  }
}

export function parseFormula(expr: string): FormulaNode {
  const tokens = tokenize(expr);
  const p = new Parser(tokens);
  const ast = p.parseExpression();
  if (p.peek().kind !== 'eof') throw new Error('Sobran tokens al final de la expresión');
  return ast;
}

export function extractVariables(ast: FormulaNode): Set<string> {
  const s = new Set<string>();
  function walk(n: FormulaNode) {
    switch (n.type) {
      case 'ident':
        s.add(n.name);
        break;
      case 'unary':
        walk(n.expr);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'call':
        for (const a of n.args) walk(a);
        break;
      default:
        break;
    }
  }
  walk(ast);
  return s;
}

/** Evaluate numeric or boolean comparison expression; comparisons return 1/0 */
export function evaluateFormula(ast: FormulaNode, scope: Record<string, number>): number {
  function ev(n: FormulaNode): number {
    switch (n.type) {
      case 'number':
        return n.value;
      case 'ident': {
        if (!(n.name in scope)) throw new Error(`Variable desconocida: ${n.name}`);
        return scope[n.name];
      }
      case 'unary':
        return n.op === '-' ? -ev(n.expr) : ev(n.expr);
      case 'binary': {
        const L = ev(n.left);
        const R = ev(n.right);
        switch (n.op) {
          case '+':
            return L + R;
          case '-':
            return L - R;
          case '*':
            return L * R;
          case '/':
            if (R === 0) throw new Error('División entre cero');
            return L / R;
          case '^':
            return L ** R;
          case '<':
            return L < R ? 1 : 0;
          case '>':
            return L > R ? 1 : 0;
          case '<=':
            return L <= R ? 1 : 0;
          case '>=':
            return L >= R ? 1 : 0;
          case '==':
            return L === R ? 1 : 0;
          case '!=':
            return L !== R ? 1 : 0;
          default:
            throw new Error(`Operador no soportado: ${n.op}`);
        }
      }
      case 'call': {
        const args = n.args.map(a => ev(a));
        switch (n.name) {
          case 'abs':
            if (args.length !== 1) throw new Error('abs() requiere 1 argumento');
            return Math.abs(args[0]);
          case 'sqrt':
            if (args.length !== 1) throw new Error('sqrt() requiere 1 argumento');
            if (args[0] < 0) throw new Error('sqrt de valor negativo');
            return Math.sqrt(args[0]);
          case 'round':
            if (args.length < 1 || args.length > 2) throw new Error('round(x[, dec])');
            if (args.length === 1) return Math.round(args[0]);
            const dec = args[1];
            const f = 10 ** dec;
            return Math.round(args[0] * f) / f;
          case 'min':
            if (args.length < 1) throw new Error('min() requiere al menos 1 argumento');
            return Math.min(...args);
          case 'max':
            if (args.length < 1) throw new Error('max() requiere al menos 1 argumento');
            return Math.max(...args);
          case 'avg':
            if (args.length < 1) throw new Error('avg() requiere al menos 1 argumento');
            return args.reduce((a, b) => a + b, 0) / args.length;
          case 'sum':
            return args.reduce((a, b) => a + b, 0);
          default:
            throw new Error(`Función no implementada: ${n.name}`);
        }
      }
      default:
        throw new Error('Nodo AST inválido');
    }
  }
  return ev(ast);
}

export interface DagItem {
  id: string;
  variable_name: string | null;
  formula: string | null;
}

export interface DagValidationResult {
  ok: boolean;
  cycles: string[][];
  unknownVars: { itemId: string; varName: string }[];
  duplicateVars: string[];
}

/** Topological order of derivado items; `knownVars` = inputs + header vars */
export function validateDerivadoDAG(
  derivados: DagItem[],
  knownVars: Set<string>,
): DagValidationResult {
  const byVar = new Map<string, string>();
  const seenNames = new Set<string>();
  const duplicateVars: string[] = [];
  for (const d of derivados) {
    if (!d.variable_name) continue;
    if (seenNames.has(d.variable_name)) duplicateVars.push(d.variable_name);
    seenNames.add(d.variable_name);
    byVar.set(d.variable_name, d.id);
  }
  if (duplicateVars.length > 0)
    return { ok: false, cycles: [], unknownVars: [], duplicateVars: [...new Set(duplicateVars)] };

  const unknownVars: { itemId: string; varName: string }[] = [];
  const deps = new Map<string, Set<string>>(); // item id -> vars it needs from other derivados

  for (const d of derivados) {
    if (!d.formula || !d.variable_name) continue;
    let ast: FormulaNode;
    try {
      ast = parseFormula(d.formula);
    } catch {
      unknownVars.push({ itemId: d.id, varName: '(parse error)' });
      continue;
    }
    const vars = extractVariables(ast);
    const needFromDeriv = new Set<string>();
    for (const v of vars) {
      if (knownVars.has(v)) continue;
      if (byVar.has(v)) {
        needFromDeriv.add(byVar.get(v)!);
        continue;
      }
      unknownVars.push({ itemId: d.id, varName: v });
    }
    deps.set(d.id, needFromDeriv);
  }

  if (unknownVars.length > 0) return { ok: false, cycles: [], unknownVars, duplicateVars: [] };

  // Cycle detect on item ids
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function dfs(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const idx = stack.indexOf(id);
      cycles.push(idx >= 0 ? stack.slice(idx) : [...stack, id]);
      return;
    }
    visiting.add(id);
    stack.push(id);
    for (const depId of deps.get(id) ?? []) dfs(depId);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const d of derivados) dfs(d.id);

  return {
    ok: cycles.length === 0 && unknownVars.length === 0,
    cycles,
    unknownVars,
    duplicateVars: [],
  };
}

export function topoSortDerivados(derivados: DagItem[], knownVars: Set<string>): string[] {
  const byId = new Map(derivados.map(d => [d.id, d]));
  const byVar = new Map<string, string>();
  for (const d of derivados) {
    if (d.variable_name) byVar.set(d.variable_name, d.id);
  }

  const graph = new Map<string, Set<string>>(); // id -> ids that must run before
  const inDegree = new Map<string, number>();

  for (const d of derivados) {
    graph.set(d.id, new Set());
    inDegree.set(d.id, 0);
  }

  for (const d of derivados) {
    if (!d.formula) continue;
    let ast: FormulaNode;
    try {
      ast = parseFormula(d.formula);
    } catch {
      continue;
    }
    const vars = extractVariables(ast);
    for (const v of vars) {
      if (knownVars.has(v)) continue;
      const depId = byVar.get(v);
      if (!depId || depId === d.id) continue;
      // d depends on depId => depId before d
      if (!graph.get(depId)!.has(d.id)) {
        graph.get(depId)!.add(d.id);
        inDegree.set(d.id, (inDegree.get(d.id) ?? 0) + 1);
      }
    }
  }

  const q: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) q.push(id);
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const next of graph.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 1) - 1);
      if (inDegree.get(next) === 0) q.push(next);
    }
  }
  if (order.length !== derivados.length) {
    // cycle or disconnected — return Kahn partial
    for (const d of derivados) if (!order.includes(d.id)) order.push(d.id);
  }
  return order;
}
