// Zero-dependency static server for tmux-wysiwyg.
// Everything (state, config generation, import) runs in the browser, so the
// server only has to serve files fast and safely.
//
// Env: PORT (8080), HOST (0.0.0.0), STATIC_DIR (../public), DEV=1 (no caching, re-read files)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', 'public'));
const DEV = process.env.DEV === '1' || process.argv.includes('--dev');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest)|image\/svg)/;

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

/** Load every file under ROOT into memory (the app is tiny). */
function loadFiles() {
  const files = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.isFile()) continue;
      const type = TYPES[path.extname(entry.name).toLowerCase()];
      if (!type) continue;
      const body = fs.readFileSync(abs);
      const rel = '/' + path.relative(ROOT, abs).split(path.sep).join('/');
      files.set(rel, {
        body,
        gzip: COMPRESSIBLE.test(type) && body.length > 1024 ? zlib.gzipSync(body, { level: 9 }) : null,
        type,
        etag: '"' + crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20) + '"',
      });
    }
  };
  walk(ROOT);
  return files;
}

let FILES = loadFiles();

function send(req, res, status, headers, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(req, res, 400, { 'Content-Type': 'text/plain' }, 'Bad request'); }

  if (pathname === '/healthz') return send(req, res, 200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'ok');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }, 'Method not allowed');

  if (DEV) FILES = loadFiles();
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = FILES.get(pathname);
  if (!file) {
    // Unknown paths without an extension get the app (handy behind a sub-path proxy).
    if (!path.extname(pathname) && FILES.has('/index.html')) return serve(req, res, FILES.get('/index.html'));
    return send(req, res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
  }
  return serve(req, res, file);
});

function serve(req, res, file) {
  const headers = {
    'Content-Type': file.type,
    ETag: file.etag,
    // Revalidate every time: files are small and ETags make it a cheap 304.
    'Cache-Control': DEV ? 'no-store' : 'no-cache',
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === file.etag) return send(req, res, 304, headers);
  const gz = file.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gz) headers['Content-Encoding'] = 'gzip';
  const body = gz ? file.gzip : file.body;
  headers['Content-Length'] = body.length;
  return send(req, res, 200, headers, body);
}

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

server.listen(PORT, HOST, () => {
  console.log(`tmux-wysiwyg listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} (${FILES.size} files from ${ROOT}${DEV ? ', dev mode' : ''})`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
