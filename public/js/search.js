// Typo-tolerant search over widgets, options, recipes, commands and plugins.

import { WIDGETS } from './data/widgets.js';
import { OPTIONS } from './data/options.js';
import { COMMANDS, RECIPES } from './data/commands.js';
import { PLUGINS } from './data/plugins.js';

export const KINDS = [
  ['widget', 'Widgets'],
  ['option', 'Options'],
  ['recipe', 'Key bindings'],
  ['command', 'Commands'],
  ['plugin', 'Plugins'],
];
const KIND_RANK = { widget: 0, recipe: 1, option: 2, command: 3, plugin: 4 };

const words = (...xs) => xs.flat().join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function doc(kind, id, item, title, tags, desc, extra = []) {
  return { kind, id, item, title: words(title, extra), tags: words(tags), desc: words(desc), phrase: [title, ...extra].join(' ').toLowerCase() };
}

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = [
    ...WIDGETS.map((w) => doc('widget', w.type, w, w.name, [...w.tags, w.cat, typeof w.plugin === 'string' ? w.plugin : ''], w.desc, [w.type])),
    ...OPTIONS.map((o) => doc('option', o.name, o, o.name, [...o.tags, o.cat, o.scope], o.desc)),
    ...RECIPES.map((r) => doc('recipe', r.id, r, r.title, [...r.tags, r.cat], r.desc, r.bindings.map((b) => b.command))),
    ...COMMANDS.map((c) => doc('command', c.name, c, c.name, [...c.tags, c.cat, c.alias], c.desc, [c.alias])),
    ...PLUGINS.map((p) => doc('plugin', p.repo, p, p.name, [...p.tags, p.repo, 'plugin', 'tpm'], p.desc)),
  ];
  return INDEX;
}

/** Optimal string alignment distance with an early-exit bound. */
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

function wordScore(tok, w) {
  if (w === tok) return 1;
  if (w.startsWith(tok)) return tok.length >= 2 ? 0.85 : 0.3;
  if (tok.length >= 3 && w.includes(tok)) return 0.5;
  if (tok.length >= 4) {
    const max = tok.length >= 7 ? 2 : 1;
    if (dist(tok, w, max) <= max) return 0.6;
    // typo inside a prefix: "batt" vs "battery" handled above; "baterr" vs "battery"
    if (w.length > tok.length && dist(tok, w.slice(0, tok.length + 1), max) <= max) return 0.45;
  }
  return 0;
}

function tokenScore(tok, d) {
  let best = 0;
  for (const [field, weight] of [['title', 3], ['tags', 2], ['desc', 0.8]]) {
    for (const w of d[field]) {
      const s = wordScore(tok, w) * weight;
      if (s > best) best = s;
    }
  }
  return best;
}

/** Returns [{kind, id, item, score}] best first. */
export function search(query, kind = 'all') {
  const toks = words(query);
  if (!toks.length) return [];
  const q = query.trim().toLowerCase();
  const res = [];
  for (const d of index()) {
    if (kind !== 'all' && d.kind !== kind) continue;
    let total = 0, ok = true;
    for (const t of toks) {
      const s = tokenScore(t, d);
      if (s <= 0) { ok = false; break; }
      total += s;
    }
    if (!ok) continue;
    if (d.phrase === q) total += 4;
    else if (d.phrase.startsWith(q)) total += 2;
    else if (q.length > 2 && d.phrase.includes(q)) total += 1;
    res.push({ ...d, score: total });
  }
  return res.sort((a, b) => b.score - a.score || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}
