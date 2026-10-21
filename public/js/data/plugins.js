// Common TPM plugins. `gui: true` plugins provide status-bar widgets (see widgets.js).
// options: plugin settings (set -g @name value) editable in the Plugins tab.

export const PLUGINS = [
  { repo: 'tmux-plugins/tmux-sensible', name: 'tmux-sensible', desc: 'A set of sane defaults everyone agrees on (faster escape, bigger history, better keys).', tags: ['defaults', 'sane', 'basic', 'recommended'] },
  { repo: 'tmux-plugins/tmux-resurrect', name: 'tmux-resurrect', desc: 'Save and restore sessions, windows, panes and programs across reboots (prefix C-s / C-r).', tags: ['save', 'restore', 'session', 'reboot', 'persist', 'backup'],
    options: [
      { name: '@resurrect-capture-pane-contents', type: 'bool', def: false, desc: 'Also restore the visible text of each pane.' },
      { name: '@resurrect-strategy-nvim', type: 'enum', values: ['', 'session'], def: '', desc: 'Restore Neovim sessions (needs vim-obsession).' },
      { name: '@resurrect-strategy-vim', type: 'enum', values: ['', 'session'], def: '', desc: 'Restore Vim sessions (needs vim-obsession).' },
    ] },
  { repo: 'tmux-plugins/tmux-continuum', name: 'tmux-continuum', desc: 'Automatic, continuous saving with tmux-resurrect, plus auto-restore when tmux starts.', tags: ['save', 'restore', 'automatic', 'persist', 'autosave'], requires: ['tmux-plugins/tmux-resurrect'],
    options: [
      { name: '@continuum-restore', type: 'bool', def: false, desc: 'Restore the last saved environment when tmux starts.' },
      { name: '@continuum-save-interval', type: 'number', def: 15, desc: 'Minutes between automatic saves (0 disables).' },
    ] },
  { repo: 'tmux-plugins/tmux-yank', name: 'tmux-yank', desc: 'Copy to the system clipboard from copy mode (y), on Linux, macOS and WSL.', tags: ['copy', 'clipboard', 'yank', 'paste'],
    options: [{ name: '@yank_selection_mouse', type: 'enum', values: ['clipboard', 'primary', 'secondary'], def: 'clipboard', desc: 'Clipboard used for mouse selections.' }] },
  { repo: 'christoomey/vim-tmux-navigator', name: 'vim-tmux-navigator', desc: 'Move between Vim splits and tmux panes with the same C-h/j/k/l keys.', tags: ['vim', 'neovim', 'navigation', 'panes', 'splits', 'move'] },
  { repo: 'tmux-plugins/tmux-pain-control', name: 'tmux-pain-control', desc: 'Standard pane bindings: h/j/k/l to move, H/J/K/L to resize, | and - to split.', tags: ['panes', 'split', 'resize', 'navigation', 'bindings'] },
  { repo: 'tmux-plugins/tmux-sessionist', name: 'tmux-sessionist', desc: 'Lightweight session management: switch (prefix g), create (C), kill (X), promote panes.', tags: ['session', 'switch', 'manage', 'create', 'kill'] },
  { repo: 'tmux-plugins/tmux-open', name: 'tmux-open', desc: 'Open highlighted file or URL from copy mode (o) or search the web for it (S).', tags: ['open', 'url', 'browser', 'file', 'copy mode'] },
  { repo: 'tmux-plugins/tmux-logging', name: 'tmux-logging', desc: 'Log pane output to a file, save scrollback and take "screenshots" of panes.', tags: ['log', 'logging', 'record', 'save', 'history', 'screenshot'] },
  { repo: 'tmux-plugins/tmux-sidebar', name: 'tmux-sidebar', desc: 'A directory tree sidebar for the current path (prefix Tab).', tags: ['tree', 'files', 'sidebar', 'explorer', 'directory'] },
  { repo: 'tmux-plugins/tmux-fpp', name: 'tmux-fpp', desc: 'Pick file paths from the screen with Facebook PathPicker (prefix f).', tags: ['files', 'paths', 'picker', 'open'] },
  { repo: 'sainnhe/tmux-fzf', name: 'tmux-fzf', desc: 'Manage sessions, windows, panes and commands with fzf (prefix F).', tags: ['fzf', 'fuzzy', 'search', 'switch', 'menu'] },
  { repo: 'wfxr/tmux-fzf-url', name: 'tmux-fzf-url', desc: 'Open any URL visible on screen with fzf (prefix u).', tags: ['url', 'links', 'fzf', 'browser', 'open'] },
  { repo: 'laktak/extrakto', name: 'extrakto', desc: 'Fuzzy-find and insert any text visible in the pane (prefix Tab).', tags: ['fzf', 'copy', 'text', 'extract', 'complete'] },
  { repo: 'omerxx/tmux-sessionx', name: 'tmux-sessionx', desc: 'A fancy fzf session manager with previews and zoxide integration.', tags: ['session', 'fzf', 'switch', 'zoxide', 'manager'] },

  // Status-bar plugins (they provide widgets)
  { repo: 'tmux-plugins/tmux-battery', name: 'tmux-battery', gui: true, desc: 'Battery percentage, icon and remaining time for the status bar.', tags: ['battery', 'charge', 'power', 'laptop', 'status'] },
  { repo: 'tmux-plugins/tmux-cpu', name: 'tmux-cpu', gui: true, desc: 'CPU, RAM and GPU usage for the status bar.', tags: ['cpu', 'ram', 'memory', 'gpu', 'load', 'status'] },
  { repo: 'tmux-plugins/tmux-prefix-highlight', name: 'tmux-prefix-highlight', gui: true, desc: 'Highlight when the prefix key is pressed (and copy/sync mode).', tags: ['prefix', 'highlight', 'indicator', 'status'],
    options: [
      { name: '@prefix_highlight_fg', type: 'colour', def: '', desc: 'Text colour of the highlight.' },
      { name: '@prefix_highlight_bg', type: 'colour', def: '', desc: 'Background of the highlight.' },
      { name: '@prefix_highlight_prefix_prompt', type: 'string', def: '', desc: 'Text shown instead of the prefix key, e.g. "Wait".' },
      { name: '@prefix_highlight_copy_prompt', type: 'string', def: '', desc: 'Text shown in copy mode, e.g. "Copy".' },
    ] },
  { repo: 'tmux-plugins/tmux-online-status', name: 'tmux-online-status', gui: true, desc: 'Online/offline indicator for the status bar.', tags: ['online', 'offline', 'network', 'internet', 'status'] },
  { repo: 'tmux-plugins/tmux-net-speed', name: 'tmux-net-speed', gui: true, desc: 'Network upload/download speed for the status bar.', tags: ['network', 'speed', 'bandwidth', 'status'] },
  { repo: 'xamut/tmux-weather', name: 'tmux-weather', gui: true, desc: 'Weather from wttr.in for the status bar.', tags: ['weather', 'temperature', 'forecast', 'status'] },
  { repo: 'MunifTanjim/tmux-mode-indicator', name: 'tmux-mode-indicator', gui: true, desc: 'Shows the current tmux mode (prefix, copy, sync) in the status bar.', tags: ['mode', 'indicator', 'prefix', 'copy', 'status'] },
  { repo: 'robhurring/tmux-spotify', name: 'tmux-spotify', gui: true, desc: 'Spotify now-playing info for the status bar (macOS).', tags: ['music', 'spotify', 'song', 'status'] },
];

export const PLUGIN_MAP = Object.fromEntries(PLUGINS.map((p) => [p.repo, p]));
