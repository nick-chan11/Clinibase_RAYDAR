/* SurveyJS visibleIf expressions, the subset the TST eSources use (and a little more):
   {name}, {name.sub}, 'text', numbers, true/false, [list]
   =  ==  !=  <>  <  >  <=  >=  contains  notcontains  anyof  allof  noneof  empty  notempty
   and  or  not  ( )
   compile(src) → { test(get) → boolean, deps: [names], error } */

const OPS2 = ['==', '!=', '<>', '<=', '>='];
const WORD_OPS = ['contains', 'notcontains', 'anyof', 'allof', 'noneof', 'empty', 'notempty', 'and', 'or', 'not'];

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{') { const j = s.indexOf('}', i); if (j < 0) throw new Error('missing }'); out.push({ t: 'var', v: s.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (c === "'" || c === '"') { const j = s.indexOf(c, i + 1); if (j < 0) throw new Error('missing quote'); out.push({ t: 'lit', v: s.slice(i + 1, j) }); i = j + 1; continue; }
    if ('()[],'.includes(c)) { out.push({ t: c }); i++; continue; }
    const two = s.slice(i, i + 2);
    if (OPS2.includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('=<>!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    const m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (m) { out.push({ t: 'lit', v: Number(m[0]) }); i += m[0].length; continue; }
    const w = /^[A-Za-z_]+/.exec(s.slice(i));
    if (w) {
      const lw = w[0].toLowerCase();
      if (lw === 'true' || lw === 'false') out.push({ t: 'lit', v: lw === 'true' });
      else if (WORD_OPS.includes(lw)) out.push({ t: lw === 'and' || lw === 'or' || lw === 'not' ? lw : 'op', v: lw });
      else out.push({ t: 'lit', v: w[0] });
      i += w[0].length;
      continue;
    }
    throw new Error('unexpected "' + c + '"');
  }
  return out;
}

/* or → and → not → comparison → value */
function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p], next = () => tokens[p++];
  const expect = (t) => { const k = next(); if (!k || k.t !== t) throw new Error('expected ' + t); return k; };
  function value() {
    const k = next();
    if (!k) throw new Error('unexpected end');
    if (k.t === '(') { const e = orE(); expect(')'); return e; }
    if (k.t === '[') {
      const items = [];
      while (peek() && peek().t !== ']') { items.push(value()); if (peek() && peek().t === ',') next(); }
      expect(']');
      return { k: 'list', items };
    }
    if (k.t === 'var') return { k: 'var', name: k.v };
    if (k.t === 'lit') return { k: 'lit', v: k.v };
    throw new Error('unexpected ' + (k.v || k.t));
  }
  function cmp() {
    const left = value();
    const k = peek();
    if (k && k.t === 'op') {
      next();
      if (k.v === 'empty' || k.v === 'notempty') return { k: 'un', op: k.v, a: left };
      return { k: 'bin', op: k.v, a: left, b: value() };
    }
    return left;
  }
  function notE() { if (peek() && peek().t === 'not') { next(); return { k: 'not', a: notE() }; } return cmp(); }
  function andE() { let a = notE(); while (peek() && peek().t === 'and') { next(); a = { k: 'and', a, b: notE() }; } return a; }
  function orE() { let a = andE(); while (peek() && peek().t === 'or') { next(); a = { k: 'or', a, b: andE() }; } return a; }
  const e = orE();
  if (p < tokens.length) throw new Error('unexpected ' + (tokens[p].v || tokens[p].t));
  return e;
}

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null);
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
function eq(a, b) {
  if (a == null || b == null) return isEmpty(a) && isEmpty(b);
  const na = num(a), nb = num(b);
  if (na != null && nb != null) return na === nb;
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x) => b.some((y) => eq(x, y)));
  return String(a) === String(b);
}
function ord(a, b, f) {
  const na = num(a), nb = num(b);
  if (na == null || nb == null) return false;
  return f(na, nb);
}

function evaluate(e, get) {
  switch (e.k) {
    case 'lit': return e.v;
    case 'list': return e.items.map((x) => evaluate(x, get));
    case 'var': return get(e.name);
    case 'not': return !truthy(evaluate(e.a, get));
    case 'and': return truthy(evaluate(e.a, get)) && truthy(evaluate(e.b, get));
    case 'or': return truthy(evaluate(e.a, get)) || truthy(evaluate(e.b, get));
    case 'un': { const v = evaluate(e.a, get); return e.op === 'empty' ? isEmpty(v) : !isEmpty(v); }
    case 'bin': {
      const a = evaluate(e.a, get), b = evaluate(e.b, get);
      switch (e.op) {
        case '=': case '==': return eq(a, b);
        case '!=': case '<>': return !eq(a, b);
        case '<': return ord(a, b, (x, y) => x < y);
        case '>': return ord(a, b, (x, y) => x > y);
        case '<=': return ord(a, b, (x, y) => x <= y);
        case '>=': return ord(a, b, (x, y) => x >= y);
        case 'contains': return Array.isArray(a) ? a.some((x) => eq(x, b)) : a != null && String(a).includes(String(b));
        case 'notcontains': return !(Array.isArray(a) ? a.some((x) => eq(x, b)) : a != null && String(a).includes(String(b)));
        case 'anyof': return arr(b).some((y) => arr(a).some((x) => eq(x, y)));
        case 'allof': return arr(b).length > 0 && arr(b).every((y) => arr(a).some((x) => eq(x, y)));
        case 'noneof': return !arr(b).some((y) => arr(a).some((x) => eq(x, y)));
        default: return false;
      }
    }
    default: return false;
  }
}
const truthy = (v) => !!v && !(Array.isArray(v) && !v.length);

function collect(e, out) {
  if (!e) return out;
  if (e.k === 'var') out.add(e.name.split('.')[0].trim());
  ['a', 'b'].forEach((k) => e[k] && collect(e[k], out));
  (e.items || []).forEach((x) => collect(x, out));
  return out;
}

/** Compare-with-a-literal pairs, e.g. {Holiday} = 'Item 2' → [{name:'Holiday', op:'=', v:'Item 2'}], for the file check. */
function pairs(e, out = []) {
  if (!e) return out;
  if (e.k === 'bin' && e.a.k === 'var' && (e.b.k === 'lit' || e.b.k === 'list')) out.push({ name: e.a.name, op: e.op, v: e.b.k === 'lit' ? [e.b.v] : e.b.items.map((x) => x.v) });
  ['a', 'b'].forEach((k) => e[k] && pairs(e[k], out));
  return out;
}

export function compile(src) {
  const s = String(src == null ? '' : src).trim();
  if (!s) return null;
  try {
    const ast = parse(tokenize(s));
    return { src: s, test: (get) => truthy(evaluate(ast, get)), deps: [...collect(ast, new Set())], pairs: pairs(ast), never: ast.k === 'lit' && !truthy(ast.v) };
  } catch (err) {
    return { src: s, test: () => false, deps: [], pairs: [], error: err.message, never: false };
  }
}

/** All of several conditions (a panel's and the question's own). */
export function all(list) {
  const L = list.filter(Boolean);
  if (!L.length) return null;
  if (L.length === 1) return L[0];
  return {
    src: L.map((x) => '(' + x.src + ')').join(' and '),
    test: (get) => L.every((x) => x.test(get)),
    deps: [...new Set(L.flatMap((x) => x.deps))],
    pairs: L.flatMap((x) => x.pairs),
    never: L.some((x) => x.never),
    error: L.map((x) => x.error).filter(Boolean)[0],
  };
}
