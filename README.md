# tmux-wysiwyg

A visual, in-browser editor for your `~/.tmux.conf`. You drag widgets into a live status bar, search every option and command, add key bindings with one click, and download the finished config.

* **WYSIWYG status bar.** Drag widgets (session, clock, battery, weather, git branch, CPU…) into the left or right side. Drop them on the dashed strip to move the bar to the top or bottom. You can reorder chips by dragging, or drop one on the trash to remove it.
* **The preview is rendered from the real config.** The status bar is drawn by interpreting the generated tmux formats (`#{…}`, `#(…)`, `#[…]`, strftime, conditionals), so the preview shows what tmux will show. Toggle *prefix pressed*, *zoomed*, *copy mode* or *sync* to see indicators react.
* **Glossary search.** It tolerates typos (`batery` finds Battery) and matches synonyms (`charge`, `rename pane`, `reindex`). Each result can be acted on:
  * widgets can be dragged or added with `+L`/`+R`
  * options can be edited in place (toggles, colour pickers, style editors)
  * key-binding recipes are added with one click
  * any command can be bound to a key
* **Plugins (TPM).** Status-bar plugins (tmux-battery, tmux-cpu, prefix-highlight, online-status, weather…) are added automatically when you use their widget. Other popular plugins can be toggled, with their settings.
* **Themes and templates.** Catppuccin, Nord, Dracula, Gruvbox, Tokyo Night, Solarized and Minimal. Separator styles: plain, Powerline arrows, rounded pills, brackets and pipes.
* **Import** an existing `.tmux.conf`. Options, bindings, plugins and status formats are imported, and anything else is kept verbatim.
* **Share links.** The whole config is compressed into the URL hash. Nothing is stored on the server.
* **Undo/redo**, with autosave to localStorage.

Everything runs in the browser. The server only serves static files, so hosting it publicly is cheap and safe.

## Run locally

```sh
docker compose up -d --build
# → http://localhost:8080
```

Without Docker (Node ≥ 18, no dependencies):

```sh
npm start          # or: node server/server.js
npm run dev        # re-reads files on every request, no caching
npm test           # unit tests (generator, importer, search, format engine)
```

## Host it (e.g. tmux.example.com)

1. Point the domain's DNS A/AAAA record at your server.
2. Start the app together with Caddy, which gets and renews Let's Encrypt certificates automatically:

```sh
cp .env.example .env    # set DOMAIN=tmux.example.com
docker compose --profile hosted up -d --build
```

The app container is bound to `127.0.0.1` by default, so only Caddy is exposed. If you already have a reverse proxy (nginx, Traefik…), skip the profile and proxy to the app's port.

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port published on the host |
| `BIND` | `127.0.0.1` | Host interface for the app port (`0.0.0.0` to expose it directly) |
| `DOMAIN` | – | Public hostname for the `hosted` profile |

The container runs as a non-root user with a read-only filesystem and all capabilities dropped. The server sends a strict CSP and has a `/healthz` endpoint.

## Project layout

```
server/server.js          zero-dependency static server (gzip, ETag, CSP, healthz)
public/index.html         app shell
public/js/
  data/widgets.js         status-bar widgets  ← add new widgets here
  data/options.js         tmux options glossary
  data/commands.js        commands, key-binding recipes, default keys
  data/plugins.js         TPM plugins
  data/themes.js          colour themes + templates
  generator.js            state → .tmux.conf
  format.js               tmux format interpreter for the preview
  importer.js             .tmux.conf → state
  search.js               typo-tolerant search
  store.js                state, undo/redo, persistence, share links
  ui/                     preview (drag & drop), inspector, sidebar, output
test/                     node:test unit tests
deploy/Caddyfile          TLS reverse proxy for hosting
```

### Adding a widget

Add an entry to `public/js/data/widgets.js`:

```js
{ type: 'ip', name: 'Local IP', icon: '🌐', cat: 'Network & weather',
  desc: 'IP address of this machine.', tags: ['ip', 'address', 'network'],
  format: () => "#(hostname -I | cut -d' ' -f1)", sample: '192.168.1.20' },
```

`format` returns the tmux format, `sample` is what the preview shows for `#(…)` output, and `plugin: 'owner/repo'` makes the generator add the TPM plugin automatically.

## Ideas / roadmap

* Multi-line status bars (`status 2` + `status-format[]`)
* Theme plugins (catppuccin/tmux, dracula/tmux) with their own option editors
* Per-version compatibility check (warn about 3.2+/3.3+ options)
* Server-side short share links (optional, opt-in)
* Visual pane-layout builder that generates a session script
