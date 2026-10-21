// Colour themes (recolour an existing layout) and templates (complete starting points).

import { makeWidget } from './widgets.js';
import { RECIPES } from './commands.js';

export const THEMES = [
  { id: 'tmux', name: 'tmux classic green', bar: { fg: 'black', bg: 'green' }, accents: [], dark: 'black',
    win: { fg: '', bg: '' }, cur: { fg: 'black', bg: 'white' }, border: 'default', active: 'green', msg: { fg: 'black', bg: 'yellow' } },
  { id: 'catppuccin', name: 'Catppuccin Mocha', bar: { fg: '#cdd6f4', bg: '#1e1e2e' }, accents: ['#89b4fa', '#a6e3a1', '#f9e2af', '#cba6f7', '#fab387'], dark: '#1e1e2e',
    win: { fg: '#a6adc8', bg: '#313244' }, cur: { fg: '#1e1e2e', bg: '#89b4fa' }, border: '#45475a', active: '#89b4fa', msg: { fg: '#1e1e2e', bg: '#f9e2af' } },
  { id: 'nord', name: 'Nord', bar: { fg: '#d8dee9', bg: '#3b4252' }, accents: ['#88c0d0', '#81a1c1', '#a3be8c', '#ebcb8b', '#b48ead'], dark: '#2e3440',
    win: { fg: '#d8dee9', bg: '#434c5e' }, cur: { fg: '#2e3440', bg: '#88c0d0' }, border: '#4c566a', active: '#88c0d0', msg: { fg: '#2e3440', bg: '#ebcb8b' } },
  { id: 'dracula', name: 'Dracula', bar: { fg: '#f8f8f2', bg: '#44475a' }, accents: ['#bd93f9', '#50fa7b', '#ff79c6', '#8be9fd', '#ffb86c'], dark: '#282a36',
    win: { fg: '#f8f8f2', bg: '#44475a' }, cur: { fg: '#282a36', bg: '#bd93f9' }, border: '#6272a4', active: '#ff79c6', msg: { fg: '#282a36', bg: '#f1fa8c' } },
  { id: 'gruvbox', name: 'Gruvbox dark', bar: { fg: '#ebdbb2', bg: '#3c3836' }, accents: ['#fabd2f', '#b8bb26', '#83a598', '#fe8019', '#d3869b'], dark: '#282828',
    win: { fg: '#a89984', bg: '#504945' }, cur: { fg: '#282828', bg: '#fabd2f' }, border: '#504945', active: '#fabd2f', msg: { fg: '#282828', bg: '#fe8019' } },
  { id: 'tokyonight', name: 'Tokyo Night', bar: { fg: '#a9b1d6', bg: '#1a1b26' }, accents: ['#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', '#7dcfff'], dark: '#1a1b26',
    win: { fg: '#a9b1d6', bg: '#292e42' }, cur: { fg: '#1a1b26', bg: '#7aa2f7' }, border: '#3b4261', active: '#7aa2f7', msg: { fg: '#1a1b26', bg: '#e0af68' } },
  { id: 'solarized', name: 'Solarized dark', bar: { fg: '#93a1a1', bg: '#073642' }, accents: ['#268bd2', '#859900', '#b58900', '#2aa198', '#d33682'], dark: '#002b36',
    win: { fg: '#93a1a1', bg: '#073642' }, cur: { fg: '#002b36', bg: '#268bd2' }, border: '#586e75', active: '#268bd2', msg: { fg: '#002b36', bg: '#b58900' } },
  { id: 'minimal', name: 'Minimal (transparent)', bar: { fg: 'white', bg: 'default' }, accents: [], dark: 'default', accentFg: ['cyan', 'green', 'yellow', 'magenta'],
    win: { fg: 'brightblack', bg: '' }, cur: { fg: 'yellow', bg: '', bold: true }, border: 'brightblack', active: 'cyan', msg: { fg: 'black', bg: 'cyan' } },
];

/** Recolour state in place with a theme. */
export function applyTheme(state, theme) {
  const o = state.options;
  o['status-style'] = `fg=${theme.bar.fg},bg=${theme.bar.bg}`;
  o['pane-border-style'] = `fg=${theme.border}`;
  o['pane-active-border-style'] = `fg=${theme.active}`;
  o['message-style'] = `fg=${theme.msg.fg},bg=${theme.msg.bg}`;
  o['message-command-style'] = `fg=${theme.msg.bg},bg=${theme.msg.fg}`;
  if (theme.accents.length) {
    o['mode-style'] = `fg=${theme.dark},bg=${theme.accents[0]}`;
    o['clock-mode-colour'] = theme.accents[0];
    o['display-panes-active-colour'] = theme.accents[0];
  } else {
    delete o['mode-style']; delete o['clock-mode-colour']; delete o['display-panes-active-colour'];
  }
  const paint = (list, offset) => list.forEach((w, i) => {
    if (theme.accents.length) {
      w.bg = theme.accents[(i + offset) % theme.accents.length];
      w.fg = theme.dark;
    } else {
      w.bg = '';
      w.fg = theme.accentFg ? theme.accentFg[(i + offset) % theme.accentFg.length] : '';
    }
  });
  paint(state.status.left, 0);
  paint([...state.status.right].reverse(), 0);
  const W = state.status.windows;
  Object.assign(W.inactive, { fg: theme.win.fg, bg: theme.win.bg, attrs: [] });
  Object.assign(W.current, { fg: theme.cur.fg, bg: theme.cur.bg, attrs: theme.cur.bold || theme.accents.length ? ['bold'] : [] });
  state.theme = theme.id;
}

const recipeBindings = (...ids) => ids.flatMap((id) => RECIPES.find((r) => r.id === id).bindings.map((x) => ({ ...x })));

function base() {
  return {
    version: 1,
    theme: '',
    options: {},
    status: {
      separator: 'plain',
      left: [],
      right: [],
      windows: {
        inactive: { format: '#I:#W', fg: '', bg: '', attrs: [] },
        current: { format: '#I:#W', fg: '', bg: '', attrs: ['bold'] },
        separator: null,
        custom: null,
      },
    },
    bindings: [],
    plugins: [],
    pluginOptions: {},
    extra: '',
  };
}

/** Exactly what tmux does with no config at all. */
export function tmuxDefaultState() {
  const s = base();
  s.status.left = [makeWidget('format', { params: { format: '[#{session_name}] ' }, pad: false, icon: '' })];
  s.status.right = [makeWidget('format', { params: { format: '"#{=21:pane_title}" %H:%M %d-%b-%y' }, pad: false, icon: '' })];
  s.status.windows.custom = { format: '#I:#W#{?window_flags,#{window_flags}, }', current: '#I:#W#{?window_flags,#{window_flags}, }', separator: ' ' };
  return s;
}

const sensible = {
  mouse: true, 'base-index': 1, 'pane-base-index': 1, 'renumber-windows': true, 'history-limit': 50000,
  'escape-time': 10, 'default-terminal': 'tmux-256color', 'terminal-features': 'xterm*:RGB', 'focus-events': true,
  'status-interval': 5, 'mode-keys': 'vi',
};

export const TEMPLATES = [
  { id: 'starter', name: 'Starter (recommended)', desc: 'Sensible defaults, rounded pills, prefix indicator.', build() {
    const s = base();
    Object.assign(s.options, sensible);
    s.status.separator = 'rounded';
    s.status.left = [makeWidget('session', { icon: '❖' })];
    s.status.right = [makeWidget('prefix'), makeWidget('path'), makeWidget('date', { params: { fmt: '%a %d %b' } }), makeWidget('time')];
    s.status.windows.inactive.format = '#I #W';
    s.status.windows.current.format = '#I #W';
    s.bindings = recipeBindings('split-h', 'split-v', 'new-window-path', 'reload');
    applyTheme(s, THEMES.find((t) => t.id === 'catppuccin'));
    s.status.right[0].bg = ''; s.status.right[0].fg = '';
    return s;
  } },
  { id: 'powerline', name: 'Powerline developer', desc: 'Arrows, git branch, CPU/RAM, vim keys.', build() {
    const s = base();
    Object.assign(s.options, sensible);
    s.status.separator = 'powerline';
    s.status.left = [makeWidget('session'), makeWidget('git')];
    s.status.right = [makeWidget('cpu'), makeWidget('ram'), makeWidget('date'), makeWidget('time'), makeWidget('hostname')];
    s.status.windows.inactive.format = '#I #W';
    s.status.windows.current.format = '#I #W#{?window_zoomed_flag, 🔍,}';
    s.bindings = recipeBindings('split-h', 'split-v', 'new-window-path', 'reload', 'vim-nav', 'vim-resize', 'vi-copy');
    s.plugins = ['tmux-plugins/tmux-sensible', 'tmux-plugins/tmux-yank'];
    applyTheme(s, THEMES.find((t) => t.id === 'gruvbox'));
    return s;
  } },
  { id: 'laptop', name: 'Laptop', desc: 'Battery, weather, online status and a clock.', build() {
    const s = base();
    Object.assign(s.options, sensible);
    s.options['status-justify'] = 'centre';
    s.status.separator = 'rounded';
    s.status.left = [makeWidget('session'), makeWidget('prefix')];
    s.status.right = [makeWidget('weather'), makeWidget('battery'), makeWidget('time')];
    s.bindings = recipeBindings('split-h', 'split-v', 'reload', 'alt-arrows');
    applyTheme(s, THEMES.find((t) => t.id === 'nord'));
    s.status.left[1].bg = ''; s.status.left[1].fg = '';
    return s;
  } },
  { id: 'minimal', name: 'Minimal', desc: 'Transparent bar on top, no clutter.', build() {
    const s = base();
    Object.assign(s.options, sensible);
    s.options['status-position'] = 'top';
    s.options['status-justify'] = 'left';
    s.status.separator = 'plain';
    s.status.left = [makeWidget('session', { params: {} })];
    s.status.right = [makeWidget('prefix', { params: { onText: '●', onFg: 'red', onBg: '' } }), makeWidget('time')];
    s.status.windows.inactive.format = '#I:#W';
    s.status.windows.current.format = '#I:#W';
    s.bindings = recipeBindings('split-h', 'split-v', 'reload');
    applyTheme(s, THEMES.find((t) => t.id === 'minimal'));
    s.status.right[0].fg = '';
    return s;
  } },
  { id: 'tmux-default', name: 'Plain tmux defaults', desc: 'Exactly what tmux looks like without a config.', build: tmuxDefaultState },
];

export const defaultState = () => TEMPLATES[0].build();
