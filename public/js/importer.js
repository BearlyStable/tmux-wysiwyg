// Best-effort parser for an existing .tmux.conf. Anything it doesn't
// understand is preserved verbatim in the "extra" section.

import { OPTION_MAP } from './data/options.js';
import { makeWidget } from './data/widgets.js';
import { tmuxDefaultState } from './data/themes.js';
import { parseStyle, formatStyle } from './colors.js';
import { uid } from './util.js';

function tokenize(line) {
  const toks = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length || line[i] === '#') break;
    const start = i;
    let v = '';
    while (i < line.length && !/\s/.test(line[i])) {
      const ch = line[i];
      if (ch === "'") {
        const e = line.indexOf("'", i + 1);
        if (e < 0) { v += line.slice(i + 1); i = line.length; break; }
        v += line.slice(i + 1, e); i = e + 1;
      } else if (ch === '"') {
        i++;
        while (i < line.length && line[i] !== '"') {
          if (line[i] === '\\' && i + 1 < line.length) { v += line[i + 1]; i += 2; } else v += line[i++];
        }
        i++;
      } else if (ch === '\\' && i + 1 < line.length) { v += line[i + 1]; i += 2; }
      else { v += ch; i++; }
    }
    toks.push({ v, start, end: i });
  }
  return toks;
}

function joinContinuations(lines) {
  const out = [];
  let buf = '';
  for (const l of lines) {
    if (/\\$/.test(l) && !/\\\\$/.test(l)) { buf += l.slice(0, -1) + ' '; continue; }
    out.push(buf + l);
    buf = '';
  }
  if (buf) out.push(buf);
  return out;
}

function toValue(def, v) {
  if (def.type === 'bool') return /^(on|yes|1|true)$/i.test(v);
  if (def.type === 'number') { const n = parseInt(v, 10); return Number.isFinite(n) ? n : v; }
  return v;
}

export function importConfig(text) {
  const s = tmuxDefaultState();
  const report = { options: 0, bindings: 0, plugins: 0, raw: 0, status: false };
  const extra = [];
  const custom = { ...s.status.windows.custom };
  let customTouched = false;
  let block = 0;

  const raw = (l) => { extra.push(l); if (l.trim()) report.raw++; };

  for (const line of joinContinuations(String(text).split(/\r?\n/))) {
    const t = line.trim();
    if (block > 0) {
      extra.push(line);
      if (/^%if\b/.test(t)) block++;
      if (/^%endif\b/.test(t) || /^}/.test(t)) block--;
      continue;
    }
    if (!t || t.startsWith('#')) continue;
    if (/^%if\b/.test(t)) { block = 1; raw(line); continue; }
    if (/^%(hidden|elif|else|endif)\b/.test(t)) { raw(line); continue; }
    const toks = tokenize(t);
    if (!toks.length) continue;
    if (toks[toks.length - 1].v === '{') { block = 1; raw(line); continue; }
    const cmd = toks[0].v;

    if (/^(set|set-option|setw|set-window-option)$/.test(cmd)) {
      let flags = '', i = 1;
      while (i < toks.length && /^-[a-zA-Z]+$/.test(toks[i].v)) {
        flags += toks[i].v.slice(1);
        if (/t$/.test(toks[i].v)) i++; // -t target takes an argument
        i++;
      }
      const name = toks[i]?.v;
      const value = toks.slice(i + 1).map((x) => x.v).join(' ');
      const hasValue = toks.length > i + 1;
      if (!name || flags.includes('u') || !hasValue) { raw(line); continue; }
      if (flags.includes('a')) {
        if (name === 'terminal-features') { s.options['terminal-features'] = value.replace(/^,/, ''); report.options++; } else raw(line);
        continue;
      }
      if (name === '@plugin') { if (value !== 'tmux-plugins/tpm' && !s.plugins.includes(value)) { s.plugins.push(value); report.plugins++; } continue; }
      if (name.startsWith('@')) { s.pluginOptions[name] = value; continue; }
      if (name === 'status-left' || name === 'status-right') {
        s.status[name.slice(7)] = value ? [makeWidget('format', { params: { format: value }, pad: false, icon: '' })] : [];
        report.status = true;
        continue;
      }
      if (name === 'window-status-format') { custom.format = value; customTouched = true; continue; }
      if (name === 'window-status-current-format') { custom.current = value; customTouched = true; continue; }
      if (name === 'window-status-separator') { custom.separator = value; customTouched = true; continue; }
      if (name === 'status-bg' || name === 'status-fg') {
        const st = parseStyle(s.options['status-style'] ?? OPTION_MAP['status-style'].def);
        st[name.slice(7)] = value;
        s.options['status-style'] = formatStyle(st);
        report.options++;
        continue;
      }
      const def = OPTION_MAP[name];
      if (def) { s.options[name] = toValue(def, value); report.options++; } else raw(line);
      continue;
    }

    if (cmd === 'bind' || cmd === 'bind-key') {
      let i = 1, repeat = false, table = 'prefix', note = '';
      while (i < toks.length && /^-/.test(toks[i].v) && toks[i].v.length > 1) {
        const f = toks[i].v;
        if (f.includes('r')) repeat = true;
        if (f.includes('n')) table = 'root';
        if (f.endsWith('T')) { table = toks[++i]?.v || table; }
        else if (f.endsWith('N')) { note = toks[++i]?.v || ''; }
        i++;
      }
      const key = toks[i];
      if (!key) { raw(line); continue; }
      const command = t.slice(key.end).trim();
      if (!command) { raw(line); continue; }
      s.bindings.push({ id: uid(), key: key.v, command, table, repeat, unbind: false, note });
      report.bindings++;
      continue;
    }

    if (cmd === 'unbind' || cmd === 'unbind-key') {
      let i = 1, table = 'prefix';
      if (toks.some((x) => x.v === '-a')) { raw(line); continue; }
      while (i < toks.length && /^-/.test(toks[i].v) && toks[i].v.length > 1) {
        if (toks[i].v.includes('n')) table = 'root';
        if (toks[i].v.endsWith('T')) table = toks[++i]?.v || table;
        i++;
      }
      if (toks[i]) { s.bindings.push({ id: uid(), key: toks[i].v, command: '', table, repeat: false, unbind: true, note: '' }); report.bindings++; } else raw(line);
      continue;
    }

    if ((cmd === 'run' || cmd === 'run-shell') && /tpm/.test(t)) continue; // regenerated automatically
    raw(line);
  }

  if (customTouched) s.status.windows.custom = custom;

  // The generator writes the prefix lines itself; drop the duplicates.
  const prefix = s.options.prefix;
  if (prefix && prefix !== 'C-b') {
    s.bindings = s.bindings.filter((b) => !(b.unbind && b.key === 'C-b') && !(!b.unbind && b.key === prefix && /^send-prefix\b/.test(b.command)));
  }
  s.extra = extra.join('\n').trim();
  s.theme = '';
  return { state: s, report };
}
