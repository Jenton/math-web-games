// Run with: node tests/site-build.test.js
// Verifies the folder that gets PUBLISHED to Firebase Hosting (tools/build-site.sh): it contains nothing private (no .git, no
// workflow files, no docs/tests/tools/markdown, no Firebase rules) AND it is complete (every script, stylesheet, image, sound and font
// the game refers to is in it). This is what would have caught the hosted site losing every Kenney asset, and publishing .git.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'mq-site-'));
execFileSync('bash', [path.join(ROOT, 'tools/build-site.sh'), OUT], { cwd: ROOT, stdio: 'pipe' });

function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + '/') : [base + e.name]));
}
const files = walk(OUT);
const has = (p) => fs.existsSync(path.join(OUT, p));

/* ---------- nothing private is published ---------- */
const bad = [];
files.forEach((f) => {
  const segs = f.split('/');
  if (segs.some((s) => s.startsWith('.'))) bad.push(f + ' (dotfile or dot-folder: .git, .github, .firebase ...)');
  if (/^(docs|tests|tools|_site)\//.test(f)) bad.push(f + ' (docs, tests, tools)');
  if (/\.md$/i.test(f)) bad.push(f + ' (markdown)');
  if (/^firestore\./.test(f) || f === '.firebaserc') bad.push(f + ' (Firebase rules/config)');
  if (/node_modules\//.test(f)) bad.push(f + ' (node_modules)');
  if (/^assets\/(incoming|Kenney Game)/.test(f)) bad.push(f + ' (raw asset bundle)');
  if (/service.?account|private.?key|\.pem$|\.env$/i.test(f)) bad.push(f + ' (looks like a secret)');
});
assert.deepStrictEqual(bad, [], 'the published folder contains files that must not be public:\n  ' + bad.join('\n  '));
assert.ok(!has('.git'), 'no .git folder');

// the published firebase.json holds hosting only: never the Firestore rules, and not the repo's case-insensitive "ignore" list
const fb = JSON.parse(fs.readFileSync(path.join(OUT, 'firebase.json'), 'utf8'));
assert.deepStrictEqual(Object.keys(fb), ['hosting']);
assert.strictEqual(fb.hosting.public, '.');
// exactly Firebase's three standard exclusions, stated explicitly (omitting them published firebase.json itself), and nothing broader:
// a repo-specific pattern here once hid every Kenney asset because Firebase matches case-insensitively
assert.deepStrictEqual(fb.hosting.ignore, ['firebase.json', '**/.*', '**/node_modules/**'], 'the published config must exclude firebase.json itself and dotfiles, and carry no other pattern');
assert.ok(fb.hosting.headers && fb.hosting.headers.length, 'security headers are kept');

/* ---------- the site is complete ---------- */
assert.ok(has('index.html'), 'index.html is published');
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const local = (u) => u && !/^(https?:|data:|#|mailto:|\/\/)/.test(u);
const missing = [];
const need = (p, from) => { const clean = decodeURIComponent(p.split('?')[0].split('#')[0]); if (clean && !has(clean)) missing.push(clean + '   (referenced from ' + from + ')'); };

// every <script src> and <link href> in index.html
[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].forEach((m) => local(m[1]) && need(m[1], 'index.html'));
[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].forEach((m) => local(m[1]) && need(m[1], 'index.html'));
[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].forEach((m) => local(m[1]) && need(m[1], 'index.html'));

// every url(...) in every stylesheet (relative to the stylesheet)
files.filter((f) => f.endsWith('.css')).forEach((f) => {
  const css = fs.readFileSync(path.join(OUT, f), 'utf8');
  [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].forEach((m) => {
    if (!local(m[1])) return;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
    need(resolved, f);
  });
});

// every literal assets/... path written in a script or the HTML
const ASSET = /assets\/[A-Za-z0-9_\-\/.%]+\.(?:png|jpg|jpeg|webp|gif|svg|mp3|ogg|wav|m4a|ttf|woff2?)/g;
[...files.filter((f) => f.endsWith('.js')), 'index.html'].forEach((f) => {
  const src = fs.readFileSync(path.join(OUT, f), 'utf8');
  [...src.matchAll(ASSET)].forEach((m) => need(m[0], f));
});
assert.deepStrictEqual(missing, [], 'the game refers to files that are NOT in the published folder (they would 404 on the hosted site):\n  ' + [...new Set(missing)].join('\n  '));

// the Kenney art and sound that the first deploy lost are really there
assert.ok(files.some((f) => /^assets\/kenney\/.+\.png$/.test(f)), 'Kenney images are published');
assert.ok(files.some((f) => /^assets\/kenney\/sfx\//.test(f)), 'Kenney sounds are published');
assert.ok(files.some((f) => /^assets\/quest\//.test(f)), 'Creature Quest art is published');

console.log(`OK: the published folder has ${files.length} files, nothing private (no .git, .github, docs, tests, tools, markdown, rules or secrets), and every script, stylesheet, image, sound and font the game refers to is in it.`);
fs.rmSync(OUT, { recursive: true, force: true });
