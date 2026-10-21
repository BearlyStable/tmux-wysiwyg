// Left panel: search + glossary. Widgets are draggable, options are editable
// in place, recipes/commands add key bindings, plugins can be toggled.

import { h, preserveFocus, uid, toast } from '../util.js';
import { ui, getState, update, refresh } from '../store.js';
import { search, KINDS } from '../search.js';
import { WIDGETS, WIDGET_CATEGORIES } from '../data/widgets.js';
import { OPTIONS, CATEGORIES } from '../data/options.js';
import { RECIPES, COMMANDS, DEFAULT_KEYS } from '../data/commands.js';
import { PLUGINS } from '../data/plugins.js';
import { optionControl, resetOption, isModified, toggle, select, textInput } from './controls.js';
import { startDrag, endDrag, placeWidget, removeWidget } from './preview.js';
import { widgetPluginRepos, optionValue } from '../generator.js';

const FILTERS = [['all', 'All'], ['widget', 'Widgets'], ['option', 'Options'], ['recipe', 'Keys'], ['command', 'Commands'], ['plugin', 'Plugins']];
const TABLES = [['prefix', 'prefix +'], ['root', 'no prefix'], ['copy-mode-vi', 'copy-mode-vi'], ['copy-mode', 'copy-mode']];
let openBindForm = null; // command name with an open "bind to key" form

// ── Cards ──────────────────────────────────────────────────────────────────

function widgetCard(def) {
  const plugin = typeof def.plugin === 'string' ? def.plugin : null;
  return h('div', {
    class: 'card widget-card', draggable: true, title: 'Drag into the status bar',
    ondragstart: (e) => startDrag(e, { kind: 'new', type: def.type }), ondragend: endDrag,
  },
  h('div', { class: 'wc-head' },
    h('span', { class: 'wc-grip', 'aria-hidden': 'true' }, '⠿'),
    h('span', { class: 'wc-name' }, def.name, plugin ? h('span', { class: 'badge plugin', title: 'Uses ' + plugin }, 'plugin') : null),
    h('span', { class: 'wc-actions' },
      h('button', { type: 'button', class: 'btn tiny', title: 'Add to the left side', onclick: () => placeWidget({ kind: 'new', type: def.type }, 'left') }, '+L'),
      h('button', { type: 'button', class: 'btn tiny', title: 'Add to the right side', onclick: () => placeWidget({ kind: 'new', type: def.type }, 'right', 0) }, '+R'))),
  h('div', { class: 'wc-desc' }, def.desc));
}

function optionCard(def) {
  const mod = isModified(def.name);
  return h('div', { class: 'card option-card' + (mod ? ' modified' : '') },
    h('div', { class: 'oc-head' },
      h('code', { class: 'oc-name' }, def.name),
      h('span', { class: 'badge scope' }, def.scope),
      def.since ? h('span', { class: 'badge' }, def.since + '+') : null,
      mod && !def.managed ? h('button', { type: 'button', class: 'linkish small', title: 'Back to tmux default', onclick: () => resetOption(def.name) }, 'reset') : null),
    h('div', { class: 'oc-desc' }, def.desc),
    def.managed
      ? h('button', { type: 'button', class: 'btn tiny', onclick: () => { ui.tab = def.name.startsWith('window') ? 'windows' : 'status'; refresh(); } }, 'Edit in the designer →')
      : h('div', { class: 'oc-control' }, optionControl(def, { fk: 'side-opt:' + def.name })));
}

const sameBinding = (a, b) => a.key === b.key && (a.table || 'prefix') === (b.table || 'prefix') && !!a.unbind === !!b.unbind && (a.unbind || a.command === b.command);

function addBindings(list) {
  const replaced = [];
  update((s) => {
    for (const b of list) {
      const i = s.bindings.findIndex((x) => x.key === b.key && x.table === (b.table || 'prefix') && !!x.unbind === !!b.unbind);
      const nb = { id: uid(), table: 'prefix', repeat: false, unbind: false, note: '', ...b };
      if (i >= 0) { replaced.push(b.key); s.bindings[i] = nb; } else s.bindings.push(nb);
    }
  });
  if (replaced.length) toast(`Replaced existing binding for ${replaced.join(' ')}`);
}

const keyLabel = (b) => (b.table === 'root' ? '' : b.table === 'prefix' || !b.table ? 'prefix ' : b.table + ': ') + b.key;

function recipeCard(r) {
  const st = getState();
  const added = r.bindings.every((b) => st.bindings.some((x) => sameBinding(x, b)));
  return h('div', { class: 'card recipe-card' + (added ? ' added' : '') },
    h('div', { class: 'rc-head' },
      h('span', { class: 'rc-title' }, r.title),
      added
        ? h('button', { type: 'button', class: 'btn tiny on', onclick: () => update((s) => { s.bindings = s.bindings.filter((x) => !r.bindings.some((b) => sameBinding(x, b))); }) }, '✓ added')
        : h('button', { type: 'button', class: 'btn tiny primary', onclick: () => addBindings(r.bindings) }, '+ add')),
    h('div', { class: 'rc-desc' }, r.desc),
    h('div', { class: 'rc-keys' }, r.bindings.slice(0, 4).map((b) => h('div', { class: 'rc-key' },
      h('kbd', null, b.unbind ? 'unbind ' + b.key : keyLabel(b)), b.unbind ? null : h('code', null, b.command))),
    r.bindings.length > 4 ? h('div', { class: 'muted small' }, `…and ${r.bindings.length - 4} more`) : null));
}

function commandCard(c) {
  const open = openBindForm === c.name;
  let key = '', table = 'prefix', command = c.example;
  return h('div', { class: 'card command-card' },
    h('div', { class: 'cc-head' }, h('code', { class: 'oc-name' }, c.name), c.alias ? h('span', { class: 'muted small' }, ' alias ', h('code', null, c.alias)) : null),
    h('div', { class: 'oc-desc' }, c.desc),
    h('code', { class: 'cc-example' }, c.example),
    open
      ? h('form', {
        class: 'bind-form', onsubmit: (e) => {
          e.preventDefault();
          if (!key.trim()) { toast('Enter a key first, e.g. r or C-k', 'warn'); return; }
          addBindings([{ key: key.trim(), table, command }]);
          openBindForm = null;
          toast(`Bound ${key.trim()} → ${c.name}`);
        },
      },
      h('div', { class: 'bf-row' },
        select(TABLES, table, (v) => { table = v; }),
        h('input', { type: 'text', placeholder: 'key, e.g. r, C-k, M-Left', class: 'mono', autocomplete: 'off', oninput: (e) => { key = e.target.value; }, 'data-fk': 'bind-key:' + c.name })),
      h('input', { type: 'text', class: 'mono', value: command, oninput: (e) => { command = e.target.value; } }),
      h('div', { class: 'bf-row' },
        h('button', { type: 'submit', class: 'btn tiny primary' }, 'Add binding'),
        h('button', { type: 'button', class: 'btn tiny', onclick: () => { openBindForm = null; renderSidebar(); } }, 'Cancel')))
      : h('button', { type: 'button', class: 'btn tiny', onclick: () => { openBindForm = c.name; renderSidebar(); setTimeout(() => document.querySelector(`[data-fk="bind-key:${CSS.escape(c.name)}"]`)?.focus()); } }, '⌨ Bind to a key…'));
}

function pluginCard(p) {
  const st = getState();
  const byWidget = widgetPluginRepos(st).has(p.repo);
  const on = byWidget || st.plugins.includes(p.repo);
  const set = (v) => update((s) => { s.plugins = v ? [...new Set([...s.plugins, p.repo])] : s.plugins.filter((x) => x !== p.repo); });
  return h('div', { class: 'card plugin-card' + (on ? ' added' : '') },
    h('div', { class: 'rc-head' },
      h('span', { class: 'rc-title' }, p.name, p.gui ? h('span', { class: 'badge' }, 'status bar') : null),
      byWidget ? h('span', { class: 'badge plugin', title: 'A widget in your status bar uses this plugin' }, 'used by widget') : toggle(on, set)),
    h('div', { class: 'rc-desc' }, p.desc),
    h('a', { class: 'small', href: `https://github.com/${p.repo}`, target: '_blank', rel: 'noopener noreferrer' }, p.repo),
    on && p.options?.length ? h('div', { class: 'plugin-opts' }, p.options.map((o) => pluginOption(o))) : null);
}

function pluginOption(o) {
  const st = getState();
  const v = st.pluginOptions[o.name] ?? o.def;
  const set = (val) => update((s) => { if (val === o.def || val === '') delete s.pluginOptions[o.name]; else s.pluginOptions[o.name] = val; }, 'po:' + o.name);
  let control;
  if (o.type === 'bool') control = toggle(v === true || v === 'on', set);
  else if (o.type === 'enum') control = select(o.values.map((x) => [x, x || '(off)']), v, set);
  else if (o.type === 'number') control = h('input', { type: 'number', value: v, oninput: (e) => set(e.target.value === '' ? o.def : Number(e.target.value)), 'data-fk': 'po:' + o.name });
  else control = textInput(v, set, { fk: 'po:' + o.name, mono: true });
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, h('code', null, o.name)), control, h('span', { class: 'field-help' }, o.desc));
}

// ── Bindings editor ────────────────────────────────────────────────────────

function bindingsEditor() {
  const st = getState();
  const setB = (id, patch, k) => update((s) => { const b = s.bindings.find((x) => x.id === id); if (b) Object.assign(b, patch); }, k);
  const rows = st.bindings.map((b) => {
    const def = (b.table || 'prefix') === 'prefix' && !b.unbind ? DEFAULT_KEYS[b.key] : null;
    const dup = st.bindings.filter((x) => x.key === b.key && x.table === b.table && !!x.unbind === !!b.unbind).length > 1;
    return h('div', { class: 'bind-row' + (b.unbind ? ' unbind' : '') },
      h('div', { class: 'bf-row' },
        select(TABLES, b.table || 'prefix', (v) => setB(b.id, { table: v })),
        h('input', { type: 'text', class: 'mono key', value: b.key, 'data-fk': 'bk:' + b.id, autocomplete: 'off', oninput: (e) => setB(b.id, { key: e.target.value }, 'bk:' + b.id), title: 'Key, e.g. r, C-a, M-Left, F5' }),
        b.unbind ? h('span', { class: 'muted small' }, 'unbind') : h('label', { class: 'small muted', title: 'Repeatable without pressing prefix again (-r)' },
          h('input', { type: 'checkbox', checked: b.repeat, onchange: (e) => setB(b.id, { repeat: e.target.checked }) }), ' repeat'),
        h('button', { type: 'button', class: 'icon-btn', title: 'Delete binding', onclick: () => update((s) => { s.bindings = s.bindings.filter((x) => x.id !== b.id); }) }, '✕')),
      b.unbind ? null : h('input', { type: 'text', class: 'mono', value: b.command, 'data-fk': 'bc:' + b.id, autocomplete: 'off', spellcheck: 'false', placeholder: 'tmux command', oninput: (e) => setB(b.id, { command: e.target.value }, 'bc:' + b.id) }),
      def ? h('div', { class: 'warn small' }, `replaces tmux default: ${def}`) : null,
      dup ? h('div', { class: 'warn small' }, 'duplicate key — the last one wins') : null);
  });
  return h('div', { class: 'bindings' },
    h('div', { class: 'card option-card' },
      h('div', { class: 'oc-head' }, h('code', { class: 'oc-name' }, 'prefix'), isModified('prefix') ? h('button', { type: 'button', class: 'linkish small', onclick: () => resetOption('prefix') }, 'reset') : null),
      h('div', { class: 'oc-desc' }, 'The key you press before every shortcut below. C-a = Ctrl+a.'),
      h('div', { class: 'oc-control' }, select(['C-b', 'C-a', 'C-Space', 'C-s', 'C-q', 'C-x', 'M-a', '`'], optionValue(st, 'prefix'), (v) => update((s) => { if (v === 'C-b') delete s.options.prefix; else s.options.prefix = v; })))),
    h('h3', { class: 'group' }, `Your key bindings (${st.bindings.length})`),
    rows.length ? rows : h('p', { class: 'muted small' }, 'None yet — add a recipe below or bind any command.'),
    h('button', { type: 'button', class: 'btn tiny', onclick: () => update((s) => { s.bindings.push({ id: uid(), key: '', command: '', table: 'prefix', repeat: false, unbind: false, note: '' }); }) }, '+ empty binding'),
    h('details', { class: 'small muted defaults' }, h('summary', null, 'tmux default keys'),
      h('div', { class: 'default-keys' }, Object.entries(DEFAULT_KEYS).map(([k, v]) => h('div', null, h('kbd', null, k), ' ', v)))));
}

// ── Lists ──────────────────────────────────────────────────────────────────

const group = (title, cards) => [h('h3', { class: 'group' }, title), ...cards];

function browse() {
  switch (ui.filter) {
    case 'option': return CATEGORIES.flatMap((cat) => group(cat, OPTIONS.filter((o) => o.cat === cat).map(optionCard)));
    case 'recipe': return [bindingsEditor(), ...['Panes', 'Windows', 'Sessions', 'Copy mode', 'Interaction', 'Status bar', 'Config'].flatMap((cat) => group('Recipes · ' + cat, RECIPES.filter((r) => r.cat === cat).map(recipeCard)))];
    case 'command': return [...new Set(COMMANDS.map((c) => c.cat))].flatMap((cat) => group(cat, COMMANDS.filter((c) => c.cat === cat).map(commandCard)));
    case 'plugin': return [
      h('p', { class: 'note' }, 'Plugins are installed with TPM. The config includes the TPM bootstrap automatically; status-bar plugins are added when you use their widget.'),
      ...group('Status bar plugins', PLUGINS.filter((p) => p.gui).map(pluginCard)),
      ...group('Other plugins', PLUGINS.filter((p) => !p.gui).map(pluginCard))];
    default: return [
      ui.filter === 'all' ? h('p', { class: 'note' }, 'Search anything: "battery", "pane", "mouse", "rename", "prefix"… Drag widgets into the status bar →') : null,
      ...WIDGET_CATEGORIES.flatMap((cat) => group(cat, WIDGETS.filter((w) => w.cat === cat).map(widgetCard)))];
  }
}

const CARD = { widget: widgetCard, option: optionCard, recipe: recipeCard, command: commandCard, plugin: pluginCard };

function results() {
  const res = search(ui.query, ui.filter);
  if (!res.length) return [h('p', { class: 'empty' }, `Nothing for “${ui.query}”. Try "battery", "pane", "split", "colour"…`)];
  if (ui.filter !== 'all') return res.slice(0, 80).map((r) => CARD[r.kind](r.item));
  const out = [];
  for (const [kind, label] of KINDS) {
    const list = res.filter((r) => r.kind === kind);
    if (!list.length) continue;
    out.push(h('h3', { class: 'group' }, label, h('span', { class: 'count' }, list.length)));
    out.push(...list.slice(0, 12).map((r) => CARD[kind](r.item)));
    if (list.length > 12) out.push(h('button', { type: 'button', class: 'linkish small more', onclick: () => { ui.filter = kind; renderSidebar(); } }, `show all ${list.length} ${label.toLowerCase()} →`));
  }
  return out;
}

let root = null;
export function renderSidebar(el) {
  if (el) root = el;
  if (!root) return;
  preserveFocus(root, () => {
    root.replaceChildren(
      h('div', { class: 'search' },
        h('input', {
          type: 'search', id: 'search', placeholder: 'Search… battery, pane, mouse, rename', value: ui.query, 'data-fk': 'search', autocomplete: 'off', spellcheck: 'false',
          'aria-label': 'Search widgets, options, key bindings, commands and plugins',
          oninput: (e) => { ui.query = e.target.value; renderSidebar(); },
          onkeydown: (e) => { if (e.key === 'Escape') { ui.query = ''; renderSidebar(); } },
        }),
        h('kbd', { class: 'search-kbd', title: 'Press / to search' }, '/')),
      h('div', { class: 'filters', role: 'tablist' }, FILTERS.map(([k, l]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(ui.filter === k), class: ui.filter === k ? 'active' : '',
        onclick: () => { ui.filter = k; renderSidebar(); root.querySelector('.results').scrollTop = 0; },
      }, l))),
      h('div', {
        class: 'results', 'data-sk': 'results:' + ui.filter + ':' + (ui.query ? 'q' : 'b'),
        ondragover: (e) => { if (ui.dragging?.kind === 'chip') e.preventDefault(); },
        ondrop: (e) => { if (ui.dragging?.kind !== 'chip') return; e.preventDefault(); const id = ui.dragging.id; endDrag(); removeWidget(id); },
      }, ui.query.trim() ? results() : browse()));
  });
}
