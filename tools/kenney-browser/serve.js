#!/usr/bin/env node
// Serves the browser page, out/manifest.json, out/thumbs/ and the original files from the bundle, on localhost only.
// Usage: node tools/kenney-browser/serve.js [--bundle DIR] [--port 8765] [--host 127.0.0.1]   (env: KENNEY_BUNDLE, HOST)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { URL } = require('url');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BUNDLE = path.resolve(opt('--bundle', process.env.KENNEY_BUNDLE || '/Volumes/JentMini Drive/AI Projects/Kenney Game Assets All-in-1 3.8.0'));
const PORT = +opt('--port', 8765), HOST = opt('--host', process.env.HOST || '127.0.0.1'), HERE = __dirname;   // --host 0.0.0.0 only inside the container
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function send(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }); res.end(data);
  });
}
function inside(root, p) { const r = path.resolve(root, p); return r.startsWith(root + path.sep) ? r : null; }   // blocks ../ escapes

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost'), p = decodeURIComponent(u.pathname);
  if (p === '/' ) return send(res, path.join(HERE, 'index.html'));
  if (p === '/manifest.json') return send(res, path.join(HERE, 'out', 'manifest.json'));
  if (p.startsWith('/thumbs/')) { const f = inside(path.join(HERE, 'out', 'thumbs'), p.slice(8)); return f ? send(res, f) : (res.writeHead(403), res.end()); }
  if (p.startsWith('/file/')) { const f = inside(BUNDLE, p.slice(6)); return f ? send(res, f) : (res.writeHead(403), res.end()); }
  res.writeHead(404); res.end('not found');
}).listen(PORT, HOST, () => console.log(`Kenney browser: http://${HOST}:${PORT}/   (bundle: ${BUNDLE})`));
