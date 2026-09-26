/*
The bin (plan D3 E7 and the API section): flags, several paths, stdout and stderr, exit codes. Spawns dist/cli.mjs on
temporary trees only.
*/
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {version} from '../helpers/builds.js';
import {makeTree} from '../helpers/tree.js';

const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url));
const RAW = '{"b":1,"a":[2]}';

function run(arguments_, cwd) {
  const child = spawnSync(process.execPath, [cli, ...arguments_], {cwd, encoding: 'utf8'});
  return {status: child.status, stdout: child.stdout.replaceAll('\r\n', '\n'), stderr: child.stderr.replaceAll('\r\n', '\n')};
}

test('--help and -h print the usage; --version and -v the version', () => {
  for (const flag of ['--help', '-h']) {
    const {status, stdout} = run([flag]);
    assert.equal(status, 0);
    assert.match(stdout, /Usage\n {4}\$ format-json-files \[options\] <path>/u);
  }

  for (const flag of ['--version', '-v']) {
    assert.deepEqual(run([flag]), {status: 0, stdout: `${version}\n`, stderr: ''});
  }
});

test('formats a directory quietly and exits 0', t => {
  const tree = makeTree({'a.json': RAW, 'sub/b.json': RAW});
  t.after(tree.remove);
  assert.deepEqual(run(['.'], tree.root), {status: 0, stdout: '', stderr: ''});
  assert.equal(tree.read('sub/b.json'), '{\n    "b": 1,\n    "a": [\n        2\n    ]\n}');
});

test('every option reaches the library', t => {
  const tree = makeTree({'a.json': RAW, 'node_modules/n.json': RAW, 'skip/s.json': RAW});
  t.after(tree.remove);
  const result = run(['--indent', '2', '--sort-keys', '--final-newline', '--eol', 'crlf', '--ignore', 'skip', '.'], tree.root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(tree.read('a.json'), '{\r\n  "a": [\r\n    2\r\n  ],\r\n  "b": 1\r\n}\r\n');
  assert.equal(tree.read('node_modules/n.json'), '{\r\n  "a": [\r\n    2\r\n  ],\r\n  "b": 1\r\n}\r\n');
  assert.equal(tree.read('skip/s.json'), RAW);
  assert.equal(run(['--indent', 'tab', '--no-ignore', 'skip'], tree.root).status, 0);
  assert.equal(tree.read('skip/s.json'), '{\n\t"b": 1,\n\t"a": [\n\t\t2\n\t]\n}');
});

test('--check lists the files that would change on stdout, writes nothing, exits 1; 0 when all are formatted', t => {
  const tree = makeTree({'a.json': RAW, 'done.json': '{\n    "a": 1\n}'});
  t.after(tree.remove);
  assert.deepEqual(run(['--check', '.'], tree.root), {status: 1, stdout: 'a.json\n', stderr: ''});
  assert.equal(tree.read('a.json'), RAW);
  run(['.'], tree.root);
  assert.deepEqual(run(['--check', '.'], tree.root), {status: 0, stdout: '', stderr: ''});
});

test('skipped files go to stderr as "path: reason" and the exit code is 1', t => {
  const tree = makeTree({'bad.json': '{', 'id.json': '[12345678901234567890]', 'ok.json': RAW});
  t.after(tree.remove);
  const {status, stdout, stderr} = run(['bad.json', 'id.json', 'ok.json'], tree.root);
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /^bad\.json: not valid JSON: /mu);
  assert.match(stderr, /^id\.json: number cannot be kept exactly: 12345678901234567890$/mu);
  assert.equal(tree.read('ok.json'), '{\n    "b": 1,\n    "a": [\n        2\n    ]\n}');
});

test('usage errors: one line and a hint, exit 1, nothing written', t => {
  const tree = makeTree({'a.json': RAW});
  t.after(tree.remove);
  for (const arguments_ of [['--indent', 'x', '.'], ['--indent', '11', '.'], ['--eol', 'cr', '.'], ['--nope', '.'], ['--indent']]) {
    const {status, stdout, stderr} = run(arguments_, tree.root);
    assert.equal(status, 1, arguments_.join(' '));
    assert.equal(stdout, '');
    assert.match(stderr, /^error: .+\nRun format-json-files --help for the usage\.\n$/u, arguments_.join(' '));
  }

  assert.equal(tree.read('a.json'), RAW);
});

test('no path, and a path that does not exist: 1.0.6\'s error line without the stack trace; other paths still run', t => {
  const tree = makeTree({'a.json': RAW});
  t.after(tree.remove);
  assert.deepEqual(run([], tree.root), {status: 1, stdout: '', stderr: 'Error: Path argument not set\n'});
  const {status, stderr} = run(['missing', 'a.json'], tree.root);
  assert.equal(status, 1);
  assert.equal(stderr, 'Error: Invalid path\n  path: missing\n');
  assert.equal(tree.read('a.json'), '{\n    "b": 1,\n    "a": [\n        2\n    ]\n}');
});
