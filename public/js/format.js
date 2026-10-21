// A small tmux format-string interpreter used by the live preview.
// It mirrors tmux's order: strftime -> #{formats}/#(commands) -> #[styles].

import { colorToCss } from './colors.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

export function strftime(fmt, d = new Date()) {
  return fmt.replace(/%([a-zA-Z%])/g, (m, c) => {
    const H = d.getHours(), h12 = H % 12 || 12;
    switch (c) {
      case '%': return '%';
      case 'a': return DAYS[d.getDay()].slice(0, 3);
      case 'A': return DAYS[d.getDay()];
      case 'b': case 'h': return MONTHS[d.getMonth()].slice(0, 3);
      case 'B': return MONTHS[d.getMonth()];
      case 'd': return p2(d.getDate());
      case 'e': return String(d.getDate()).padStart(2, ' ');
      case 'H': return p2(H);
      case 'k': return String(H).padStart(2, ' ');
      case 'I': return p2(h12);
      case 'l': return String(h12).padStart(2, ' ');
      case 'M': return p2(d.getMinutes());
      case 'S': return p2(d.getSeconds());
      case 'p': return H < 12 ? 'AM' : 'PM';
      case 'P': return H < 12 ? 'am' : 'pm';
      case 'y': return p2(d.getFullYear() % 100);
      case 'Y': return String(d.getFullYear());
      case 'm': return p2(d.getMonth() + 1);
      case 'j': return String(Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)).padStart(3, '0');
      case 'u': return String(d.getDay() || 7);
      case 'w': return String(d.getDay());
      case 'V': return p2(isoWeek(d));
      case 'R': return `${p2(H)}:${p2(d.getMinutes())}`;
      case 'T': return `${p2(H)}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      case 'D': return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${p2(d.getFullYear() % 100)}`;
      case 'F': return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      case 's': return String(Math.floor(d / 1000));
      case 'Z': return (d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()) || '';
      case 'z': { const o = -d.getTimezoneOffset(); return (o >= 0 ? '+' : '-') + p2(Math.floor(Math.abs(o) / 60)) + p2(Math.abs(o) % 60); }
      case 'n': return ' ';
      case 't': return ' ';
      default: return m;
    }
  });
}

const ALIASES = { S: 'session_name', W: 'window_name', I: 'window_index', P: 'pane_index', T: 'pane_title', H: 'host', h: 'host_short', F: 'window_flags', D: 'pane_id' };

// Placeholders protect literal characters from the later style pass.
const LIT_HASH = '\u0001';

/** Find the index of the closing bracket matching an opener at s[start] (which is '{' or '(' after '#'). */
function matchClose(s, start, open, close) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '#' && (s[i + 1] === '#' || s[i + 1] === ',' || s[i + 1] === '}')) { i++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Split on top-level commas (ignores commas nested in #{...}, #[...] and escaped as #,). */
function splitTop(s, max = Infinity) {
  const out = [];
  let depth = 0, sq = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '#' && s[i + 1] === ',') { cur += '#,'; i++; continue; }
    if (c === '#' && s[i + 1] === '{') { depth++; cur += '#{'; i++; continue; }
    if (c === '#' && s[i + 1] === '[') { sq++; cur += '#['; i++; continue; }
    if (c === '}' && depth > 0) depth--;
    if (c === ']' && sq > 0) sq--;
    if (c === ',' && depth === 0 && sq === 0 && out.length < max - 1) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const truthy = (v) => v != null && v !== '' && v !== '0';

function lookup(name, ctx) {
  name = name.trim();
  if (name in ctx.vars) return String(ctx.vars[name]);
  if (ctx.options && name in ctx.options) return String(ctx.options[name]);
  return '';
}

function evalExpr(inner, ctx, depth) {
  if (inner.startsWith('?')) {
    const parts = splitTop(inner.slice(1));
    // #{?c1,v1,c2,v2,...,else}
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const cond = parts[i].includes('#') ? expand(parts[i], ctx, depth + 1) : lookup(parts[i], ctx);
      if (truthy(cond)) return expand(parts[i + 1], ctx, depth + 1);
    }
    return parts.length % 2 ? expand(parts[parts.length - 1], ctx, depth + 1) : '';
  }
  const mod = /^([a-zA-Z!=|&<>]+|=-?\d+|p-?\d+):/.exec(inner);
  if (mod) {
    const m = mod[1];
    const rest = inner.slice(mod[0].length);
    const val = () => (rest.includes('#') ? expand(rest, ctx, depth + 1) : lookup(rest, ctx));
    if (m === 'b') return val().replace(/\/+$/, '').split('/').pop();
    if (m === 'd') { const v = val().replace(/\/+$/, ''); const i = v.lastIndexOf('/'); return i > 0 ? v.slice(0, i) : '/'; }
    if (m === 'l') return rest;
    if (m === 'T') return strftime(val());
    if (m[0] === '=' && /^=-?\d+$/.test(m)) {
      const n = parseInt(m.slice(1), 10); const v = [...val()];
      return (n >= 0 ? v.slice(0, n) : v.slice(n)).join('');
    }
    if (m[0] === 'p' && /^p-?\d+$/.test(m)) {
      const n = parseInt(m.slice(1), 10); const v = val();
      return n >= 0 ? v.padEnd(n) : v.padStart(-n);
    }
    if (['==', '!=', '<', '>', '<=', '>=', '||', '&&'].includes(m)) {
      const [a = '', b = ''] = splitTop(rest, 2).map((x) => (x.includes('#') ? expand(x, ctx, depth + 1) : lookup(x, ctx) || x));
      switch (m) {
        case '==': return a === b ? '1' : '0';
        case '!=': return a !== b ? '1' : '0';
        case '<': return a < b ? '1' : '0';
        case '>': return a > b ? '1' : '0';
        case '<=': return a <= b ? '1' : '0';
        case '>=': return a >= b ? '1' : '0';
        case '||': return truthy(a) || truthy(b) ? '1' : '0';
        case '&&': return truthy(a) && truthy(b) ? '1' : '0';
      }
    }
    if (m === 'E' || m === 'q' || m === 'n') return m === 'n' ? String(val().length) : val();
    return val();
  }
  return lookup(inner, ctx);
}

/** Expand #{...}, #(...), #X aliases. Leaves #[...] style blocks intact for the style pass. */
export function expand(s, ctx, depth = 0) {
  if (depth > 12) return '';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '#') { out += c; continue; }
    const n = s[i + 1];
    if (n === undefined) { out += '#'; break; }
    if (n === '{') {
      const end = matchClose(s, i + 1, '{', '}');
      if (end < 0) { out += s.slice(i); break; }
      out += evalExpr(s.slice(i + 2, end), ctx, depth);
      i = end;
    } else if (n === '(') {
      const end = matchClose(s, i + 1, '(', ')');
      if (end < 0) { out += s.slice(i); break; }
      const cmd = s.slice(i + 2, end);
      out += ctx.cmd ? ctx.cmd(cmd) : '';
      i = end;
    } else if (n === '[') {
      const end = s.indexOf(']', i);
      if (end < 0) { out += s.slice(i); break; }
      out += s.slice(i, end + 1);
      i = end;
    } else if (n === '#') { out += LIT_HASH; i++; }
    else if (n === ',' || n === '}') { out += n; i++; }
    else if (ALIASES[n]) { out += lookup(ALIASES[n], ctx); i++; }
    else { out += '#' + n; i++; }
  }
  return out;
}

function applyStyleTokens(cur, body, base) {
  for (const raw of body.split(/[\s,]+/)) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (t === 'default') { cur.fg = base.fg; cur.bg = base.bg; cur.attrs = new Set(base.attrs); }
    else if (t.startsWith('fg=')) cur.fg = t.slice(3) === 'default' ? base.fg : raw.trim().slice(3);
    else if (t.startsWith('bg=')) cur.bg = t.slice(3) === 'default' ? base.bg : raw.trim().slice(3);
    else if (t === 'none') cur.attrs = new Set();
    else if (t.startsWith('no') && t.length > 2) { cur.attrs.delete(t.slice(2)); if (t === 'noitalics') cur.attrs.delete('italics'); }
    else if (t === 'italic') cur.attrs.add('italics');
    else if (t === 'underline') cur.attrs.add('underscore');
    else if (/^(bold|dim|italics|underscore|reverse|blink|strikethrough|overline|double-underscore|curly-underscore)$/.test(t)) cur.attrs.add(t);
    // align=, list=, range=, fill=, push-default... are layout hints we ignore.
  }
}

/**
 * Turn a format into styled runs: [{text, fg, bg, attrs:Set}]
 * ctx: {vars, options, cmd(cmd)->string, time: Date|false}
 * base: {fg, bg, attrs:[]} — the style that "default" resets to.
 */
export function renderRuns(fmt, ctx, base = { fg: 'default', bg: 'default', attrs: [] }, start = null) {
  let s = fmt || '';
  if (ctx.time) s = strftime(s, ctx.time);
  s = expand(s, ctx);
  const runs = [];
  const cur = start
    ? { fg: start.fg, bg: start.bg, attrs: new Set(start.attrs) }
    : { fg: base.fg, bg: base.bg, attrs: new Set(base.attrs) };
  let text = '';
  const flush = () => {
    if (text) runs.push({ text: text.split(LIT_HASH).join('#'), fg: cur.fg, bg: cur.bg, attrs: new Set(cur.attrs) });
    text = '';
  };
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '#' && s[i + 1] === '[') {
      const end = s.indexOf(']', i);
      if (end > 0) { flush(); applyStyleTokens(cur, s.slice(i + 2, end), base); i = end; continue; }
    }
    text += s[i];
  }
  flush();
  runs.end = { fg: cur.fg, bg: cur.bg, attrs: [...cur.attrs] };
  return runs;
}

// Powerline / nerd-font separator glyphs we draw with CSS so they work without special fonts.
const GLYPHS = new Set(['', '', '', '', '', '', '', '', '', '', '', '']);

/** Render runs into DOM spans. termFg/termBg are the terminal's default colours. */
export function runsToNodes(runs, pal, baseFg, baseBg) {
  const frag = document.createDocumentFragment();
  for (const r of runs) {
    let fg = colorToCss(r.fg, pal, baseFg);
    let bg = colorToCss(r.bg, pal, baseBg);
    if (r.attrs.has('reverse')) [fg, bg] = [bg, fg];
    const css = [];
    if (r.attrs.has('bold')) css.push('font-weight:700');
    if (r.attrs.has('dim')) css.push('opacity:.6');
    if (r.attrs.has('italics')) css.push('font-style:italic');
    const deco = [];
    if ([...r.attrs].some((a) => a.includes('underscore'))) deco.push('underline');
    if (r.attrs.has('strikethrough')) deco.push('line-through');
    if (r.attrs.has('overline')) deco.push('overline');
    if (deco.length) css.push('text-decoration:' + deco.join(' '));
    // Split out separator glyphs so they can be drawn as shapes.
    let buf = '';
    const pushText = () => {
      if (!buf) return;
      const span = document.createElement('span');
      span.textContent = buf;
      span.style.cssText = `color:${fg};background:${bg};${css.join(';')}`;
      frag.append(span);
      buf = '';
    };
    for (const ch of r.text) {
      if (GLYPHS.has(ch)) {
        pushText();
        const g = document.createElement('span');
        g.className = 'pl pl-' + ch.codePointAt(0).toString(16);
        g.style.cssText = `color:${fg};background:${bg}`;
        g.textContent = ' ';
        frag.append(g);
      } else buf += ch;
    }
    pushText();
  }
  return frag;
}

/** Plain-text width estimate (used for status-left-length suggestions). */
export const runsText = (runs) => runs.map((r) => r.text).join('');
