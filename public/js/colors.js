// tmux colour names -> CSS, preview palettes and style-string helpers.

export const NAMED = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
export const ALL_NAMED = [...NAMED, ...NAMED.map((n) => 'bright' + n)];

/** Terminal palettes used only for the preview (your real terminal decides the actual colours). */
export const PALETTES = {
  classic: {
    name: 'Classic dark',
    bg: '#1e1e1e', fg: '#cccccc',
    ansi: ['#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
      '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff'],
  },
  tango: {
    name: 'Tango',
    bg: '#171421', fg: '#d0cfcc',
    ansi: ['#2e3436', '#cc0000', '#4e9a06', '#c4a000', '#3465a4', '#75507b', '#06989a', '#d3d7cf',
      '#555753', '#ef2929', '#8ae234', '#fce94f', '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec'],
  },
  light: {
    name: 'Light',
    bg: '#fafafa', fg: '#1f2328',
    ansi: ['#000000', '#c91b00', '#00a600', '#999900', '#0225c7', '#b200b2', '#00a6b2', '#bfbfbf',
      '#686868', '#ff6e67', '#2fbd3a', '#c7c400', '#6871ff', '#ff77ff', '#00b5c0', '#ffffff'],
  },
};

const CUBE = [0, 95, 135, 175, 215, 255];
const hex2 = (n) => n.toString(16).padStart(2, '0');

export function xterm256(n, pal) {
  if (n < 16) return pal.ansi[n];
  if (n < 232) {
    const i = n - 16;
    return '#' + hex2(CUBE[Math.floor(i / 36)]) + hex2(CUBE[Math.floor(i / 6) % 6]) + hex2(CUBE[i % 6]);
  }
  const g = 8 + (n - 232) * 10;
  return '#' + hex2(g) + hex2(g) + hex2(g);
}

/** Resolve a tmux colour to CSS. Returns `fallback` for default/terminal/unknown. */
export function colorToCss(c, pal, fallback) {
  if (!c) return fallback;
  const v = String(c).trim().toLowerCase();
  if (v === 'default' || v === 'terminal') return fallback;
  let i = NAMED.indexOf(v);
  if (i >= 0) return pal.ansi[i];
  if (v.startsWith('bright')) {
    i = NAMED.indexOf(v.slice(6));
    if (i >= 0) return pal.ansi[8 + i];
  }
  const m = /^colou?r(\d{1,3})$/.exec(v);
  if (m && +m[1] < 256) return xterm256(+m[1], pal);
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return v;
  return fallback;
}

export function isValidColor(c) {
  if (!c) return true;
  const v = String(c).trim().toLowerCase();
  return v === 'default' || v === 'terminal' || ALL_NAMED.includes(v) ||
    /^colou?r(\d{1,3})$/.test(v) && +v.replace(/\D/g, '') < 256 || /^#[0-9a-f]{6}$/.test(v);
}

export const ATTRS = ['bold', 'dim', 'italics', 'underscore', 'reverse', 'blink', 'strikethrough', 'overline'];

/** 'fg=red,bg=#112233,bold' -> {fg, bg, attrs:[...], rest:[...]} */
export function parseStyle(str) {
  const out = { fg: '', bg: '', attrs: [], rest: [] };
  if (!str) return out;
  for (const raw of String(str).split(/[\s,]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const l = t.toLowerCase();
    if (l.startsWith('fg=')) out.fg = t.slice(3);
    else if (l.startsWith('bg=')) out.bg = t.slice(3);
    else if (ATTRS.includes(l)) out.attrs.push(l);
    else if (l === 'italic') out.attrs.push('italics');
    else if (l === 'underline') out.attrs.push('underscore');
    else out.rest.push(t);
  }
  return out;
}

export function formatStyle({ fg, bg, attrs = [], rest = [] }) {
  const parts = [];
  if (fg) parts.push('fg=' + fg);
  if (bg) parts.push('bg=' + bg);
  parts.push(...attrs, ...rest);
  return parts.join(',');
}
