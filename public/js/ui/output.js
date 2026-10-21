// Right panel: the generated .tmux.conf with highlighting, copy & download.

import { h, esc, copyText, downloadText, toast, preserveFocus } from '../util.js';
import { getState, update } from '../store.js';
import { generate, activePlugins } from '../generator.js';

let previous = new Set();

function highlight(line) {
  if (/^\s*#/.test(line)) return `<span class="t-c">${esc(line)}</span>`;
  const toks = line.match(/'[^']*'|"(?:\\.|[^"\\])*"|\s+|#.*$|[^\s'"]+/g) || [];
  let word = 0;
  return toks.map((t) => {
    if (/^\s+$/.test(t)) return t;
    const e = esc(t);
    if (t.startsWith('#')) return `<span class="t-c">${e}</span>`;
    word++;
    if (word === 1) return `<span class="t-k">${e}</span>`;
    if (/^-[a-zA-Z]+$/.test(t)) return `<span class="t-f">${e}</span>`;
    if (t.startsWith("'") || t.startsWith('"')) return `<span class="t-s">${e}</span>`;
    if (word === 2 || (word === 3 && /^-/.test(line.split(/\s+/)[1] || ''))) return `<span class="t-o">${e}</span>`;
    return e;
  }).join('');
}

export function currentConfig() {
  return generate(getState(), { origin: location.host });
}

export function renderOutput(root) {
  const text = currentConfig();
  const lines = text.replace(/\n$/, '').split('\n');
  const html = lines.map((l) => {
    const changed = previous.size && !previous.has(l) && l.trim() ? ' changed' : '';
    return `<span class="ln${changed}">${highlight(l) || ' '}</span>`;
  }).join('\n');
  previous = new Set(lines);
  const plugins = activePlugins(getState());

  const pre = h('pre', { class: 'code', 'data-sk': 'code', tabindex: 0, 'aria-label': 'Generated tmux.conf' });
  pre.innerHTML = html;
  const keep = root.querySelector('pre.code')?.scrollTop ?? 0;
  const installOpen = !!root.querySelector('details.install')?.open;

  const extraOpen = !!root.querySelector('details.extra')?.open || !!getState().extra;
  preserveFocus(root, () => root.replaceChildren(
    h('div', { class: 'out-head' },
      h('div', null, h('strong', null, '.tmux.conf'), h('span', { class: 'muted small' }, ` ${lines.length} lines`)),
      h('div', { class: 'out-actions' },
        h('button', { type: 'button', class: 'btn small', onclick: async () => toast((await copyText(currentConfig())) ? 'Copied to clipboard' : 'Copy failed — select the text manually', 'ok') }, 'Copy'),
        h('button', { type: 'button', class: 'btn small primary', onclick: () => { downloadText('tmux.conf', currentConfig()); toast('Downloaded tmux.conf'); } }, 'Download'),
        h('button', { type: 'button', class: 'icon-btn out-close', title: 'Close', 'aria-label': 'Close config panel' }, '✕'))),
    pre,
    h('details', { class: 'install', open: installOpen },
      h('summary', null, 'How to install'),
      h('ol', null,
        h('li', null, 'Save it as ', h('code', null, '~/.tmux.conf'), ' (or ', h('code', null, '~/.config/tmux/tmux.conf'), '):', h('br'), h('code', { class: 'block' }, 'mv ~/Downloads/tmux.conf ~/.tmux.conf')),
        plugins.length ? h('li', null, 'Install the plugin manager once:', h('br'), h('code', { class: 'block' }, 'git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm')) : null,
        h('li', null, 'Reload inside tmux:', h('br'), h('code', { class: 'block' }, 'tmux source-file ~/.tmux.conf')),
        plugins.length ? h('li', null, 'Press ', h('kbd', null, 'prefix'), ' + ', h('kbd', null, 'I'), ' to download the plugins.') : null)),
    h('details', { class: 'extra', open: extraOpen },
      h('summary', null, 'Extra lines (added verbatim)'),
      h('textarea', {
        rows: 5, class: 'mono', spellcheck: 'false', 'data-fk': 'extra', value: getState().extra,
        placeholder: '# anything the editor does not cover, e.g.\nset -g @my-option on\nif-shell "uname | grep -q Darwin" "set -g default-command \'reattach-to-user-namespace -l zsh\'"',
        oninput: (e) => update((s) => { s.extra = e.target.value; }, 'extra'),
      }))));
  root.querySelector('pre.code').scrollTop = keep;
}
