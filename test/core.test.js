import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generate, quote, quoteKey, sideFormat, windowFormats, activePlugins } from '../public/js/generator.js';
import { TEMPLATES, defaultState, tmuxDefaultState } from '../public/js/data/themes.js';
import { makeWidget } from '../public/js/data/widgets.js';
import { importConfig } from '../public/js/importer.js';
import { search } from '../public/js/search.js';
import { renderRuns, strftime } from '../public/js/format.js';

test('every template generates a config', () => {
  for (const t of TEMPLATES) {
    const conf = generate(t.build());
    assert.match(conf, /set -g status-left /, t.id);
    assert.match(conf, /setw -g window-status-current-format /, t.id);
  }
});

test('quoting', () => {
  assert.equal(quote('on'), 'on');
  assert.equal(quote('fg=red,bg=blue'), "'fg=red,bg=blue'");
  assert.equal(quote('/bin/zsh'), '/bin/zsh');
  assert.equal(quote('#[fg=red] #S '), "'#[fg=red] #S '");
  assert.equal(quote("#(awk '{print $2}')"), '"#(awk \'{print \\$2}\')"');
  assert.equal(quote(''), "''");
  assert.equal(quoteKey('|'), "'|'");
  assert.equal(quoteKey('-'), '-');
  assert.equal(quoteKey('C-a'), 'C-a');
  assert.equal(quoteKey(';'), '\\;');
  assert.equal(quoteKey("'"), `"'"`);
  assert.equal(quoteKey('"'), `'"'`);
});

test('percent signs are escaped for non-time widgets only', () => {
  const s = tmuxDefaultState();
  s.status.left = [makeWidget('time', { params: { fmt: '%H:%M' } }), makeWidget('text', { params: { text: '100%' } })];
  const left = sideFormat(s, 'left');
  assert.match(left, / %H:%M /);
  assert.match(left, /100%% /);
});

test('plugin widgets pull in their plugin and TPM', () => {
  const s = tmuxDefaultState();
  s.status.right = [makeWidget('battery'), makeWidget('weather', { params: { source: 'plugin', location: 'Berlin' } })];
  assert.deepEqual(activePlugins(s).sort(), ['tmux-plugins/tmux-battery', 'xamut/tmux-weather']);
  const conf = generate(s);
  assert.match(conf, /set -g @plugin 'tmux-plugins\/tpm'/);
  assert.match(conf, /set -g @tmux-weather-location Berlin/);
  assert.ok(conf.trimEnd().endsWith("run '~/.tmux/plugins/tpm/tpm'"));
  // status formats must come before TPM so plugins can interpolate them
  assert.ok(conf.indexOf('status-right') < conf.indexOf('run '));
});

test('prefix change emits unbind/set/bind', () => {
  const s = defaultState();
  s.options.prefix = 'C-a';
  const conf = generate(s);
  assert.match(conf, /unbind C-b\nset -g prefix C-a\nbind C-a send-prefix/);
});

test('import round-trip keeps options, bindings, plugins and raw lines', () => {
  const src = `
# comment
set -g mouse on
set -g base-index 1
setw -g mode-keys vi
set -sg escape-time 0
set -g prefix C-a
unbind C-b
bind C-a send-prefix
bind | split-window -h -c "#{pane_current_path}"
bind -r H resize-pane -L 5
bind -n M-Left select-pane -L
unbind '"'
set -g status-right '#{battery_percentage} %H:%M'
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @resurrect-capture-pane-contents 'on'
set-hook -g after-new-window 'display hi'
run '~/.tmux/plugins/tpm/tpm'
`;
  const { state, report } = importConfig(src);
  assert.equal(state.options.mouse, true);
  assert.equal(state.options['base-index'], 1);
  assert.equal(state.options['mode-keys'], 'vi');
  assert.equal(state.options['escape-time'], 0);
  assert.equal(state.options.prefix, 'C-a');
  assert.equal(report.plugins, 1);
  assert.deepEqual(state.plugins, ['tmux-plugins/tmux-resurrect']);
  assert.equal(state.pluginOptions['@resurrect-capture-pane-contents'], 'on');
  assert.match(state.extra, /set-hook/);
  const keys = state.bindings.map((b) => `${b.table}:${b.unbind ? '!' : ''}${b.key}`);
  assert.deepEqual(keys, ['prefix:|', 'prefix:H', 'root:M-Left', 'prefix:!"']);
  assert.equal(state.bindings[0].command, 'split-window -h -c "#{pane_current_path}"');
  assert.equal(state.bindings[1].repeat, true);

  const conf = generate(state);
  assert.match(conf, /set -g mouse on/);
  assert.match(conf, /bind '\|' split-window -h -c "#\{pane_current_path\}"/);
  assert.match(conf, /bind -r H resize-pane -L 5/);
  assert.match(conf, /bind -n M-Left select-pane -L/);
  assert.match(conf, /unbind '"'/);
  assert.match(conf, /set -g status-right '#\{battery_percentage\} %H:%M'/);
  // re-importing the generated config is stable
  const again = importConfig(conf);
  assert.equal(generate(again.state), conf);
});

test('search is typo tolerant and finds things by synonym', () => {
  const top = (q) => search(q)[0];
  assert.equal(top('batery').id, 'battery');
  assert.equal(top('battery').id, 'battery');
  assert.ok(search('charge').some((r) => r.id === 'battery'));
  const pane = search('pane').map((r) => r.id);
  for (const id of ['pane-base-index', 'select-pane', 'rename-pane', 'pane-border-status']) assert.ok(pane.includes(id), id);
  assert.ok(search('rename pane').some((r) => r.id === 'rename-pane'));
  assert.ok(search('reindex').some((r) => r.id === 'renumber-windows'));
  assert.ok(search('weather').some((r) => r.kind === 'widget'));
});

test('format engine: conditionals, styles, aliases, strftime', () => {
  const ctx = { vars: { client_prefix: '1', session_name: 'main', pane_current_path: '/a/b/c' }, time: new Date(2026, 0, 2, 9, 5, 7), cmd: () => 'X' };
  const runs = renderRuns('#[fg=red,bold]#S#[default] #{?client_prefix,P,-} #{b:pane_current_path} %H:%M ## #(whoami)', ctx);
  const text = runs.map((r) => r.text).join('');
  assert.equal(text, 'main P c 09:05 # X');
  assert.equal(runs[0].fg, 'red');
  assert.ok(runs[0].attrs.has('bold'));
  assert.equal(runs[1].fg, 'default');
  assert.equal(strftime('%%', new Date()), '%');
  const nested = renderRuns('#{?#{==:#{session_name},main},yes,no}', ctx).map((r) => r.text).join('');
  assert.equal(nested, 'yes');
});

test('window formats default separators per style', () => {
  const s = defaultState();
  s.status.separator = 'pipes';
  assert.equal(windowFormats(s).separator, '│');
  s.status.windows.separator = ' ';
  assert.equal(windowFormats(s).separator, ' ');
});
