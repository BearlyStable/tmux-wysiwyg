// Application state: config (undoable, persisted) + ui (ephemeral).

import { defaultState } from './data/themes.js';
import { getWidget } from './data/widgets.js';
import { uid, debounce } from './util.js';

const KEY = 'tmux-wysiwyg/state/v1';
const UI_KEY = 'tmux-wysiwyg/ui/v1';

export const ui = {
  selected: null,           // {kind:'widget', id} | null
  tab: 'status',            // inspector tab
  filter: 'all',            // sidebar filter
  query: '',
  sim: { prefix: false, zoom: false, copy: false, sync: false },
  palette: 'classic',
  activePane: 0,
  outputOpen: true,
  dragging: null,           // {kind:'new', type} | {kind:'chip', id}
};

let state;
let undoStack = [];
let redoStack = [];
let last = { key: null, t: 0 };
const subs = new Set();

export const getState = () => state;
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

function notify() { for (const fn of subs) fn(); }
export const refresh = notify;

const save = debounce(() => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}, 250);

export function saveUi() {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ palette: ui.palette, outputOpen: ui.outputOpen })); } catch { /* ignore */ }
}

/**
 * Mutate state with an undo checkpoint. Calls sharing `key` within 1.2s are
 * coalesced into one undo step (e.g. typing in a field).
 */
export function update(fn, key = null) {
  const now = Date.now();
  if (!(key && key === last.key && now - last.t < 1200)) {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 200) undoStack.shift();
  }
  last = { key, t: now };
  redoStack = [];
  fn(state);
  save();
  notify();
}

export function replaceState(next) {
  undoStack.push(JSON.stringify(state));
  redoStack = [];
  last = { key: null, t: 0 };
  state = normalize(next);
  ui.selected = null;
  save();
  notify();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  last = { key: null, t: 0 };
  save();
  notify();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  last = { key: null, t: 0 };
  save();
  notify();
}

/** Make any loaded/imported/shared object a valid state. */
export function normalize(s) {
  const d = defaultState();
  if (!s || typeof s !== 'object') s = d;
  const out = {
    version: 1,
    theme: typeof s.theme === 'string' ? s.theme : '',
    options: s.options && typeof s.options === 'object' ? { ...s.options } : {},
    status: {
      separator: s.status?.separator || 'plain',
      left: [], right: [],
      windows: {
        inactive: { ...d.status.windows.inactive, ...(s.status?.windows?.inactive || {}) },
        current: { ...d.status.windows.current, ...(s.status?.windows?.current || {}) },
        separator: s.status?.windows?.separator ?? null,
        custom: s.status?.windows?.custom || null,
      },
    },
    bindings: Array.isArray(s.bindings) ? s.bindings.filter((b) => b && typeof b.key === 'string').map((b) => ({
      id: b.id || uid(), key: b.key, command: String(b.command || ''), table: b.table || 'prefix', repeat: !!b.repeat, unbind: !!b.unbind, note: b.note || '',
    })) : [],
    plugins: Array.isArray(s.plugins) ? s.plugins.filter((p) => typeof p === 'string') : [],
    pluginOptions: s.pluginOptions && typeof s.pluginOptions === 'object' ? { ...s.pluginOptions } : {},
    extra: typeof s.extra === 'string' ? s.extra : '',
  };
  for (const side of ['left', 'right']) {
    const list = Array.isArray(s.status?.[side]) ? s.status[side] : [];
    out.status[side] = list.filter((w) => w && getWidget(w.type)).map((w) => ({
      id: w.id || uid(), type: w.type, params: { ...(w.params || {}) }, icon: w.icon ?? '', fg: w.fg || '', bg: w.bg || '',
      attrs: Array.isArray(w.attrs) ? w.attrs : [], pad: w.pad !== false,
    }));
  }
  return out;
}

// ── Share links: state -> deflate -> base64url in the URL hash ──
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function encodeShare(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'j' + b64url(data);
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

export async function decodeShare(str) {
  const kind = str[0];
  const bytes = unb64url(str.slice(1));
  if (kind === 'j') return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

export async function init() {
  try {
    const u = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    if (u) { if (u.palette) ui.palette = u.palette; if (typeof u.outputOpen === 'boolean') ui.outputOpen = u.outputOpen; }
  } catch { /* ignore */ }

  let loaded = null, fromShare = false;
  const m = /[#&]c=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m) {
    try { loaded = await decodeShare(m[1]); fromShare = true; } catch { loaded = null; }
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!loaded) {
    try { loaded = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { loaded = null; }
  }
  state = normalize(loaded || defaultState());
  if (fromShare) save();
  return { fromShare };
}
