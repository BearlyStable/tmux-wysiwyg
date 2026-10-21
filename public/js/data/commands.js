// tmux commands (glossary) and ready-made key-binding recipes.

const c = (name, alias, cat, desc, example, tags = []) => ({ name, alias, cat, desc, example, tags });

export const COMMANDS = [
  // Sessions
  c('new-session', 'new', 'Sessions', 'Create a new session. -A attaches if it already exists, -s names it.', 'new-session -A -s main', ['session', 'create', 'start']),
  c('attach-session', 'attach', 'Sessions', 'Attach this client to an existing session.', 'attach-session -t main', ['session', 'attach', 'connect']),
  c('detach-client', 'detach', 'Sessions', 'Detach the current client (default: prefix d).', 'detach-client', ['detach', 'leave', 'background']),
  c('rename-session', 'rename', 'Sessions', 'Rename the current session (default: prefix $).', 'command-prompt -I "#S" "rename-session \'%%\'"', ['session', 'rename', 'name']),
  c('kill-session', '', 'Sessions', 'Destroy a session and all its windows.', 'confirm-before -p "Kill session #S? (y/n)" kill-session', ['session', 'kill', 'close', 'quit']),
  c('switch-client', 'switchc', 'Sessions', 'Switch to another session (-n next, -p previous, -l last).', 'switch-client -l', ['session', 'switch', 'next', 'previous', 'last']),
  c('choose-tree', '', 'Sessions', 'Interactive tree of sessions, windows and panes (default: prefix s / w).', 'choose-tree -Zs', ['session', 'window', 'pick', 'switch', 'tree', 'list', 'navigate']),

  // Windows
  c('new-window', 'neww', 'Windows', 'Create a new window. -c sets the working directory.', 'new-window -c "#{pane_current_path}"', ['window', 'tab', 'create', 'new', 'open']),
  c('kill-window', 'killw', 'Windows', 'Close a window and all its panes (default: prefix &).', 'confirm-before -p "Kill window #W? (y/n)" kill-window', ['window', 'close', 'kill']),
  c('rename-window', 'renamew', 'Windows', 'Rename the current window (default: prefix ,).', 'command-prompt -I "#W" "rename-window \'%%\'"', ['window', 'rename', 'name', 'title']),
  c('select-window', 'selectw', 'Windows', 'Switch to a window by number or name (-t). Default: prefix 0–9.', 'select-window -t :=1', ['window', 'switch', 'go to', 'select']),
  c('next-window', 'next', 'Windows', 'Go to the next window (default: prefix n).', 'next-window', ['window', 'next', 'switch']),
  c('previous-window', 'prev', 'Windows', 'Go to the previous window (default: prefix p).', 'previous-window', ['window', 'previous', 'switch']),
  c('last-window', 'last', 'Windows', 'Toggle to the previously used window (default: prefix l).', 'last-window', ['window', 'last', 'toggle', 'back']),
  c('move-window', 'movew', 'Windows', 'Move a window to another index or session. move-window -r renumbers all windows to close gaps.', 'move-window -r', ['window', 'move', 'reindex', 'renumber', 'reorder', 'index']),
  c('swap-window', 'swapw', 'Windows', 'Swap two windows (reorder tabs). -d keeps focus on the moved window.', 'swap-window -d -t -1', ['window', 'swap', 'reorder', 'move', 'reindex']),
  c('rotate-window', 'rotatew', 'Windows', 'Rotate the positions of panes in a window (default: prefix C-o).', 'rotate-window', ['pane', 'rotate', 'cycle']),
  c('select-layout', 'selectl', 'Windows', 'Apply a layout: even-horizontal, even-vertical, main-vertical, tiled…', 'select-layout tiled', ['layout', 'arrange', 'tile', 'grid']),
  c('next-layout', 'nextl', 'Windows', 'Cycle through layouts (default: prefix Space).', 'next-layout', ['layout', 'cycle']),

  // Panes
  c('split-window', 'splitw', 'Panes', 'Split the current pane. -h side by side, -v stacked, -c keeps the directory.', 'split-window -h -c "#{pane_current_path}"', ['pane', 'split', 'vertical', 'horizontal', 'divide', 'new pane']),
  c('select-pane', 'selectp', 'Panes', 'Select a pane (-L/-R/-U/-D) or set its title with -T to rename it.', 'select-pane -L', ['pane', 'select', 'focus', 'move', 'navigate', 'title', 'rename']),
  c('kill-pane', 'killp', 'Panes', 'Close a pane (default: prefix x, with confirmation).', 'kill-pane', ['pane', 'close', 'kill']),
  c('resize-pane', 'resizep', 'Panes', 'Resize a pane (-L/-R/-U/-D N) or zoom it to full window with -Z.', 'resize-pane -Z', ['pane', 'resize', 'zoom', 'size', 'fullscreen', 'maximize']),
  c('swap-pane', 'swapp', 'Panes', 'Swap panes (-U/-D or -s/-t). Default: prefix { and }.', 'swap-pane -D', ['pane', 'swap', 'move', 'reorder', 'reindex']),
  c('break-pane', 'breakp', 'Panes', 'Move a pane into its own new window (default: prefix !).', 'break-pane', ['pane', 'break', 'window', 'detach', 'move']),
  c('join-pane', 'joinp', 'Panes', 'Move a pane from another window into this one (inverse of break-pane).', 'join-pane -h -s !', ['pane', 'join', 'merge', 'move']),
  c('respawn-pane', 'respawnp', 'Panes', 'Restart the program in a pane (-k kills the current one).', 'respawn-pane -k', ['pane', 'restart', 'respawn', 'reload']),
  c('display-panes', 'displayp', 'Panes', 'Show pane numbers; press a number to jump to that pane (default: prefix q).', 'display-panes', ['pane', 'numbers', 'index', 'jump']),
  c('pipe-pane', 'pipep', 'Panes', 'Pipe pane output to a shell command — handy for logging. -o toggles.', 'pipe-pane -o "cat >> ~/tmux-#S-#I-#P.log"', ['pane', 'log', 'record', 'pipe', 'output']),
  c('capture-pane', 'capturep', 'Panes', 'Copy pane contents into a buffer or stdout (-p).', 'capture-pane -S -', ['pane', 'capture', 'screenshot', 'copy', 'history']),
  c('clear-history', 'clearhist', 'Panes', 'Delete the scrollback history of a pane.', 'clear-history', ['pane', 'clear', 'history', 'scrollback', 'reset']),

  // Copy mode & buffers
  c('copy-mode', '', 'Copy mode', 'Enter copy/scroll mode (default: prefix [).', 'copy-mode', ['copy', 'scroll', 'select', 'search']),
  c('paste-buffer', 'pasteb', 'Copy mode', 'Paste the most recent buffer (default: prefix ]).', 'paste-buffer -p', ['paste', 'buffer', 'clipboard']),
  c('choose-buffer', '', 'Copy mode', 'Pick a buffer to paste from a list (default: prefix =).', 'choose-buffer -Z', ['paste', 'buffer', 'history', 'clipboard']),
  c('send-keys', 'send', 'Copy mode', 'Send keys to a pane, or copy-mode commands with -X (e.g. begin-selection).', 'send-keys -X begin-selection', ['keys', 'type', 'send', 'copy mode', 'selection']),

  // Interaction
  c('display-message', 'display', 'Interaction', 'Show a message in the status line (or print a format with -p).', 'display-message "Hello #S"', ['message', 'notify', 'print', 'status']),
  c('display-popup', 'popup', 'Interaction', 'Open a floating popup window running a command (tmux 3.2+).', 'display-popup -E -w 80% -h 80% -d "#{pane_current_path}"', ['popup', 'floating', 'overlay', 'modal', 'scratch']),
  c('display-menu', 'menu', 'Interaction', 'Show a menu of commands (tmux 3.0+).', 'display-menu -T "Quick" "Split |" | "split-window -h" "Split -" - "split-window -v"', ['menu', 'context', 'right click']),
  c('command-prompt', '', 'Interaction', 'Open the tmux command prompt (default: prefix :), optionally with a template.', 'command-prompt -p "Pane title:" "select-pane -T \'%%\'"', ['prompt', 'input', 'ask', 'command line']),
  c('confirm-before', 'confirm', 'Interaction', 'Ask y/n before running a command.', 'confirm-before -p "Really? (y/n)" kill-server', ['confirm', 'ask', 'safety']),
  c('clock-mode', '', 'Interaction', 'Show a big clock in the pane (default: prefix t).', 'clock-mode', ['clock', 'time']),

  // Config & scripting
  c('source-file', 'source', 'Config', 'Load a config file — use it to reload your config without restarting.', 'source-file ~/.tmux.conf \\; display-message "Config reloaded"', ['reload', 'config', 'load', 'refresh']),
  c('set-option', 'set', 'Config', 'Set an option (-g global, -w window, -s server, -u unset).', 'set -g mouse on', ['option', 'set', 'configure']),
  c('bind-key', 'bind', 'Config', 'Bind a key (-n without prefix, -r repeatable, -T key table).', 'bind-key r source-file ~/.tmux.conf', ['key', 'bind', 'shortcut', 'mapping', 'hotkey']),
  c('unbind-key', 'unbind', 'Config', 'Remove a key binding.', 'unbind-key C-b', ['key', 'unbind', 'remove', 'shortcut']),
  c('list-keys', 'lsk', 'Config', 'List all key bindings (default: prefix ?).', 'list-keys -N', ['keys', 'help', 'cheatsheet', 'shortcuts']),
  c('run-shell', 'run', 'Config', 'Run a shell command (-b in background). Used to load TPM.', 'run-shell -b "~/.tmux/plugins/tpm/tpm"', ['shell', 'run', 'script', 'exec']),
  c('if-shell', 'if', 'Config', 'Run a tmux command conditionally on a shell command or format (-F).', 'if -F "#{==:#{status},on}" "set status off" "set status on"', ['if', 'condition', 'toggle']),
  c('refresh-client', 'refresh', 'Config', 'Redraw the client; -S refreshes only the status line.', 'refresh-client -S', ['refresh', 'redraw', 'status']),
  c('kill-server', '', 'Config', 'Kill the tmux server and all sessions.', 'confirm-before kill-server', ['kill', 'quit', 'exit', 'server']),
];

export const COMMAND_MAP = Object.fromEntries(COMMANDS.map((x) => [x.name, x]));

// Key-binding recipes: one click adds the bindings.
const r = (id, title, cat, desc, bindings, tags = []) => ({ id, title, cat, desc, bindings, tags });
const b = (key, command, extra = {}) => ({ key, command, table: 'prefix', repeat: false, ...extra });

export const RECIPES = [
  r('split-h', 'Split side by side with |', 'Panes', 'prefix | splits the pane left/right and keeps the current directory.', [b('|', 'split-window -h -c "#{pane_current_path}"')], ['split', 'vertical', 'pane', 'pipe']),
  r('split-v', 'Split top/bottom with -', 'Panes', 'prefix - splits the pane top/bottom and keeps the current directory.', [b('-', 'split-window -v -c "#{pane_current_path}"')], ['split', 'horizontal', 'pane', 'dash']),
  r('unbind-splits', 'Remove default split keys', 'Panes', 'Unbind the hard-to-remember defaults " and %.', [b('"', '', { unbind: true }), b('%', '', { unbind: true })], ['split', 'unbind', 'default']),
  r('new-window-path', 'New window in current directory', 'Windows', 'prefix c opens a new window in the same directory as the current pane.', [b('c', 'new-window -c "#{pane_current_path}"')], ['window', 'new', 'path', 'directory']),
  r('reload', 'Reload config with r', 'Config', 'prefix r reloads ~/.tmux.conf and shows a message.', [b('r', 'source-file ~/.tmux.conf \\; display-message "Config reloaded"')], ['reload', 'source', 'config', 'refresh']),
  r('vim-nav', 'Vim-style pane navigation (h j k l)', 'Panes', 'prefix h/j/k/l moves between panes.', [b('h', 'select-pane -L'), b('j', 'select-pane -D'), b('k', 'select-pane -U'), b('l', 'select-pane -R')], ['vim', 'navigate', 'move', 'pane', 'hjkl']),
  r('vim-resize', 'Vim-style resizing (H J K L)', 'Panes', 'prefix H/J/K/L resizes the pane; keep pressing to repeat.', [b('H', 'resize-pane -L 5', { repeat: true }), b('J', 'resize-pane -D 5', { repeat: true }), b('K', 'resize-pane -U 5', { repeat: true }), b('L', 'resize-pane -R 5', { repeat: true })], ['vim', 'resize', 'size', 'pane']),
  r('alt-arrows', 'Alt+arrows switch panes (no prefix)', 'Panes', 'Alt + arrow keys move between panes without pressing the prefix.', [b('M-Left', 'select-pane -L', { table: 'root' }), b('M-Right', 'select-pane -R', { table: 'root' }), b('M-Up', 'select-pane -U', { table: 'root' }), b('M-Down', 'select-pane -D', { table: 'root' })], ['navigate', 'arrows', 'alt', 'meta', 'pane', 'fast']),
  r('shift-arrows', 'Shift+arrows switch windows (no prefix)', 'Windows', 'Shift + left/right moves to the previous/next window.', [b('S-Left', 'previous-window', { table: 'root' }), b('S-Right', 'next-window', { table: 'root' })], ['window', 'switch', 'arrows', 'shift', 'tabs']),
  r('alt-numbers', 'Alt+1…9 select windows (no prefix)', 'Windows', 'Jump straight to a window with Alt + number.', Array.from({ length: 9 }, (_, i) => b(`M-${i + 1}`, `select-window -t :=${i + 1}`, { table: 'root' })), ['window', 'switch', 'number', 'alt', 'jump']),
  r('rename-pane', 'Rename pane with T', 'Panes', 'prefix T asks for a new pane title (shown with pane-border-status).', [b('T', 'command-prompt -p "Pane title:" "select-pane -T \'%%\'"')], ['pane', 'rename', 'title', 'name', 'label']),
  r('renumber-now', 'Renumber windows with R', 'Windows', 'prefix R closes gaps in window numbers right now.', [b('R', 'move-window -r \\; display-message "Windows renumbered"')], ['window', 'renumber', 'reindex', 'reorder', 'index']),
  r('swap-windows', 'Move window left/right with < >', 'Windows', 'prefix < / > moves the current window tab left or right.', [b('<', 'swap-window -d -t -1', { repeat: true }), b('>', 'swap-window -d -t +1', { repeat: true })], ['window', 'swap', 'move', 'reorder', 'reindex', 'tabs']),
  r('swap-panes', 'Swap panes with { }', 'Panes', 'prefix { / } swaps the pane with the previous/next one (tmux default, made repeatable).', [b('{', 'swap-pane -U', { repeat: true }), b('}', 'swap-pane -D', { repeat: true })], ['pane', 'swap', 'move', 'reorder', 'reindex']),
  r('sync', 'Toggle synchronized panes with S', 'Panes', 'prefix S types into all panes at once (toggle).', [b('S', 'setw synchronize-panes \\; display-message "sync #{?synchronize-panes,on,off}"')], ['sync', 'broadcast', 'all panes', 'toggle']),
  r('popup', 'Popup shell with g', 'Interaction', 'prefix g opens a floating terminal in the current directory (tmux 3.2+).', [b('g', 'display-popup -E -w 80% -h 80% -d "#{pane_current_path}"')], ['popup', 'floating', 'scratch', 'terminal', 'overlay']),
  r('lazygit', 'Lazygit popup with G', 'Interaction', 'prefix G opens lazygit in a popup (needs lazygit installed).', [b('G', 'display-popup -E -w 90% -h 90% -d "#{pane_current_path}" lazygit')], ['git', 'lazygit', 'popup']),
  r('kill-pane', 'Close pane without asking', 'Panes', 'prefix x closes the pane immediately instead of asking y/n.', [b('x', 'kill-pane')], ['pane', 'close', 'kill', 'confirm']),
  r('toggle-status', 'Toggle status bar with b', 'Status bar', 'prefix b hides/shows the status bar.', [b('b', 'if -F "#{==:#{status},on}" "set status off" "set status on"')], ['status', 'hide', 'show', 'toggle', 'bar']),
  r('toggle-mouse', 'Toggle mouse with m', 'Config', 'prefix m switches mouse mode on/off.', [b('m', 'set -g mouse \\; display-message "mouse #{?mouse,on,off}"')], ['mouse', 'toggle']),
  r('vi-copy', 'Vi copy keys (v / y / C-v)', 'Copy mode', 'In copy mode: v starts selection, y copies, C-v toggles rectangle. Set mode-keys to vi too.', [
    b('v', 'send-keys -X begin-selection', { table: 'copy-mode-vi' }),
    b('y', 'send-keys -X copy-selection-and-cancel', { table: 'copy-mode-vi' }),
    b('C-v', 'send-keys -X rectangle-toggle', { table: 'copy-mode-vi' })], ['copy', 'vi', 'vim', 'yank', 'select', 'clipboard']),
  r('last-window', 'Last window with Tab', 'Windows', 'prefix Tab jumps back to the previous window.', [b('Tab', 'last-window')], ['window', 'last', 'toggle', 'back']),
  r('session-tree', 'Session picker with s', 'Sessions', 'prefix s shows a zoomed tree of sessions, sorted by name.', [b('s', 'choose-tree -Zs -O name')], ['session', 'switch', 'pick', 'tree']),
  r('new-session', 'New session with N', 'Sessions', 'prefix N asks for a name and creates (or attaches to) a session.', [b('N', 'command-prompt -p "New session:" "new-session -A -s \'%%\'"')], ['session', 'new', 'create']),
  r('kill-session', 'Kill session with X', 'Sessions', 'prefix X kills the current session after confirmation.', [b('X', 'confirm-before -p "Kill session #S? (y/n)" kill-session')], ['session', 'kill', 'close']),
  r('join-pane', 'Join last window\'s pane with @', 'Panes', 'prefix @ pulls the pane from the last window into this one (side by side).', [b('@', 'join-pane -h -s !')], ['pane', 'join', 'merge', 'move']),
  r('log-pane', 'Toggle pane logging with P', 'Panes', 'prefix P toggles logging of the pane output to ~/tmux-<session>-<window>-<pane>.log.', [b('P', 'pipe-pane -o "cat >> ~/tmux-#S-#I-#P.log" \\; display-message "Toggled logging"')], ['pane', 'log', 'record', 'save']),
  r('clear', 'Clear screen and history with K', 'Panes', 'prefix K clears the screen and the scrollback of the pane.', [b('K', 'send-keys -R \\; clear-history')], ['clear', 'history', 'scrollback', 'reset']),
];

// tmux's built-in prefix bindings (subset) — used to warn about overrides.
export const DEFAULT_KEYS = {
  'C-b': 'send-prefix', 'C-o': 'rotate-window', 'C-z': 'suspend-client', 'Space': 'next-layout', '!': 'break-pane', '"': 'split-window (top/bottom)',
  '#': 'list-buffers', '$': 'rename-session', '%': 'split-window -h (side by side)', '&': 'kill-window', "'": 'select window by index', '(': 'previous client',
  ')': 'next client', ',': 'rename-window', '-': 'delete-buffer', '.': 'move-window', '0': 'select-window 0', '1': 'select-window 1', '2': 'select-window 2',
  '3': 'select-window 3', '4': 'select-window 4', '5': 'select-window 5', '6': 'select-window 6', '7': 'select-window 7', '8': 'select-window 8',
  '9': 'select-window 9', ':': 'command-prompt', ';': 'last-pane', '=': 'choose-buffer', '?': 'list-keys', 'D': 'choose-client', 'E': 'spread panes evenly',
  'L': 'switch to last session', 'M': 'clear marked pane', '[': 'copy-mode', ']': 'paste-buffer', 'c': 'new-window', 'd': 'detach-client', 'f': 'find window',
  'i': 'display window info', 'l': 'last-window', 'm': 'mark pane', 'n': 'next-window', 'o': 'next pane', 'p': 'previous-window', 'q': 'display-panes',
  'r': 'refresh-client', 's': 'choose-tree (sessions)', 't': 'clock-mode', 'w': 'choose-tree (windows)', 'x': 'kill-pane (confirm)', 'z': 'zoom pane',
  '{': 'swap-pane -U', '}': 'swap-pane -D', '~': 'show-messages', 'Up': 'select-pane -U', 'Down': 'select-pane -D', 'Left': 'select-pane -L',
  'Right': 'select-pane -R', 'M-1': 'layout even-horizontal', 'M-2': 'layout even-vertical', 'M-3': 'layout main-horizontal', 'M-4': 'layout main-vertical',
  'M-5': 'layout tiled', 'C-Up': 'resize-pane -U', 'C-Down': 'resize-pane -D', 'C-Left': 'resize-pane -L', 'C-Right': 'resize-pane -R',
};
