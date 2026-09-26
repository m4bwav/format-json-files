// A consumer written as an ES module: default and named imports of the installed package, on a temporary tree it makes and
// removes itself. Runs under Node, Bun and Deno.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import formatJsonFiles, {formatJsonFiles as named} from 'format-json-files';

assert.equal(typeof formatJsonFiles, 'function');
assert.equal(named, formatJsonFiles, 'the default export is the named export');
if (typeof import.meta.resolve === 'function') {
  assert.match(import.meta.resolve('format-json-files'), /\/dist\/index\.mjs$/u, 'import resolves to the ESM build');
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fjf-consumer-esm-'));
try {
  fs.writeFileSync(path.join(root, 'b.json'), '{"b":1,"a":[2]}');
  fs.writeFileSync(path.join(root, 'id.json'), '{"id":12345678901234567890}');
  const checked = formatJsonFiles(root, {check: true, sortKeys: true, indent: 2});
  assert.equal(checked.changed.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'b.json'), 'utf8'), '{"b":1,"a":[2]}', 'check mode writes nothing');
  const report = formatJsonFiles(root, {sortKeys: true, indent: 2, finalNewline: true});
  assert.equal(fs.readFileSync(path.join(root, 'b.json'), 'utf8'), '{\n  "a": [\n    2\n  ],\n  "b": 1\n}\n');
  assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason]), [['id.json', 'number cannot be kept exactly: 12345678901234567890']]);
  assert.equal(fs.readFileSync(path.join(root, 'id.json'), 'utf8'), '{"id":12345678901234567890}');
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}

console.log('esm-node ok');
