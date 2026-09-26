// A consumer written in CommonJS: require() of the installed package, called exactly as 1.0.6's README showed it (plan D2),
// on a temporary tree it makes and removes itself.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const formatJsonFiles = require('format-json-files');
// Destructuring, the named-import habit in CommonJS.
const {formatJsonFiles: named} = require('format-json-files');

assert.match(require.resolve('format-json-files'), /[/\\]dist[/\\]index\.cjs$/u, 'require resolves to the CommonJS build');
assert.equal(typeof formatJsonFiles, 'function');
assert.equal(named, formatJsonFiles);
assert.equal(formatJsonFiles.default, formatJsonFiles);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fjf-consumer-cjs-'));
try {
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'data', 'a.json'), '{"a":2343, "b":"asdf"}');
  // The old README's call.
  const report = formatJsonFiles(path.join(root, 'data'));
  assert.equal(fs.readFileSync(path.join(root, 'data', 'a.json'), 'utf8'), '{\n    "a": 2343,\n    "b": "asdf"\n}');
  assert.deepEqual(report.skipped, []);
  assert.throws(() => formatJsonFiles(path.join(root, 'missing')), {message: 'Invalid path'});
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}

console.log('cjs-node ok');
