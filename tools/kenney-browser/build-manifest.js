#!/usr/bin/env node
// Scans the Kenney bundle and writes out/manifest.json (category, pack, path, size, width, height), optionally with thumbnails.
// Local tool only: it lives in tools/, which tools/build-site.sh keeps out of the deployed site. Nothing here is copied into the game.
// Usage: node tools/kenney-browser/build-manifest.js [--bundle DIR] [--thumbs] [--all]
//   --thumbs  also make 96 px thumbnails with ffmpeg into out/thumbs/ (slow the first time, then skips existing ones)
//   --all     also scan "3D assets" (default: 2D assets, UI assets, Icons)
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BUNDLE = opt('--bundle') || process.env.KENNEY_BUNDLE || '/Volumes/JentMini Drive/AI Projects/Kenney Game Assets All-in-1 3.8.0';
const OUT = path.join(__dirname, 'out');
const CATS = ['2D assets', 'UI assets', 'Icons'].concat(args.includes('--all') ? ['3D assets'] : []);
const EXT = new Set(['.png', '.svg', '.jpg', '.jpeg']);

function pngSize(file) {   // width and height from the IHDR chunk, no image library needed
  const fd = fs.openSync(file, 'r'), b = Buffer.alloc(24);
  try { fs.readSync(fd, b, 0, 24, 0); } finally { fs.closeSync(fd); }
  return b.toString('latin1', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : [null, null];
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(e.name).toLowerCase())) yield p;
  }
}

const items = [];
for (const cat of CATS) {
  const root = path.join(BUNDLE, cat);
  if (!fs.existsSync(root)) { console.warn('missing folder, skipped:', root); continue; }
  for (const f of walk(root)) {
    const rel = path.relative(BUNDLE, f), parts = rel.split(path.sep);
    const st = fs.statSync(f), isPng = f.toLowerCase().endsWith('.png');
    const [w, h] = isPng ? pngSize(f) : [null, null];
    items.push({ id: items.length, category: cat, pack: parts[1] || cat, path: rel.split(path.sep).join('/'), name: path.basename(f), bytes: st.size, width: w, height: h });
  }
}
items.sort((a, b) => a.path.localeCompare(b.path));
items.forEach((it, i) => { it.id = i; });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ bundle: path.basename(BUNDLE), made: new Date().toISOString(), count: items.length, items }));
console.log(`manifest.json: ${items.length} images in ${new Set(items.map((i) => i.pack)).size} packs`);

if (args.includes('--thumbs')) {
  const dir = path.join(OUT, 'thumbs'); fs.mkdirSync(dir, { recursive: true });
  const todo = items.filter((i) => i.path.toLowerCase().endsWith('.png') && !fs.existsSync(path.join(dir, i.id + '.png')));
  let done = 0, failed = 0, next = 0;
  const one = () => new Promise((res) => {
    const it = todo[next++]; if (!it) return res(false);
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(BUNDLE, it.path), '-vf', "scale='min(96,iw)':'min(96,ih)':force_original_aspect_ratio=decrease:flags=lanczos", path.join(dir, it.id + '.png')]);
    p.on('error', () => { failed++; res(true); });   // ffmpeg missing
    p.on('close', (c) => { c ? failed++ : done++; if ((done + failed) % 500 === 0) console.log(`thumbs ${done + failed}/${todo.length}`); res(true); });
  });
  (async () => { await Promise.all(Array.from({ length: 8 }, async () => { while (await one()); })); console.log(`thumbs: ${done} made, ${failed} failed, ${items.length - todo.length} already there`); })();
}
