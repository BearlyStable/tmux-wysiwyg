// Reusable form controls: colour picker, style editor, option editors.

import { h } from '../util.js';
import { ALL_NAMED, PALETTES, colorToCss, xterm256, parseStyle, formatStyle, isValidColor } from '../colors.js';
import { ui, update, getState } from '../store.js';
import { optionValue } from '../generator.js';

export const field = (label, control, help, extraClass = '') =>
  h('div', { class: 'field ' + extraClass }, h('span', { class: 'field-label' }, label), control, help ? h('span', { class: 'field-help' }, help) : null);

export function toggle(checked, onChange, { fk, label } = {}) {
  return h('label', { class: 'toggle' + (checked ? ' on' : '') },
    h('input', { type: 'checkbox', checked: !!checked, 'data-fk': fk, onchange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'toggle-track' }, h('span', { class: 'toggle-thumb' })),
    label ? h('span', { class: 'toggle-label' }, label) : null);
}

export function segmented(options, value, onChange, { small } = {}) {
  return h('div', { class: 'segmented' + (small ? ' small' : ''), role: 'radiogroup' },
    options.map(([v, label]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'active' : '',
      onclick: () => onChange(v),
    }, label)));
}

export function select(options, value, onChange, { fk } = {}) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  if (value != null && !opts.some(([v]) => String(v) === String(value))) opts.unshift([value, String(value)]);
  return h('select', { 'data-fk': fk, onchange: (e) => onChange(e.target.value) },
    opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
}

export function textInput(value, onChange, { fk, placeholder, mono, live = true, suggest, coalesce, multiline } = {}) {
  const listId = suggest ? 'dl-' + Math.random().toString(36).slice(2) : null;
  const handler = (e) => onChange(e.target.value, coalesce);
  const attrs = {
    value: value ?? '', placeholder, 'data-fk': fk, class: mono ? 'mono' : '', spellcheck: 'false', autocomplete: 'off',
    list: listId, [live ? 'oninput' : 'onchange']: handler,
  };
  const el = multiline ? h('textarea', { ...attrs, rows: 3 }) : h('input', { type: 'text', ...attrs });
  if (!suggest) return el;
  return h('span', { class: 'with-list' }, el, h('datalist', { id: listId }, suggest.map((s) => h('option', { value: s }))));
}

export function numberInput(value, onChange, { fk, min, max, step = 1 } = {}) {
  return h('input', {
    type: 'number', value: value ?? '', min, max, step, 'data-fk': fk,
    oninput: (e) => { if (e.target.value !== '') onChange(Number(e.target.value)); },
  });
}

// ── Colour picker ───────────────────────────────────────────────────────────

let pop = null;
function closePopover() {
  if (pop) { pop.remove(); pop = null; document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', onKey, true); }
}
function outside(e) { if (pop && !pop.contains(e.target)) closePopover(); }
function onKey(e) { if (e.key === 'Escape') closePopover(); }

function openPopover(anchor, current, onPick) {
  closePopover();
  const pal = PALETTES[ui.palette];
  const pick = (c) => { onPick(c); closePopover(); };
  const sw = (c, title, label) => h('button', {
    type: 'button', class: 'sw' + (c === current ? ' current' : '') + (c === '' || c === 'default' ? ' sw-default' : ''),
    title: title || c, style: { background: colorToCss(c, pal, 'transparent') }, onclick: () => pick(c),
  }, label || '');
  const cube = [];
  for (let n = 16; n < 256; n++) cube.push(sw('colour' + n));
  const hex = /^#[0-9a-f]{6}$/i.test(current) ? current : colorToCss(current, pal, '#888888');
  pop = h('div', { class: 'colorpop', role: 'dialog', 'aria-label': 'Pick a colour' },
    h('div', { class: 'cp-row' },
      sw('', 'Inherit (default)', 'auto'),
      h('input', {
        type: 'color', value: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#888888', title: 'Custom hex colour',
        onchange: (e) => pick(e.target.value),
      }),
      h('span', { class: 'cp-hint' }, 'hex needs true-colour (terminal-features RGB)')),
    h('div', { class: 'cp-title' }, 'Terminal colours (follow your terminal theme)'),
    h('div', { class: 'cp-grid cp-16' }, ALL_NAMED.map((c) => sw(c))),
    h('div', { class: 'cp-title' }, '256 colours'),
    h('div', { class: 'cp-grid cp-256' }, cube));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - pw - 8);
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.top = top + 'px';
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey, true);
  });
}

export function colorField(value, onChange, { fk, placeholder = 'auto' } = {}) {
  const pal = PALETTES[ui.palette];
  const valid = isValidColor(value);
  const swatch = h('button', {
    type: 'button', class: 'swatch' + (!value || value === 'default' ? ' sw-default' : ''), title: 'Pick colour',
    style: { background: colorToCss(value, pal, 'transparent') },
    onclick: (e) => openPopover(e.currentTarget, value || '', onChange),
  });
  return h('span', { class: 'colorfield' + (valid ? '' : ' invalid') }, swatch,
    h('input', {
      type: 'text', value: value || '', placeholder, 'data-fk': fk, spellcheck: 'false', autocomplete: 'off', class: 'mono',
      title: 'Name (red, brightblue), colour0–255, #rrggbb or default',
      onchange: (e) => onChange(e.target.value.trim()),
    }));
}

const ATTR_BTNS = [['bold', 'B', 'Bold'], ['italics', 'I', 'Italic'], ['underscore', 'U', 'Underline'], ['dim', 'D', 'Dim'], ['reverse', 'R', 'Reverse']];

export function attrToggles(attrs, onChange) {
  return h('span', { class: 'attrs' }, ATTR_BTNS.map(([a, l, t]) => h('button', {
    type: 'button', class: 'attr attr-' + a + (attrs.includes(a) ? ' on' : ''), title: t, 'aria-pressed': String(attrs.includes(a)),
    onclick: () => onChange(attrs.includes(a) ? attrs.filter((x) => x !== a) : [...attrs, a]),
  }, l)));
}

/** Editor for a tmux style string like "fg=red,bg=black,bold". */
export function styleField(value, onChange, { fk } = {}) {
  const st = parseStyle(value === 'default' ? '' : value);
  const set = (patch) => {
    const out = formatStyle({ ...st, ...patch });
    onChange(out || 'default');
  };
  return h('div', { class: 'stylefield' },
    h('span', { class: 'sf-part' }, h('span', { class: 'sf-label' }, 'text'), colorField(st.fg, (fg) => set({ fg }), { fk: fk + ':fg' })),
    h('span', { class: 'sf-part' }, h('span', { class: 'sf-label' }, 'bg'), colorField(st.bg, (bg) => set({ bg }), { fk: fk + ':bg' })),
    attrToggles(st.attrs, (attrs) => set({ attrs })));
}

// ── Option helpers ─────────────────────────────────────────────────────────

export function setOption(name, value, coalesce = true) {
  update((s) => { s.options[name] = value; }, coalesce ? 'opt:' + name : null);
}
export function resetOption(name) {
  update((s) => { delete s.options[name]; });
}

/** The right input for any catalog option, bound to state. */
export function optionControl(def, { fk } = {}) {
  const st = getState();
  const v = optionValue(st, def.name);
  const on = (val) => setOption(def.name, val);
  fk = fk || 'opt:' + def.name;
  switch (def.type) {
    case 'bool': return toggle(v === true || v === 'on', on, { fk, label: v === true || v === 'on' ? 'on' : 'off' });
    case 'number': return numberInput(v, on, { fk, min: def.min, max: def.max });
    case 'enum': return def.values.length <= 3
      ? segmented(def.values.map((x) => [x, x]), String(v), on, { small: true })
      : select(def.values, v, on, { fk });
    case 'colour': return colorField(v === 'default' ? '' : v, (c) => on(c || 'default'), { fk });
    case 'style': return styleField(v, on, { fk });
    case 'key': return textInput(v, on, { fk, mono: true, suggest: def.suggest, live: false });
    default: return textInput(v, on, { fk, mono: true, suggest: def.suggest, multiline: String(v || '').length > 50 });
  }
}

export function isModified(name) {
  return name in getState().options;
}
