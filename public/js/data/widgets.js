// Draggable status-bar widgets.
// format(p) returns the tmux format for the widget's content (no padding/icon).
// render(p, deco) is used instead for widgets that are conditional (deco adds padding + icon).
// vars(sim) supplies sample values for the preview; sample is shown for #(shell) output.

import { uid } from '../util.js';

export const lit = (s) => String(s ?? '').replace(/#/g, '##');
const litc = (s) => lit(s).replace(/,/g, '#,').replace(/}/g, '#}');
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

/** Conditional widget helper: #{?flag,<styled on text>,<off text>} */
function cond(flag, p, deco) {
  const st = (p.onFg ? `#[fg=${p.onFg}]` : '') + (p.onBg ? `#[bg=${p.onBg}]` : '') + (p.onBold ? '#[bold]' : '');
  const on = p.onText ? st + deco(litc(p.onText)) : '';
  const off = p.offText ? deco(litc(p.offText)) : '';
  return `#{?${flag},${on},${off}}`;
}
const condParams = (onText, onBg) => [
  { key: 'onText', label: 'Text when active', type: 'text', def: onText },
  { key: 'offText', label: 'Text when inactive', type: 'text', def: '' },
  { key: 'onFg', label: 'Active text colour', type: 'colour', def: onBg ? 'black' : '' },
  { key: 'onBg', label: 'Active background', type: 'colour', def: onBg || '' },
];

export const WIDGET_CATEGORIES = ['Session & windows', 'Indicators', 'Date & time', 'System', 'Network & weather', 'Developer', 'Media', 'Custom'];

export const WIDGETS = [
  // ── Session & windows
  { type: 'session', name: 'Session name', icon: '', cat: 'Session & windows', desc: 'Name of the current session (#S).', tags: ['session', 'name', 'workspace', 'project'], format: () => '#S' },
  { type: 'window-name', name: 'Window name', icon: '', cat: 'Session & windows', desc: 'Name of the current window (#W).', tags: ['window', 'name', 'title', 'tab'], format: () => '#W' },
  { type: 'window-index', name: 'Window number', icon: '', cat: 'Session & windows', desc: 'Index of the current window (#I).', tags: ['window', 'index', 'number'], format: () => '#I' },
  { type: 'pane-index', name: 'Pane number', icon: '', cat: 'Session & windows', desc: 'Index of the active pane (#P).', tags: ['pane', 'index', 'number'], format: () => '#P' },
  { type: 'pane-title', name: 'Pane title', icon: '', cat: 'Session & windows', desc: 'Title of the active pane (#T). Rename it with select-pane -T.', tags: ['pane', 'title', 'name', 'rename'],
    params: [{ key: 'max', label: 'Max length (0 = no limit)', type: 'number', def: 24 }],
    format: (p) => (+p.max > 0 ? `#{=${+p.max}:pane_title}` : '#T') },
  { type: 'pane-command', name: 'Running program', icon: '', cat: 'Session & windows', desc: 'Program running in the active pane (vim, ssh, node…).', tags: ['pane', 'program', 'process', 'command', 'running'], format: () => '#{pane_current_command}' },
  { type: 'path', name: 'Current directory', icon: '📁', cat: 'Session & windows', desc: 'Working directory of the active pane.', tags: ['path', 'directory', 'folder', 'cwd', 'pwd', 'location'],
    params: [{ key: 'mode', label: 'Show', type: 'select', def: 'folder', options: [['folder', 'Folder name only'], ['full', 'Full path']] }],
    format: (p) => (p.mode === 'full' ? '#{pane_current_path}' : '#{b:pane_current_path}') },
  { type: 'window-count', name: 'Window count', icon: '▦', cat: 'Session & windows', desc: 'Number of windows in this session.', tags: ['windows', 'count', 'total'], format: () => '#{session_windows}' },
  { type: 'session-count', name: 'Session count', icon: '◫', cat: 'Session & windows', desc: 'Number of running sessions.', tags: ['sessions', 'count', 'total'], format: () => '#{server_sessions}' },

  // ── Indicators
  { type: 'prefix', name: 'Prefix indicator', icon: '', cat: 'Indicators', desc: 'Lights up while the prefix key is pressed. No plugin needed.', tags: ['prefix', 'leader', 'key pressed', 'indicator', 'highlight', 'mode'],
    params: condParams('PREFIX', 'red'), render: (p, deco) => cond('client_prefix', p, deco) },
  { type: 'zoom', name: 'Zoom indicator', icon: '', cat: 'Indicators', desc: 'Shows when the current pane is zoomed (prefix z).', tags: ['zoom', 'fullscreen', 'maximize', 'indicator'],
    params: condParams('ZOOM', 'yellow'), render: (p, deco) => cond('window_zoomed_flag', p, deco) },
  { type: 'sync', name: 'Sync indicator', icon: '', cat: 'Indicators', desc: 'Shows when synchronize-panes is on (typing goes to all panes).', tags: ['sync', 'synchronize', 'broadcast', 'indicator'],
    params: condParams('SYNC', 'magenta'), render: (p, deco) => cond('pane_synchronized', p, deco) },
  { type: 'copy-mode', name: 'Copy-mode indicator', icon: '', cat: 'Indicators', desc: 'Shows when the pane is in copy/scroll mode.', tags: ['copy', 'scroll', 'mode', 'indicator', 'selection'],
    params: condParams('COPY', 'cyan'), render: (p, deco) => cond('pane_in_mode', p, deco) },
  { type: 'prefix-highlight', name: 'Prefix highlight (plugin)', icon: '', cat: 'Indicators', plugin: 'tmux-plugins/tmux-prefix-highlight',
    desc: 'The popular tmux-prefix-highlight plugin: shows prefix, copy and sync modes.', tags: ['prefix', 'highlight', 'plugin', 'copy mode', 'indicator'],
    params: [{ key: 'copy', label: 'Also show copy mode', type: 'bool', def: true }, { key: 'sync', label: 'Also show sync mode', type: 'bool', def: false }],
    pluginOptions: (p) => ({ '@prefix_highlight_show_copy_mode': p.copy ? 'on' : null, '@prefix_highlight_show_sync_mode': p.sync ? 'on' : null }),
    format: () => '#{prefix_highlight}',
    vars: (sim) => ({ prefix_highlight: sim.prefix ? '#[fg=colour231,bg=colour04] ^B #[default]' : sim.copy ? '#[fg=black,bg=yellow] Copy #[default]' : '' }) },
  { type: 'mode-indicator', name: 'Mode indicator (plugin)', icon: '', cat: 'Indicators', plugin: 'MunifTanjim/tmux-mode-indicator',
    desc: 'Shows WAIT / COPY / SYNC / TMUX depending on the current mode.', tags: ['mode', 'prefix', 'copy', 'sync', 'indicator', 'plugin'],
    format: () => '#{tmux_mode_indicator}',
    vars: (sim) => ({ tmux_mode_indicator: sim.prefix ? '#[bg=blue,fg=black,bold] WAIT #[default]' : sim.copy ? '#[bg=yellow,fg=black,bold] COPY #[default]' : sim.sync ? '#[bg=red,fg=black,bold] SYNC #[default]' : '#[bg=cyan,fg=black,bold] TMUX #[default]' }) },

  // ── Date & time
  { type: 'time', name: 'Clock', icon: '', cat: 'Date & time', desc: 'Current time. Uses strftime codes: %H:%M, %I:%M %p, %T…', tags: ['time', 'clock', 'hour', 'minute', 'watch'], escapePercent: false,
    params: [{ key: 'fmt', label: 'Format', type: 'text', def: '%H:%M', suggest: ['%H:%M', '%H:%M:%S', '%I:%M %p', '%R', '%T'] }],
    format: (p) => lit(p.fmt) },
  { type: 'date', name: 'Date', icon: '', cat: 'Date & time', desc: 'Current date. Uses strftime codes: %Y-%m-%d, %a %d %b, %V (week)…', tags: ['date', 'calendar', 'day', 'month', 'year', 'week', 'today'], escapePercent: false,
    params: [{ key: 'fmt', label: 'Format', type: 'text', def: '%Y-%m-%d', suggest: ['%Y-%m-%d', '%d.%m.%Y', '%a %d %b', '%A', 'W%V', '%d/%m/%y'] }],
    format: (p) => lit(p.fmt) },

  // ── System
  { type: 'hostname', name: 'Hostname', icon: '', cat: 'System', desc: 'Name of the machine — handy when you ssh into servers.', tags: ['host', 'hostname', 'machine', 'computer', 'server', 'ssh'],
    params: [{ key: 'short', label: 'Short name (without domain)', type: 'bool', def: true }],
    format: (p) => (p.short ? '#h' : '#H') },
  { type: 'user', name: 'Username', icon: '', cat: 'System', desc: 'The logged-in user.', tags: ['user', 'username', 'login', 'whoami', 'account'], format: () => '#(whoami)', sample: 'you' },
  { type: 'battery', name: 'Battery', icon: '', cat: 'System', plugin: 'tmux-plugins/tmux-battery',
    desc: 'Battery charge with icon, via tmux-battery.', tags: ['battery', 'charge', 'charging', 'power', 'energy', 'laptop', 'akku', 'percent'],
    params: [{ key: 'showIcon', label: 'Show battery icon', type: 'bool', def: true }, { key: 'showRemain', label: 'Show time remaining', type: 'bool', def: false }],
    format: (p) => `${p.showIcon ? '#{battery_icon} ' : ''}#{battery_percentage}${p.showRemain ? ' #{battery_remain}' : ''}`,
    vars: () => ({ battery_icon: '🔋', battery_percentage: '87%', battery_remain: '(3:12)' }) },
  { type: 'cpu', name: 'CPU usage', icon: 'CPU', cat: 'System', plugin: 'tmux-plugins/tmux-cpu', desc: 'CPU load percentage, via tmux-cpu.', tags: ['cpu', 'processor', 'load', 'usage', 'performance'],
    params: [{ key: 'showIcon', label: 'Show load icon', type: 'bool', def: false }],
    format: (p) => `${p.showIcon ? '#{cpu_icon} ' : ''}#{cpu_percentage}`, vars: () => ({ cpu_icon: '▃', cpu_percentage: '12.5%' }) },
  { type: 'ram', name: 'RAM usage', icon: 'RAM', cat: 'System', plugin: 'tmux-plugins/tmux-cpu', desc: 'Memory usage percentage, via tmux-cpu.', tags: ['ram', 'memory', 'mem', 'usage'],
    format: () => '#{ram_percentage}', vars: () => ({ ram_percentage: '43.1%' }) },
  { type: 'load', name: 'Load average', icon: '', cat: 'System', desc: 'System load average from uptime (no plugin).', tags: ['load', 'average', 'cpu', 'uptime'],
    format: () => "#(uptime | sed -E 's/.*load averages?: //; s/,//g')", sample: '0.52 0.48 0.40' },
  { type: 'uptime', name: 'Uptime', icon: '⏻', cat: 'System', desc: 'How long the machine has been up.', tags: ['uptime', 'running', 'boot'],
    format: () => "#(uptime | sed -E 's/.*up +([^,]*),.*/\\1/')", sample: '3 days' },
  { type: 'disk', name: 'Disk usage', icon: '💾', cat: 'System', desc: 'Used space on / (no plugin).', tags: ['disk', 'storage', 'space', 'hdd', 'ssd', 'df'],
    params: [{ key: 'mount', label: 'Mount point', type: 'text', def: '/' }],
    format: (p) => `#(df -h ${shq(p.mount || '/')} | awk 'NR==2 {print $5}')`, sample: '61%' },

  // ── Network & weather
  { type: 'weather', name: 'Weather', icon: '', cat: 'Network & weather', desc: 'Current weather from wttr.in (cached, no plugin) or the tmux-weather plugin.', tags: ['weather', 'temperature', 'forecast', 'rain', 'sun', 'wttr', 'climate'],
    plugin: (p) => (p.source === 'plugin' ? 'xamut/tmux-weather' : null),
    params: [
      { key: 'source', label: 'Source', type: 'select', def: 'wttr', options: [['wttr', 'wttr.in via curl (no plugin)'], ['plugin', 'xamut/tmux-weather plugin']] },
      { key: 'location', label: 'Location (empty = detect by IP)', type: 'text', def: '' },
      { key: 'units', label: 'Units', type: 'select', def: 'm', options: [['m', 'Metric (°C)'], ['u', 'Imperial (°F)']] },
      { key: 'fmt', label: 'Show', type: 'select', def: '%c%t', options: [['%c%t', 'Icon + temperature'], ['%c %t %w', 'Icon, temperature, wind'], ['%C %t', 'Condition + temperature'], ['%t', 'Temperature only']] },
      { key: 'cache', label: 'Refresh every (minutes)', type: 'number', def: 15 },
    ],
    pluginOptions: (p) => (p.source === 'plugin' ? { '@tmux-weather-location': p.location || null, '@tmux-weather-units': p.units, '@tmux-weather-format': p.fmt, '@tmux-weather-interval': String(+p.cache || 15) } : {}),
    format: (p) => {
      if (p.source === 'plugin') return '#{weather}';
      const loc = encodeURIComponent((p.location || '').trim()).replace(/%20/g, '+');
      const url = `wttr.in/${loc}?${p.units}&format=${p.fmt.replace(/ /g, '+')}`;
      const mins = Math.max(1, +p.cache || 15);
      return `#(f=/tmp/tmux-weather-$USER; find $f -mmin -${mins} 2>/dev/null | grep -q . || curl -fsm 5 '${url}' > $f; cat $f)`;
    },
    vars: () => ({ weather: '☀️ +18°C' }), sample: '☀️ +18°C' },
  { type: 'online', name: 'Online status', icon: '', cat: 'Network & weather', plugin: 'tmux-plugins/tmux-online-status', desc: 'Shows whether you are online, via tmux-online-status.', tags: ['online', 'offline', 'internet', 'network', 'connection', 'wifi'],
    params: [{ key: 'on', label: 'Online icon', type: 'text', def: '●' }, { key: 'off', label: 'Offline icon', type: 'text', def: '○' }],
    pluginOptions: (p) => ({ '@online_icon': p.on, '@offline_icon': p.off }),
    format: () => '#{online_status}', vars: () => ({ online_status: '●' }) },
  { type: 'net-speed', name: 'Network speed', icon: '⇅', cat: 'Network & weather', plugin: 'tmux-plugins/tmux-net-speed', desc: 'Download/upload speed, via tmux-net-speed.', tags: ['network', 'speed', 'bandwidth', 'download', 'upload', 'internet'],
    format: () => '#{net_speed}', vars: () => ({ net_speed: 'D: 1.2 MB/s U: 64 KB/s' }) },

  // ── Developer
  { type: 'git', name: 'Git branch', icon: '⎇', cat: 'Developer', desc: 'Git branch of the active pane\'s directory.', tags: ['git', 'branch', 'repo', 'repository', 'vcs', 'version control'],
    format: () => "#(cd '#{pane_current_path}' && git rev-parse --abbrev-ref HEAD 2>/dev/null)", sample: 'main' },
  { type: 'kube', name: 'Kubernetes context', icon: '⎈', cat: 'Developer', desc: 'Current kubectl context.', tags: ['kubernetes', 'k8s', 'kubectl', 'context', 'cluster'],
    format: () => '#(kubectl config current-context 2>/dev/null)', sample: 'prod-eu' },
  { type: 'docker', name: 'Running containers', icon: '🐳', cat: 'Developer', desc: 'Number of running Docker containers.', tags: ['docker', 'containers', 'podman'],
    format: () => "#(docker ps -q 2>/dev/null | wc -l | tr -d ' ')", sample: '4' },

  // ── Media
  { type: 'spotify', name: 'Now playing (Spotify)', icon: '♫', cat: 'Media', plugin: 'robhurring/tmux-spotify', desc: 'Current Spotify track (macOS), via tmux-spotify.', tags: ['music', 'spotify', 'song', 'track', 'playing', 'audio'],
    format: () => '#{music_status} #{artist} – #{track}', vars: () => ({ music_status: '▶', artist: 'Daft Punk', track: 'Get Lucky' }) },

  // ── Custom
  { type: 'text', name: 'Custom text', icon: '', cat: 'Custom', desc: 'Any static text or emoji.', tags: ['text', 'label', 'custom', 'static', 'emoji', 'name', 'separator', 'spacer'],
    params: [{ key: 'text', label: 'Text', type: 'text', def: 'hello' }], format: (p) => lit(p.text) },
  { type: 'shell', name: 'Shell command', icon: '', cat: 'Custom', desc: 'Output of any shell command, re-run every status-interval seconds.', tags: ['shell', 'command', 'script', 'custom', 'exec', 'output'],
    params: [{ key: 'cmd', label: 'Command', type: 'text', def: 'echo hi' }, { key: 'sample', label: 'Preview text', type: 'text', def: 'hi' }],
    format: (p) => `#(${p.cmd})`, sampleFrom: (p) => p.sample },
  { type: 'format', name: 'Raw tmux format', icon: '', cat: 'Custom', desc: 'Any tmux format string, e.g. #{?client_prefix,⌨,} or #[fg=red]#S. For power users and imported configs.', tags: ['format', 'raw', 'custom', 'advanced', 'expression'], escapePercent: false,
    params: [{ key: 'format', label: 'tmux format', type: 'textarea', def: '#S' }], format: (p) => p.format },
];

export const WIDGET_MAP = Object.fromEntries(WIDGETS.map((w) => [w.type, w]));
export const getWidget = (type) => WIDGET_MAP[type];

export function widgetParams(w) {
  const def = getWidget(w.type);
  const out = {};
  for (const p of def?.params || []) out[p.key] = p.def;
  return { ...out, ...(w.params || {}) };
}

export function widgetPlugin(w) {
  const def = getWidget(w.type);
  if (!def) return null;
  return typeof def.plugin === 'function' ? def.plugin(widgetParams(w)) : def.plugin || null;
}

export function makeWidget(type, extra = {}) {
  const def = getWidget(type);
  const params = {};
  for (const p of def.params || []) params[p.key] = p.def;
  return { id: uid(), type, params, icon: def.icon || '', fg: '', bg: '', attrs: [], pad: true, ...extra, params: { ...params, ...(extra.params || {}) } };
}
