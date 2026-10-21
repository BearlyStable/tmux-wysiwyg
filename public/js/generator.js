// Turns the editor state into a .tmux.conf. The preview uses the same
// building blocks (buildSide / windowFormats) so what you see is what you get.

import { OPTION_MAP, CATEGORIES } from './data/options.js';
import { getWidget, widgetParams, widgetPlugin, lit } from './data/widgets.js';
import { PLUGIN_MAP } from './data/plugins.js';
import { parseStyle } from './colors.js';

const GL = { r: '', rThin: '', l: '', lThin: '', capR: '', capL: '' };

export const SEPARATORS = [
  ['plain', 'Plain blocks'],
  ['powerline', 'Powerline arrows'],
  ['rounded', 'Rounded pills'],
  ['brackets', '[Brackets]'],
  ['pipes', 'Pipes │'],
];
export const NEEDS_NERD_FONT = new Set(['powerline', 'rounded']);

/** Effective value of an option (state override or tmux default). */
export function optionValue(state, name) {
  if (name in state.options) return state.options[name];
  return OPTION_MAP[name]?.def;
}

export function statusBase(state) {
  const s = parseStyle(optionValue(state, 'status-style'));
  return { fg: s.fg || 'default', bg: s.bg || 'default', attrs: s.attrs };
}

/** Widget content: padding + icon + body, with % escaped where needed. */
export function widgetBody(w) {
  const def = getWidget(w.type);
  if (!def) return '';
  const p = widgetParams(w);
  const pad = w.pad === false ? '' : ' ';
  const escPercent = def.escapePercent !== false;
  let icon = w.icon ? lit(w.icon) + ' ' : '';
  if (!escPercent) icon = icon.replace(/%/g, '%%');
  let body;
  if (def.render) {
    const ic = icon.replace(/,/g, '#,').replace(/}/g, '#}');
    body = def.render(p, (t) => pad + ic + t + pad);
  } else {
    body = pad + icon + def.format(p) + pad;
  }
  return escPercent ? body.replace(/%/g, '%%') : body;
}

const styleBlock = (fg, bg, attrs) => `#[fg=${fg},bg=${bg}${attrs.length ? ',' + attrs.join(',') : ''}]`;

/** An unstyled raw format (e.g. from an imported config) is emitted exactly as written. */
const isRaw = (w) => w.type === 'format' && !w.fg && !w.bg && !(w.attrs || []).length && w.pad === false && !w.icon;

/** Returns [{id, fmt}] — one entry per widget (id null for glue). */
export function buildSide(state, side) {
  const S = statusBase(state);
  const sep = state.status.separator;
  const list = state.status[side].filter((w) => getWidget(w.type));
  const bgOf = (w) => (w ? w.bg || S.bg : S.bg);
  const gap = `#[fg=${S.fg},bg=${S.bg}]`;
  const parts = list.map((w, i) => {
    const bg = bgOf(w);
    const fg = w.fg || S.fg;
    const attrs = (w.attrs || []).filter(Boolean);
    const open = styleBlock(fg, bg, attrs);
    const close = attrs.length ? '#[none]' : '';
    const body = open + widgetBody(w) + close;
    let fmt;
    switch (sep) {
      case 'powerline':
        if (side === 'left') {
          const next = bgOf(list[i + 1]);
          fmt = body + (next === bg ? `#[fg=${fg},bg=${bg}]${GL.rThin}` : `#[fg=${bg},bg=${next}]${GL.r}`);
        } else {
          const prev = bgOf(list[i - 1]);
          fmt = (prev === bg ? `#[fg=${fg},bg=${bg}]${GL.lThin}` : `#[fg=${bg},bg=${prev}]${GL.l}`) + body;
        }
        break;
      case 'rounded': {
        const pill = `#[fg=${bg},bg=${S.bg}]${GL.capL}` + body + `#[fg=${bg},bg=${S.bg}]${GL.capR}`;
        fmt = side === 'left' ? pill + gap + ' ' : gap + ' ' + pill;
        break;
      }
      case 'brackets': {
        const br = open + '[' + widgetBody(w) + ']' + close;
        fmt = side === 'left' ? br + gap + ' ' : gap + ' ' + br;
        break;
      }
      case 'pipes': {
        const b = isRaw(w) ? widgetBody(w) : body;
        fmt = side === 'left' ? b + (i < list.length - 1 ? gap + '│' : '') : (i > 0 ? gap + '│' : '') + b;
        break;
      }
      default:
        fmt = isRaw(w) ? widgetBody(w) : body;
    }
    return { id: w.id, fmt };
  });
  const glue = list.some((w) => !isRaw(w)) && (sep === 'plain' || sep === 'pipes');
  if (glue && side === 'left') parts.push({ id: null, fmt: gap + ' ' });
  if (glue && side === 'right') parts.unshift({ id: null, fmt: gap + ' ' });
  return parts;
}

export const sideFormat = (state, side) => buildSide(state, side).map((p) => p.fmt).join('');

export function windowFormats(state) {
  const W = state.status.windows;
  if (W.custom) return { format: W.custom.format, current: W.custom.current, separator: W.custom.separator ?? ' ' };
  const S = statusBase(state);
  const sep = state.status.separator;
  const mk = (t) => {
    const fg = t.fg || S.fg, bg = t.bg || S.bg;
    const attrs = (t.attrs || []).filter(Boolean);
    const open = styleBlock(fg, bg, attrs);
    const close = attrs.length ? '#[none]' : '';
    const body = open + ' ' + t.format + ' ' + close;
    switch (sep) {
      case 'powerline': return bg === S.bg ? body : `#[fg=${S.bg},bg=${bg}]${GL.r}` + body + `#[fg=${bg},bg=${S.bg}]${GL.r}`;
      case 'rounded': return bg === S.bg ? body : `#[fg=${bg},bg=${S.bg}]${GL.capL}` + body + `#[fg=${bg},bg=${S.bg}]${GL.capR}`;
      case 'brackets': return open + '[' + t.format + ']' + close;
      default: return body;
    }
  };
  const defSep = { plain: '', powerline: '', rounded: ' ', brackets: ' ', pipes: '│' }[sep] ?? ' ';
  return { format: mk(W.inactive), current: mk(W.current), separator: W.separator ?? defSep };
}

/** All plugin repos in use: chosen ones + ones required by widgets + dependencies. */
export function activePlugins(state) {
  const set = new Set(state.plugins);
  for (const side of ['left', 'right']) for (const w of state.status[side]) { const p = widgetPlugin(w); if (p) set.add(p); }
  for (const repo of [...set]) for (const dep of PLUGIN_MAP[repo]?.requires || []) set.add(dep);
  return [...set];
}

export function widgetPluginRepos(state) {
  const set = new Set();
  for (const side of ['left', 'right']) for (const w of state.status[side]) { const p = widgetPlugin(w); if (p) set.add(p); }
  return set;
}

/** Quote a value for the tmux config parser. */
export function quote(v) {
  v = String(v);
  if (v === '') return "''";
  if (/^[A-Za-z0-9_.\/@:+=-]+$/.test(v) && !v.startsWith('-')) return v;
  if (!v.includes("'")) return `'${v}'`;
  return '"' + v.replace(/[\\"$]/g, (c) => '\\' + c) + '"';
}

export function quoteKey(k) {
  if (k === ';') return '\\;';
  if (/^[A-Za-z0-9_+-]+$/.test(k)) return k;
  if (k === "'") return `"'"`;
  return `'${k}'`;
}

function optionLine(name, v) {
  const def = OPTION_MAP[name];
  const val = def?.type === 'bool' || typeof v === 'boolean' ? (v === true || v === 'on' ? 'on' : 'off') : quote(v);
  if (def?.append) {
    const s = String(v);
    return `set -as ${name} ${quote(s.startsWith(',') ? s : ',' + s)}`;
  }
  const scope = def?.scope || 'session';
  const cmd = scope === 'server' ? 'set -sg' : scope === 'window' || scope === 'pane' ? 'setw -g' : 'set -g';
  return `${cmd} ${name} ${val}`;
}

export function bindingLine(b) {
  const table = b.table && b.table !== 'prefix' ? (b.table === 'root' ? ' -n' : ` -T ${b.table}`) : '';
  if (b.unbind) return `unbind${table} ${quoteKey(b.key)}`;
  return `bind${b.repeat ? ' -r' : ''}${table} ${quoteKey(b.key)} ${b.command}`;
}

function pluginOptionValue(v) {
  if (v === true) return 'on';
  if (v === false) return 'off';
  return quote(v);
}

/** Collect plugin @options from widget params and the Plugins tab. */
export function pluginOptionLines(state, plugins) {
  const opts = {};
  for (const repo of plugins) {
    for (const po of PLUGIN_MAP[repo]?.options || []) {
      const v = state.pluginOptions[po.name];
      if (v !== undefined && v !== '' && v !== po.def) opts[po.name] = v;
    }
  }
  for (const side of ['left', 'right']) {
    for (const w of state.status[side]) {
      const def = getWidget(w.type);
      if (!def?.pluginOptions) continue;
      for (const [k, v] of Object.entries(def.pluginOptions(widgetParams(w)))) if (v != null && v !== '') opts[k] = v;
    }
  }
  // Keep any @options that came from an import and aren't covered above.
  for (const [k, v] of Object.entries(state.pluginOptions)) if (!(k in opts) && !isKnownPluginOption(k)) opts[k] = v;
  return Object.entries(opts).map(([k, v]) => `set -g ${k} ${pluginOptionValue(v)}`);
}

const isKnownPluginOption = (name) => Object.values(PLUGIN_MAP).some((p) => (p.options || []).some((o) => o.name === name));

export function generate(state, { origin = '' } = {}) {
  const out = [];
  const section = (title) => { out.push('', `# ── ${title} ${'─'.repeat(Math.max(3, 60 - title.length))}`); };

  out.push('# ~/.tmux.conf — generated with tmux-wysiwyg' + (origin ? ` (${origin})` : ''));
  out.push('# Apply without restarting:  tmux source-file ~/.tmux.conf');

  const prefix = state.options.prefix;
  if (prefix && prefix !== 'C-b') {
    section('Prefix');
    out.push('unbind C-b', `set -g prefix ${quoteKey(prefix)}`, `bind ${quoteKey(prefix)} send-prefix`);
  }

  // Group plain options by category.
  const byCat = new Map();
  for (const [name, v] of Object.entries(state.options)) {
    if (name === 'prefix' || v === undefined || v === null) continue;
    const def = OPTION_MAP[name];
    if (def?.managed) continue;
    const cat = def?.cat || 'Other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(optionLine(name, v));
  }
  for (const cat of [...CATEGORIES, 'Other']) {
    if (cat === 'Status bar' || !byCat.has(cat)) continue;
    section(cat);
    out.push(...byCat.get(cat));
  }

  section('Status bar');
  out.push(...(byCat.get('Status bar') || []));
  if (!('status-left-length' in state.options)) out.push('set -g status-left-length 100');
  if (!('status-right-length' in state.options)) out.push('set -g status-right-length 150');
  out.push(`set -g status-left ${quote(sideFormat(state, 'left'))}`);
  out.push(`set -g status-right ${quote(sideFormat(state, 'right'))}`);
  const wf = windowFormats(state);
  out.push(`setw -g window-status-format ${quote(wf.format)}`);
  out.push(`setw -g window-status-current-format ${quote(wf.current)}`);
  out.push(`setw -g window-status-separator ${quote(wf.separator)}`);
  if (NEEDS_NERD_FONT.has(state.status.separator) && !state.status.windows.custom) {
    out.push('# Separator glyphs need a Nerd Font / Powerline font in your terminal.');
  }

  const binds = state.bindings.filter((b) => b.key && (b.unbind || b.command));
  if (binds.length) {
    section('Key bindings');
    const order = (b) => (b.unbind ? 0 : !b.table || b.table === 'prefix' ? 1 : b.table === 'root' ? 2 : 3);
    for (const b of [...binds].sort((a, c) => order(a) - order(c))) {
      out.push(bindingLine(b) + (b.note ? `  # ${b.note}` : ''));
    }
  }

  const plugins = activePlugins(state);
  const extra = (state.extra || '').trim();
  if (extra) {
    section('Extra (raw)');
    out.push(extra);
  }

  if (plugins.length) {
    section('Plugins (TPM)');
    out.push('# Install TPM once:  git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm');
    out.push('# Then press prefix + I inside tmux to fetch the plugins below.');
    out.push("set -g @plugin 'tmux-plugins/tpm'");
    for (const p of plugins) if (p !== 'tmux-plugins/tpm') out.push(`set -g @plugin '${p}'`);
    out.push(...pluginOptionLines(state, plugins));
    out.push('', '# Keep this line at the very bottom of tmux.conf');
    out.push("run '~/.tmux/plugins/tpm/tpm'");
  } else if (Object.keys(state.pluginOptions).length) {
    const lines = pluginOptionLines(state, []);
    if (lines.length) { section('User options'); out.push(...lines); }
  }

  return out.join('\n') + '\n';
}
