// The WYSIWYG terminal: status bar rendered from the generated formats,
// fake panes styled by the pane options, and drag & drop for widgets.

import { h, $$ } from '../util.js';
import { ui, getState, update, refresh, saveUi } from '../store.js';
import { PALETTES, colorToCss, parseStyle } from '../colors.js';
import { renderRuns, runsToNodes } from '../format.js';
import { buildSide, windowFormats, statusBase, optionValue } from '../generator.js';
import { getWidget, widgetParams, makeWidget } from '../data/widgets.js';
import { THEMES } from '../data/themes.js';

const WINDOWS = [
  { name: 'zsh', cmd: 'zsh' },
  { name: 'nvim', cmd: 'nvim', current: true },
  { name: 'logs', cmd: 'tail' },
];
const PANES = [
  { title: 'devbox', cmd: 'nvim' },
  { title: 'devbox', cmd: 'zsh' },
  { title: 'devbox', cmd: 'tail' },
];

function guessCmd(cmd) {
  if (/whoami/.test(cmd)) return 'you';
  if (/wttr|weather/.test(cmd)) return '☀️ +18°C';
  if (/git/.test(cmd)) return 'main';
  if (/uptime/.test(cmd)) return '0.52 0.48 0.40';
  if (/hostname/.test(cmd)) return 'devbox';
  if (/date/.test(cmd)) return new Date().toLocaleDateString();
  if (/battery|pmset|acpi/.test(cmd)) return '87%';
  if (/kubectl/.test(cmd)) return 'prod-eu';
  const short = cmd.trim().split(/\s+/)[0] || 'cmd';
  return `‹${short.split('/').pop().slice(0, 14)}›`;
}

const flag = (b) => (b ? '1' : '0');

function baseVars(st, extra = {}) {
  const bi = Number(optionValue(st, 'base-index')) || 0;
  const pbi = Number(optionValue(st, 'pane-base-index')) || 0;
  const cur = WINDOWS.findIndex((w) => w.current);
  const pane = PANES[ui.activePane] || PANES[0];
  return {
    session_name: 'main', session_windows: String(WINDOWS.length), server_sessions: '2', session_attached: '1',
    host: 'devbox.example.com', host_short: 'devbox',
    window_index: String(bi + cur), window_name: WINDOWS[cur].name, window_flags: ui.sim.zoom ? '*Z' : '*',
    window_active: '1', window_zoomed_flag: flag(ui.sim.zoom), window_last_flag: '0', window_bigger: '0', window_panes: '3',
    pane_index: String(pbi + ui.activePane), pane_title: pane.title, pane_current_command: pane.cmd, pane_id: '%' + (ui.activePane + 3),
    pane_current_path: '/home/you/projects/tmux-wysiwyg', pane_in_mode: flag(ui.sim.copy), pane_synchronized: flag(ui.sim.sync),
    pane_active: '1', pane_dead: '0', client_prefix: flag(ui.sim.prefix), mouse: flag(optionValue(st, 'mouse') === true || optionValue(st, 'mouse') === 'on'),
    session_alerts: '', ...extra,
  };
}

function optionsCtx(st) {
  const o = {};
  for (const [k, v] of Object.entries(st.options)) o[k] = typeof v === 'boolean' ? flag(v) : String(v);
  o['synchronize-panes'] = flag(ui.sim.sync);
  return o;
}

function widgetCtx(st, w, now) {
  const def = w ? getWidget(w.type) : null;
  const p = w ? widgetParams(w) : {};
  return {
    vars: { ...baseVars(st), ...(def?.vars ? def.vars(ui.sim) : {}) },
    options: optionsCtx(st),
    time: now,
    cmd: (c) => (def?.sampleFrom ? def.sampleFrom(p) || guessCmd(c) : def?.sample ?? guessCmd(c)),
  };
}

const merge = (base, styleStr) => {
  const s = parseStyle(styleStr === 'default' ? '' : styleStr);
  return { fg: s.fg || base.fg, bg: s.bg || base.bg, attrs: [...new Set([...base.attrs, ...s.attrs])] };
};

// ── Drag & drop ────────────────────────────────────────────────────────────

let caret = null;
function showCaret(zone, idx) {
  if (!caret) caret = h('div', { class: 'drop-caret' });
  const chips = $$(':scope > .chip', zone).filter((c) => c.dataset.id !== draggedId());
  let x;
  const zr = zone.getBoundingClientRect();
  if (!chips.length) x = zone.dataset.side === 'right' ? zr.right - 2 : zr.left;
  else if (idx >= chips.length) x = chips[chips.length - 1].getBoundingClientRect().right;
  else x = chips[idx].getBoundingClientRect().left;
  const host = zone.closest('.term');
  const hr = host.getBoundingClientRect();
  caret.style.left = (x - hr.left - 1) + 'px';
  caret.style.top = (zr.top - hr.top) + 'px';
  caret.style.height = zr.height + 'px';
  if (caret.parentNode !== host) host.append(caret);
}
function hideCaret() { caret?.remove(); }
const draggedId = () => (ui.dragging?.kind === 'chip' ? ui.dragging.id : null);

function dropIndex(zone, x) {
  const chips = $$(':scope > .chip', zone).filter((c) => c.dataset.id !== draggedId());
  let i = 0;
  for (const c of chips) { const r = c.getBoundingClientRect(); if (x > r.left + r.width / 2) i++; }
  return i;
}

export function startDrag(e, payload) {
  ui.dragging = payload;
  e.dataTransfer.effectAllowed = 'copyMove';
  e.dataTransfer.setData('text/plain', payload.kind === 'new' ? payload.type : payload.id);
  setTimeout(() => { if (ui.dragging === payload) document.body.classList.add('dragging', payload.kind === 'chip' ? 'dragging-chip' : 'dragging-new'); });
}
export function endDrag() {
  ui.dragging = null;
  document.body.classList.remove('dragging', 'dragging-chip', 'dragging-new');
  $$('.drop-hover').forEach((n) => n.classList.remove('drop-hover'));
  hideCaret();
}

function themedWidget(s, type, side) {
  const w = makeWidget(type);
  const th = THEMES.find((t) => t.id === s.theme);
  if (th?.accents.length) { w.bg = th.accents[s.status[side].length % th.accents.length]; w.fg = th.dark; }
  else if (th?.accentFg) w.fg = th.accentFg[s.status[side].length % th.accentFg.length];
  return w;
}

/** Insert a new widget or move an existing one. */
export function placeWidget(payload, side, idx = Infinity, position = null) {
  let placed = null;
  update((s) => {
    let w;
    if (payload.kind === 'new') w = themedWidget(s, payload.type, side);
    else {
      for (const sd of ['left', 'right']) {
        const i = s.status[sd].findIndex((x) => x.id === payload.id);
        if (i >= 0) w = s.status[sd].splice(i, 1)[0];
      }
    }
    if (!w) return;
    const list = s.status[side];
    list.splice(Math.min(idx, list.length), 0, w);
    if (position) s.options['status-position'] = position;
    placed = w;
  });
  if (placed) { ui.selected = { kind: 'widget', id: placed.id }; ui.tab = 'widget'; refresh(); }
}

export function removeWidget(id) {
  update((s) => { for (const sd of ['left', 'right']) s.status[sd] = s.status[sd].filter((w) => w.id !== id); });
  if (ui.selected?.id === id) { ui.selected = null; ui.tab = 'status'; refresh(); }
}

function zoneHandlers(side, position = null) {
  return {
    ondragover: (e) => {
      if (!ui.dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = ui.dragging.kind === 'chip' ? 'move' : 'copy';
      const zone = e.currentTarget;
      zone.classList.add('drop-hover');
      if (zone.classList.contains('zone')) showCaret(zone, dropIndex(zone, e.clientX));
    },
    ondragleave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) { e.currentTarget.classList.remove('drop-hover'); hideCaret(); } },
    ondrop: (e) => {
      if (!ui.dragging) return;
      e.preventDefault();
      e.stopPropagation();
      const zone = e.currentTarget;
      const idx = zone.classList.contains('zone') ? dropIndex(zone, e.clientX) : (side === 'left' ? Infinity : 0);
      const payload = ui.dragging;
      endDrag();
      placeWidget(payload, side, idx, position);
    },
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function renderZone(st, side, pal, now, base) {
  const parts = buildSide(st, side);
  const S = statusBase(st);
  const termFg = pal.fg, termBg = pal.bg;
  const fgBase = colorToCss(base.fg, pal, colorToCss(S.fg, pal, termFg));
  const bgBase = colorToCss(base.bg, pal, colorToCss(S.bg, pal, termBg));
  const zone = h('div', { class: 'zone zone-' + side, 'data-side': side, ...zoneHandlers(side) });
  let carry = null;
  const byId = Object.fromEntries(st.status[side].map((w) => [w.id, w]));
  for (const part of parts) {
    const w = part.id ? byId[part.id] : null;
    const runs = renderRuns(part.fmt, widgetCtx(st, w, now), base, carry);
    carry = runs.end;
    const nodes = runsToNodes(runs, pal, fgBase, bgBase);
    if (!w) { zone.append(h('span', { class: 'glue' }, nodes)); continue; }
    const def = getWidget(w.type);
    const selected = ui.selected?.kind === 'widget' && ui.selected.id === w.id;
    const chip = h('span', {
      class: 'chip' + (selected ? ' selected' : ''), draggable: true, 'data-id': w.id, tabindex: 0,
      title: `${def.name} — drag to move, click to edit`,
      ondragstart: (e) => { e.stopPropagation(); startDrag(e, { kind: 'chip', id: w.id }); },
      ondragend: endDrag,
      onclick: (e) => { e.stopPropagation(); ui.selected = { kind: 'widget', id: w.id }; ui.tab = 'widget'; refresh(); },
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.selected = { kind: 'widget', id: w.id }; ui.tab = 'widget'; refresh(); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeWidget(w.id); }
      },
    }, nodes);
    if (!runs.some((r) => r.text.trim())) chip.classList.add('chip-empty');
    zone.append(chip);
  }
  if (!st.status[side].length) zone.append(h('span', { class: 'zone-empty' }, side === 'left' ? '⇢ drop widgets here' : 'drop widgets here ⇠'));
  return zone;
}

function renderWindows(st, pal, now) {
  const S = statusBase(st);
  const wf = windowFormats(st);
  const winBase = merge(S, optionValue(st, 'window-status-style'));
  const bi = Number(optionValue(st, 'base-index')) || 0;
  const wrap = h('div', {
    class: 'windows', title: 'Window tabs — click to style them',
    onclick: (e) => { e.stopPropagation(); ui.tab = 'windows'; refresh(); },
  });
  const sepRuns = renderRuns(wf.separator, { vars: {}, time: false }, S);
  WINDOWS.forEach((win, i) => {
    if (i > 0 && wf.separator) wrap.append(runsToNodes(sepRuns, pal, colorToCss(S.fg, pal, pal.fg), colorToCss(S.bg, pal, pal.bg)));
    const last = i === 0;
    let base = win.current ? merge(winBase, optionValue(st, 'window-status-current-style')) : winBase;
    if (last && !win.current) base = merge(base, optionValue(st, 'window-status-last-style'));
    const flags = win.current ? (ui.sim.zoom ? '*Z' : '*') : last ? '-' : '';
    const vars = baseVars(st, {
      window_index: String(bi + i), window_name: win.name, window_flags: flags, window_active: flag(win.current),
      window_last_flag: flag(last && !win.current), window_zoomed_flag: flag(win.current && ui.sim.zoom), pane_current_command: win.cmd,
    });
    const runs = renderRuns(win.current ? wf.current : wf.format, { vars, options: optionsCtx(st), time: false, cmd: guessCmd }, base);
    wrap.append(h('span', { class: 'win' + (win.current ? ' current' : '') },
      runsToNodes(runs, pal, colorToCss(base.fg, pal, pal.fg), colorToCss(base.bg, pal, pal.bg))));
  });
  return wrap;
}

function renderStatusBar(st, pal, now) {
  const S = statusBase(st);
  const justify = optionValue(st, 'status-justify');
  const leftBase = merge(S, optionValue(st, 'status-left-style'));
  const rightBase = merge(S, optionValue(st, 'status-right-style'));
  const bar = h('div', {
    class: 'statusbar justify-' + justify,
    style: { background: colorToCss(S.bg, pal, pal.bg), color: colorToCss(S.fg, pal, pal.fg) },
    onclick: () => { ui.tab = 'status'; ui.selected = null; refresh(); },
    ondragover: (e) => {
      if (!ui.dragging || e.target.closest('.zone')) return;
      e.preventDefault();
    },
    ondrop: (e) => {
      if (!ui.dragging || e.target.closest('.zone')) return;
      e.preventDefault();
      const r = bar.getBoundingClientRect();
      const side = e.clientX < r.left + r.width / 2 ? 'left' : 'right';
      const payload = ui.dragging;
      endDrag();
      placeWidget(payload, side, side === 'left' ? Infinity : 0);
    },
  },
  renderZone(st, 'left', pal, now, leftBase),
  renderWindows(st, pal, now),
  renderZone(st, 'right', pal, now, rightBase));
  if (ui.sim.message) {
    const m = merge({ fg: 'default', bg: 'default', attrs: [] }, optionValue(st, 'message-style'));
    const runs = renderRuns('Config reloaded', { vars: {}, time: false }, m);
    bar.append(h('div', { class: 'message', style: { background: colorToCss(m.bg, pal, pal.bg) } },
      runsToNodes(runs, pal, colorToCss(m.fg, pal, pal.fg), colorToCss(m.bg, pal, pal.bg))));
  }
  return bar;
}

function ghostBar(position) {
  return h('div', { class: 'ghostbar ghost-' + position },
    h('div', { class: 'ghost-half', ...zoneHandlers('left', position) }, `⇡ drop here: bar on ${position}, left side`),
    h('div', { class: 'ghost-half', ...zoneHandlers('right', position) }, `bar on ${position}, right side ⇡`));
}

// Fake pane contents (colour indexes into the ANSI palette).
function paneLines(i, pal) {
  const c = (n) => pal.ansi[n];
  const L = (...segs) => h('div', { class: 'pl-line' }, segs.map(([t, col, b]) => h('span', { style: { color: col || 'inherit', fontWeight: b ? 700 : 400 } }, t)));
  if (i === 0) {
    const code = [
      [['import ', c(5)], ['{ serve } ', null], ['from ', c(5)], ["'./server.js'", c(2)]],
      [],
      [['const ', c(5)], ['port ', c(4)], ['= ', null], ['process', c(3)], ['.env.', null], ['PORT ', c(4)], ['?? ', null], ['8080', c(3)]],
      [['serve', c(4)], ['({ port, root: ', null], ["'public'", c(2)], [' })', null]],
      [],
      [['// TODO: ', c(8)], ['ship it 🚀', c(8)]],
    ];
    return code.map((segs, n) => L([String(n + 1).padStart(3) + ' ', c(8)], ...segs));
  }
  if (i === 1) {
    return [
      L(['you@devbox', c(2), true], [' ~/projects/tmux-wysiwyg ', c(4)], ['(main)', c(5)], [' $ ', null], ['ls', null]),
      L(['Dockerfile  ', null], ['public/  ', c(4), true], ['server/  ', c(4), true], ['README.md', null]),
      L(['you@devbox', c(2), true], [' ~/projects/tmux-wysiwyg ', c(4)], ['(main)', c(5)], [' $ ', null], ['▋', null]),
    ];
  }
  return [
    L(['12:00:01 ', c(8)], ['GET  ', c(2)], ['/          200 ', null], ['3ms', c(8)]),
    L(['12:00:02 ', c(8)], ['GET  ', c(2)], ['/js/main.js 200 ', null], ['1ms', c(8)]),
    L(['12:00:05 ', c(8)], ['POST ', c(3)], ['/api       404 ', c(1)], ['2ms', c(8)]),
  ];
}

function renderPanes(st, pal) {
  const S = (n) => parseStyle(optionValue(st, n) === 'default' ? '' : optionValue(st, n));
  const border = S('pane-border-style');
  const active = S('pane-active-border-style');
  const lines = optionValue(st, 'pane-border-lines');
  const status = optionValue(st, 'pane-border-status');
  const fmt = optionValue(st, 'pane-border-format');
  const winStyle = S('window-style');
  const winActive = S('window-active-style');
  const pbi = Number(optionValue(st, 'pane-base-index')) || 0;
  const a = ui.activePane;
  const bc = (isActive) => colorToCss(isActive ? active.fg : border.fg, pal, isActive ? pal.ansi[2] : pal.fg);
  const bbg = (isActive) => colorToCss(isActive ? active.bg : border.bg, pal, pal.bg);

  const pane = (i) => {
    const isA = i === a;
    const fg = colorToCss((isA && winActive.fg) || winStyle.fg, pal, pal.fg);
    const bg = colorToCss((isA && winActive.bg) || winStyle.bg, pal, pal.bg);
    let title = null;
    if (status === 'top' || status === 'bottom') {
      const base = { fg: (isA ? active.fg : border.fg) || 'default', bg: (isA ? active.bg : border.bg) || 'default', attrs: [] };
      const vars = baseVars(st, { pane_index: String(pbi + i), pane_title: PANES[i].title, pane_active: flag(isA), pane_current_command: PANES[i].cmd });
      const runs = renderRuns(fmt, { vars, options: optionsCtx(st), time: false, cmd: guessCmd }, base);
      title = h('div', { class: 'pane-title lines-' + lines, style: { color: bc(isA), backgroundColor: bbg(isA) } },
        h('span', { class: 'pt-text' }, runsToNodes(runs, pal, bc(isA), bbg(isA))));
    }
    const body = h('div', { class: 'pane-body' }, paneLines(i, pal));
    if (isA && ui.sim.copy) {
      const ms = merge({ fg: 'default', bg: 'default', attrs: [] }, optionValue(st, 'mode-style'));
      body.append(h('div', { class: 'copy-pos', style: { color: colorToCss(ms.fg, pal, pal.fg), background: colorToCss(ms.bg, pal, pal.bg) } }, '[0/1204]'));
    }
    return h('div', {
      class: `pane pane-${i}${isA ? ' active' : ''} title-${status}`, style: { color: fg, background: bg },
      onclick: (e) => { e.stopPropagation(); ui.activePane = i; ui.tab = 'panes'; refresh(); },
    }, status === 'top' ? title : null, body, status === 'bottom' ? title : null);
  };

  if (ui.sim.zoom) return h('div', { class: 'panes zoomed' }, pane(a));

  const vb = (cls, isActive) => h('div', { class: `border v ${cls} lines-${lines}`, style: { color: bc(isActive), backgroundColor: bbg(isActive) } });
  const hb = (cls, isActive) => h('div', { class: `border hz ${cls} lines-${lines}`, style: { color: bc(isActive), backgroundColor: bbg(isActive) } });
  return h('div', { class: 'panes' },
    pane(0),
    vb('b-vtop', a === 0 || a === 1),
    vb('b-vmid', true),
    vb('b-vbot', a === 0 || a === 2),
    pane(1),
    hb('b-h', a === 1 || a === 2),
    pane(2));
}

const SIMS = [['prefix', 'Prefix pressed'], ['zoom', 'Zoomed'], ['copy', 'Copy mode'], ['sync', 'Sync panes'], ['message', 'Message']];

export function renderPreview(root) {
  const st = getState();
  const pal = PALETTES[ui.palette] || PALETTES.classic;
  const now = new Date();
  const statusOn = optionValue(st, 'status') !== 'off';
  const pos = optionValue(st, 'status-position') === 'top' ? 'top' : 'bottom';
  const bar = statusOn ? renderStatusBar(st, pal, now) : null;

  const term = h('div', {
    class: 'term pos-' + pos, style: { background: pal.bg, color: pal.fg },
  },
  statusOn ? ghostBar(pos === 'top' ? 'bottom' : 'top') : null,
  pos === 'top' ? bar : null,
  renderPanes(st, pal),
  pos === 'bottom' ? bar : null,
  !statusOn ? h('div', { class: 'status-off' }, 'status bar is off', h('button', { type: 'button', onclick: () => update((s) => { s.options.status = 'on'; }) }, 'turn on')) : null,
  h('div', {
    class: 'trash',
    ondragover: (e) => { if (ui.dragging?.kind === 'chip') { e.preventDefault(); e.currentTarget.classList.add('drop-hover'); } },
    ondragleave: (e) => e.currentTarget.classList.remove('drop-hover'),
    ondrop: (e) => { if (ui.dragging?.kind !== 'chip') return; e.preventDefault(); const id = ui.dragging.id; endDrag(); removeWidget(id); },
  }, '🗑 drop here to remove'));

  root.replaceChildren(
    h('div', { class: 'preview-toolbar' },
      h('div', { class: 'sims', role: 'group', 'aria-label': 'Simulate state' },
        h('span', { class: 'muted small' }, 'Simulate:'),
        SIMS.map(([k, label]) => h('button', {
          type: 'button', class: 'chiptoggle' + (ui.sim[k] ? ' on' : ''), 'aria-pressed': String(!!ui.sim[k]),
          onclick: () => { ui.sim[k] = !ui.sim[k]; refresh(); },
        }, label))),
      h('label', { class: 'palette-pick small muted' }, 'Terminal palette ',
        h('select', { onchange: (e) => { ui.palette = e.target.value; saveUi(); refresh(); } },
          Object.entries(PALETTES).map(([k, p]) => h('option', { value: k, selected: k === ui.palette }, p.name))))),
    term,
    h('p', { class: 'hint' }, 'Drag widgets from the left into the status bar. Drop on the dashed strip to move the bar to the ',
      pos === 'top' ? 'bottom' : 'top', '. Click anything in the preview to edit it.'));
}

/** True if any visible widget shows seconds, so the clock needs a 1s tick. */
export function needsSecondTick(st) {
  return ['left', 'right'].some((side) => st.status[side].some((w) => (w.type === 'time' || w.type === 'date' || w.type === 'format') &&
    /%[STsrc]/.test(JSON.stringify(w.params))));
}
