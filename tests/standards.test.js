// Verifies the standards labels: every code is well formed, every recorded skill id is either labeled or knowingly left out.
const S = require('../js/standards.js');
const assert = require('assert');

Object.keys(S.CODES).forEach((k) => {
  assert.ok(S.CODES[k].length > 0, k + ' has codes');
  S.CODES[k].forEach((c) => assert.ok(S.CODE_RE.test(c), k + ': bad code ' + c));
  assert.strictEqual(new Set(S.CODES[k]).size, S.CODES[k].length, k + ' repeats a code');
});
assert.strictEqual(S.label('rounding'), 'Can practise: 3.NBT.A.1');
assert.strictEqual(S.label('even-odd'), '', 'an unverified skill is unlabeled, never guessed');
assert.strictEqual(S.label('constructor'), '', 'a prototype name is not a skill');
assert.deepStrictEqual(S.codesFor('nope'), []);
S.codesFor('rounding').push('x');
assert.deepStrictEqual(S.codesFor('rounding'), ['3.NBT.A.1'], 'callers get a copy');

// Every skill any game can record is labeled or in the known-unlabeled list.
const skills = new Set();
[require('../js/engine.js').SKILLS, require('../js/runlogic.js').SKILLS, require('../js/archerylogic.js').SKILLS, require('../js/elogic.js').SKILLS,
 require('../js/cutshare.js').SKILLS, require('../js/sortrule.js').SKILLS].forEach((o) => Object.keys(o).forEach((k) => skills.add(k)));
const unlabeled = ['even-odd', 'boss', 'code', 'machine', 'sort', 'lemon-price'];
skills.forEach((k) => assert.ok(S.codesFor(k).length || unlabeled.includes(k), 'skill ' + k + ' needs a verified code or an entry in the unlabeled list'));
console.log('standards ok (' + Object.keys(S.CODES).length + ' skills labeled)');
