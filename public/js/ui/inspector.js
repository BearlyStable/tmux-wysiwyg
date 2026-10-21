// Contextual editor under the preview: status bar, window tabs, panes, selected widget.

import { h, preserveFocus } from '../util.js';
import { ui, getState, update, refresh } from '../store.js';
import { field, toggle, segmented, select, textInput, numberInput, colorField, attrToggles, styleField, setOption, optionControl } from './controls.js';
import { SEPARATORS, NEEDS_NERD_FONT, optionValue, widgetBody, windowFormats } from '../generator.js';
import { getWidget, widgetParams, widgetPlugin, makeWidget } from '../data/widgets.js';
import { OPTION_MAP } from '../data/options.js';
import { removeWidget } from './preview.js';

const WINDOW_FORMATS = [
  ['#I:#W', '1:name'], ['#I #W', '1 name'], ['#W', 'name'], ['#I', '1'], ['#I:#W#F', '1:name* (flags)'],
  ['#I #{b:pane_current_path}', '1 folder'], ['#I #W#{?window_zoomed_flag, 🔍,}', '1 name 🔍 (zoom)'],
];
const BORDER_FORMATS = [
  ['#{?pane_active,#[reverse],}#{pane_index}#[default] "#{pane_title}"', 'tmux default'],
  [' #P: #{pane_current_command} ', 'number: program'],
  [' #{pane_index} #{b:pane_current_path} ', 'number folder'],
  [' #T ', 'title only'],
];

function findWidget(st, id) {
  for (const side of ['left', 'right']) {
    const i = st.status[side].findIndex((w) => w.id === id);
    if (i >= 0) return { side, index: i, w: st.status[side][i] };
  }
  return null;
}

function withWidget(id, fn, key) {
  update((s) => { const f = findWidget(s, id); if (f) fn(f.w, s, f); }, key);
}

function statusTab(st) {
  const sep = st.status.separator;
  return h('div', { class: 'insp-grid' },
    field('Status bar', toggle(optionValue(st, 'status') !== 'off', (v) => setOption('status', v ? 'on' : 'off', false), { label: optionValue(st, 'status') !== 'off' ? 'visible' : 'hidden' })),
    field('Position', segmented([['top', 'Top'], ['bottom', 'Bottom']], optionValue(st, 'status-position'), (v) => setOption('status-position', v, false))),
    field('Window list', segmented([['left', 'Left'], ['centre', 'Centre'], ['right', 'Right']], optionValue(st, 'status-justify') === 'absolute-centre' ? 'centre' : optionValue(st, 'status-justify'), (v) => setOption('status-justify', v, false))),
    field('Separator style', select(SEPARATORS, sep, (v) => update((s) => { s.status.separator = v; })),
      NEEDS_NERD_FONT.has(sep) ? 'Needs a Nerd Font or Powerline-patched font in your terminal.' : null),
    field('Bar colours', styleField(optionValue(st, 'status-style'), (v) => setOption('status-style', v), { fk: 'status-style' }), null, 'wide'),
    field('Refresh every (s)', numberInput(optionValue(st, 'status-interval'), (v) => setOption('status-interval', v), { fk: 'status-interval', min: 0 }),
      'How often clocks and shell widgets update.'),
    field('Message style', styleField(optionValue(st, 'message-style'), (v) => setOption('message-style', v), { fk: 'message-style' }),
      h('button', { type: 'button', class: 'linkish', onclick: () => { ui.sim.message = !ui.sim.message; refresh(); } }, ui.sim.message ? 'hide sample message' : 'show sample message'), 'wide'),
    h('div', { class: 'insp-actions' },
      h('button', { type: 'button', class: 'btn small', onclick: () => update((s) => { s.status.left = []; }) }, 'Clear left'),
      h('button', { type: 'button', class: 'btn small', onclick: () => update((s) => { s.status.right = []; }) }, 'Clear right'),
      h('button', { type: 'button', class: 'btn small', onclick: () => update((s) => { [s.status.left, s.status.right] = [s.status.right, s.status.left]; }) }, 'Swap sides')));
}

function windowSide(st, key, label) {
  const t = st.status.windows[key];
  const set = (patch, k) => update((s) => Object.assign(s.status.windows[key], patch), k);
  const preset = WINDOW_FORMATS.some(([f]) => f === t.format) ? t.format : '__custom';
  return h('div', { class: 'win-col' },
    h('h4', null, label),
    field('Shows', select([...WINDOW_FORMATS, ['__custom', 'custom…']], preset, (v) => { if (v !== '__custom') set({ format: v }); })),
    field('Format', textInput(t.format, (v) => set({ format: v }, 'wf:' + key), { fk: 'wf:' + key, mono: true }), '#I index · #W name · #F flags · #{b:pane_current_path} folder'),
    field('Text', colorField(t.fg, (fg) => set({ fg }), { fk: 'wfg:' + key })),
    field('Background', colorField(t.bg, (bg) => set({ bg }), { fk: 'wbg:' + key })),
    field('Style', attrToggles(t.attrs || [], (attrs) => set({ attrs }))));
}

function windowsTab(st) {
  const W = st.status.windows;
  if (W.custom) {
    const set = (patch, k) => update((s) => Object.assign(s.status.windows.custom, patch), k);
    return h('div', null,
      h('p', { class: 'note' }, 'These window formats were imported or written by hand. Edit them directly, or switch to the visual editor.'),
      field('Inactive windows (window-status-format)', textInput(W.custom.format, (v) => set({ format: v }, 'cwf'), { fk: 'cwf', mono: true, multiline: true }), null, 'wide'),
      field('Current window (window-status-current-format)', textInput(W.custom.current, (v) => set({ current: v }, 'cwc'), { fk: 'cwc', mono: true, multiline: true }), null, 'wide'),
      field('Separator', textInput(W.custom.separator ?? ' ', (v) => set({ separator: v }, 'cws'), { fk: 'cws', mono: true })),
      field('Inactive style', styleField(optionValue(st, 'window-status-style'), (v) => setOption('window-status-style', v), { fk: 'wss' }), null, 'wide'),
      field('Current style', styleField(optionValue(st, 'window-status-current-style'), (v) => setOption('window-status-current-style', v), { fk: 'wscs' }), null, 'wide'),
      h('button', { type: 'button', class: 'btn', onclick: () => update((s) => { s.status.windows.custom = null; }) }, 'Switch to visual editor'));
  }
  const auto = windowFormats(st).separator;
  return h('div', null,
    h('div', { class: 'win-cols' }, windowSide(st, 'inactive', 'Other windows'), windowSide(st, 'current', 'Current window')),
    h('div', { class: 'insp-grid' },
      field('Gap between tabs', textInput(W.separator ?? '', (v) => update((s) => { s.status.windows.separator = v === '' ? null : v; }, 'wsep'), { fk: 'wsep', mono: true, placeholder: auto === '' ? '(none)' : JSON.stringify(auto) })),
      field('Auto-name windows by folder', toggle(optionValue(st, 'automatic-rename-format') === '#{b:pane_current_path}',
        (v) => update((s) => { if (v) { s.options['automatic-rename-format'] = '#{b:pane_current_path}'; s.options['automatic-rename'] = true; } else delete s.options['automatic-rename-format']; })), 'Instead of the running program.'),
      field('Start numbering at 1', toggle(Number(optionValue(st, 'base-index')) === 1, (v) => update((s) => { s.options['base-index'] = v ? 1 : 0; })), 'base-index'),
      field('Close numbering gaps', toggle(!!optionValue(st, 'renumber-windows'), (v) => update((s) => { s.options['renumber-windows'] = v; })), 'renumber-windows')));
}

function panesTab(st) {
  const dimOn = optionValue(st, 'window-style') === 'fg=colour245,bg=colour236';
  return h('div', { class: 'insp-grid' },
    field('Border', styleField(optionValue(st, 'pane-border-style'), (v) => setOption('pane-border-style', v), { fk: 'pbs' }), null, 'wide'),
    field('Active border', styleField(optionValue(st, 'pane-active-border-style'), (v) => setOption('pane-active-border-style', v), { fk: 'pabs' }), null, 'wide'),
    field('Border lines', optionControl(OPTION_MAP['pane-border-lines']), 'tmux 3.2+'),
    field('Pane titles', segmented([['off', 'Off'], ['top', 'Top'], ['bottom', 'Bottom']], optionValue(st, 'pane-border-status'), (v) => setOption('pane-border-status', v, false))),
    optionValue(st, 'pane-border-status') !== 'off'
      ? field('Title format', h('div', { class: 'stack' },
        select([...BORDER_FORMATS, ['__custom', 'custom…']], BORDER_FORMATS.some(([f]) => f === optionValue(st, 'pane-border-format')) ? optionValue(st, 'pane-border-format') : '__custom',
          (v) => { if (v !== '__custom') setOption('pane-border-format', v, false); }),
        textInput(optionValue(st, 'pane-border-format'), (v) => setOption('pane-border-format', v), { fk: 'pbf', mono: true })), 'Rename a pane with select-pane -T (see the "Rename pane" key recipe).', 'wide')
      : null,
    field('Dim inactive panes', toggle(dimOn, (v) => update((s) => {
      if (v) { s.options['window-style'] = 'fg=colour245,bg=colour236'; s.options['window-active-style'] = 'fg=default,bg=default'; }
      else { delete s.options['window-style']; delete s.options['window-active-style']; }
    })), 'Sets window-style / window-active-style.'),
    field('Inactive pane style', styleField(optionValue(st, 'window-style'), (v) => setOption('window-style', v), { fk: 'ws' }), null, 'wide'),
    field('Active pane style', styleField(optionValue(st, 'window-active-style'), (v) => setOption('window-active-style', v), { fk: 'was' }), null, 'wide'),
    field('Pane numbers start at 1', toggle(Number(optionValue(st, 'pane-base-index')) === 1, (v) => update((s) => { s.options['pane-base-index'] = v ? 1 : 0; })), 'pane-base-index'));
}

function paramControl(w, p) {
  const val = widgetParams(w)[p.key];
  const set = (v) => withWidget(w.id, (x) => { x.params[p.key] = v; }, `wp:${w.id}:${p.key}`);
  const fk = `wp:${w.id}:${p.key}`;
  switch (p.type) {
    case 'bool': return toggle(!!val, set, { fk });
    case 'number': return numberInput(val, set, { fk });
    case 'select': return select(p.options, val, set, { fk });
    case 'colour': return colorField(val, set, { fk });
    case 'textarea': return textInput(val, set, { fk, mono: true, multiline: true });
    default: return textInput(val, set, { fk, suggest: p.suggest, mono: /fmt|cmd|format/.test(p.key) });
  }
}

let peekOpen = false;

function widgetTab(st) {
  const f = ui.selected && findWidget(st, ui.selected.id);
  if (!f) return h('p', { class: 'note' }, 'Click a widget in the status bar to edit it.');
  const { w, side, index } = f;
  const def = getWidget(w.type);
  const plugin = widgetPlugin(w);
  const list = st.status[side];
  const move = (delta) => update((s) => { const l = s.status[side]; const [x] = l.splice(index, 1); l.splice(Math.max(0, Math.min(l.length, index + delta)), 0, x); });
  const otherSide = side === 'left' ? 'right' : 'left';
  return h('div', null,
    h('div', { class: 'widget-head' },
      h('div', null,
        h('h3', null, def.name),
        h('p', { class: 'muted small' }, def.desc),
        plugin ? h('p', { class: 'badge plugin' }, '🔌 needs plugin ', h('code', null, plugin), ' — added to your config automatically') : null),
      h('div', { class: 'widget-actions' },
        h('button', { type: 'button', class: 'btn small', disabled: index === 0, onclick: () => move(-1), title: 'Move left' }, '←'),
        h('button', { type: 'button', class: 'btn small', disabled: index === list.length - 1, onclick: () => move(1), title: 'Move right' }, '→'),
        h('button', { type: 'button', class: 'btn small', onclick: () => update((s) => { const [x] = s.status[side].splice(index, 1); s.status[otherSide].push(x); }) }, `to ${otherSide} side`),
        h('button', { type: 'button', class: 'btn small', onclick: () => update((s) => { const c = { ...JSON.parse(JSON.stringify(w)), id: makeWidget(w.type).id }; s.status[side].splice(index + 1, 0, c); }) }, 'Duplicate'),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => removeWidget(w.id) }, 'Remove'))),
    h('div', { class: 'insp-grid' },
      (def.params || []).map((p) => field(p.label, paramControl(w, p), null, p.type === 'textarea' ? 'wide' : '')),
      field('Icon / label', textInput(w.icon, (v) => withWidget(w.id, (x) => { x.icon = v; }, 'wi:' + w.id), { fk: 'wi:' + w.id, placeholder: 'e.g. ⏰ or CPU', suggest: ['⏰', '📅', '🔋', '☀', '⎇', '❖', '●', '▶', '💻', '🖥', '⚡', '♥'] }), 'Shown before the value.'),
      field('Text colour', colorField(w.fg, (v) => withWidget(w.id, (x) => { x.fg = v; }), { fk: 'wfg:' + w.id })),
      field('Background', colorField(w.bg, (v) => withWidget(w.id, (x) => { x.bg = v; }), { fk: 'wbg:' + w.id })),
      field('Style', attrToggles(w.attrs || [], (attrs) => withWidget(w.id, (x) => { x.attrs = attrs; }))),
      field('Padding', toggle(w.pad !== false, (v) => withWidget(w.id, (x) => { x.pad = v; }), { label: 'space around' }))),
    h('details', { class: 'format-peek', open: peekOpen, ontoggle: (e) => { peekOpen = e.currentTarget.open; } },
      h('summary', null, 'Generated tmux format'),
      h('code', { class: 'mono' }, widgetBody(w))));
}

const TABS = [['status', 'Status bar'], ['windows', 'Window tabs'], ['panes', 'Panes'], ['widget', 'Widget']];

export function renderInspector(root) {
  const st = getState();
  if (ui.tab === 'widget' && !(ui.selected && findWidget(st, ui.selected.id))) ui.tab = 'status';
  preserveFocus(root, () => {
    root.replaceChildren(
      h('div', { class: 'tabs', role: 'tablist' }, TABS.map(([id, label]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(ui.tab === id), class: ui.tab === id ? 'active' : '',
        disabled: id === 'widget' && !ui.selected,
        onclick: () => { ui.tab = id; refresh(); },
      }, label))),
      h('div', { class: 'tab-body', 'data-sk': 'insp' },
        ui.tab === 'status' ? statusTab(st) : ui.tab === 'windows' ? windowsTab(st) : ui.tab === 'panes' ? panesTab(st) : widgetTab(st)));
  });
}
