'use strict';
// Golden capture of the PUBLISHED format-json-files 1.0.6 (package-modernize Phase 0, 2026-09-26).
// Run in a scratch project that installed format-json-files@1.0.6, with codec.cjs and capture-fixtures.cjs beside it:
//   node capture-1.0.6.cjs > 1.0.6.json
// Every case builds its fixture tree in a fresh temporary directory and points the old version only at that tree.
// Recorded per case: what the call returned or threw, what it printed, and every file's bytes afterwards with whether
// it was rewritten. Library cases run in this process (console.log captured); CLI cases spawn the published bin.
// Arguments hold {{root}}, replaced by the tree's absolute path at run time; outputs have the root put back as {{root}}.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {encode, decode, capture} = require('./codec.cjs');
const {trees, buildTree, snapshotTree, normalizeOutput, setReadonly} = require('./capture-fixtures.cjs');

const formatJsonFiles = require('format-json-files');
const packageRoot = path.dirname(require.resolve('format-json-files/package.json'));
const cli = path.join(packageRoot, 'cli.js');

const substitute = (value, root) => {
  if (typeof value === 'string') {
    return value.replaceAll('{{root}}', root);
  }

  return Array.isArray(value) ? value.map(item => substitute(item, root)) : value;
};

function withTree(treeName, setup, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fjf-golden-'));
  try {
    const unavailable = treeName ? buildTree(root, trees[treeName]) : [];
    setup?.(root);
    const outcome = run(root);
    return {...outcome, unavailable, files: treeName ? snapshotTree(root) : {}};
  } finally {
    for (const relative of Object.keys(trees.readonly)) {
      try {
        setReadonly(root, relative, false);
      } catch {}
    }

    fs.rmSync(root, {recursive: true, force: true});
  }
}

function libraryCase(id, treeName, args, options = {}) {
  const outcome = withTree(treeName, options.setup, root => {
    const logged = [];
    const original = console.log;
    const previousDirectory = process.cwd();
    console.log = (...items) => logged.push(items.map(String).join(' '));
    try {
      if (options.cwd) {
        process.chdir(path.join(root, options.cwd));
      }

      const result = capture(() => formatJsonFiles(...substitute(decode(encode(args)), root)));
      return {result: normalizeResult(result, root), stdout: logged.map(line => normalizeOutput(line, root))};
    } finally {
      console.log = original;
      process.chdir(previousDirectory);
    }
  });
  return {id, kind: 'library', tree: treeName, args: encode(args), cwd: options.cwd ?? null, ...outcome};
}

function normalizeResult(result, root) {
  return result && typeof result === 'object' && '$throws' in result
    ? {...result, $throws: normalizeOutput(result.$throws, root)}
    : result;
}

function cliCase(id, treeName, args, options = {}) {
  const outcome = withTree(treeName, options.setup, root => {
    const run = spawnSync(process.execPath, [cli, ...substitute(args, root)], {
      cwd: options.cwd === undefined ? root : path.join(root, options.cwd),
      encoding: 'utf8',
      env: {...process.env, NO_COLOR: '1', FORCE_COLOR: '0'},
    });
    const stderr = normalizeOutput(run.stderr, root);
    return {
      status: run.status,
      stdout: normalizeOutput(run.stdout, root).replaceAll('\r\n', '\n'),
      // Stack traces name this machine's paths, the source line and the Node version; keep only the error lines.
      stderrErrors: stderr.split(/\r?\n/).filter(line => /^[A-Za-z]*Error\b/.test(line)),
    };
  });
  return {id, kind: 'cli', tree: treeName, args, cwd: options.cwd ?? '.', ...outcome};
}

const cases = [
  // Arguments.
  libraryCase('arg-missing', null, []),
  libraryCase('arg-undefined', null, [undefined]),
  libraryCase('arg-null', null, [null]),
  libraryCase('arg-empty-string', null, ['']),
  libraryCase('arg-zero', null, [0]),
  libraryCase('arg-false', null, [false]),
  libraryCase('arg-nan', null, [Number.NaN]),
  libraryCase('arg-number', null, [123]),
  libraryCase('arg-true', null, [true]),
  libraryCase('arg-object', null, [{}]),
  libraryCase('arg-array', null, [['{{root}}']]),
  libraryCase('arg-string-object', 'single', [new String('{{root}}')]),
  libraryCase('arg-nonexistent', 'single', ['{{root}}/missing']),
  libraryCase('arg-nonexistent-json', 'single', ['{{root}}/missing.json']),
  libraryCase('arg-extra-arguments', 'single', ['{{root}}/one.json', {sortKeys: true}, 'ignored']),
  libraryCase('arg-trailing-separator', 'single', ['{{root}}/']),
  libraryCase('arg-relative-dot', 'single', ['.'], {cwd: '.'}),
  libraryCase('arg-relative-file', 'single', ['one.json'], {cwd: '.'}),

  // A single file path: formatted whatever its extension.
  libraryCase('file-json', 'single', ['{{root}}/one.json']),
  libraryCase('file-txt', 'single', ['{{root}}/one.txt']),
  libraryCase('file-invalid', 'single', ['{{root}}/bad.json']),

  // Directory walks.
  libraryCase('dir-shapes', 'shapes', ['{{root}}']),
  libraryCase('dir-invalid', 'invalid', ['{{root}}']),
  libraryCase('dir-names', 'names', ['{{root}}']),
  libraryCase('dir-names-subdirectory', 'names', ['{{root}}/sub']),
  libraryCase('dir-links', 'links', ['{{root}}/inside']),
  libraryCase('file-through-junction', 'links', ['{{root}}/inside/dir-junction/other.json']),
  libraryCase('dir-junction-itself', 'links', ['{{root}}/inside/dir-junction']),
  libraryCase('dir-depth', 'depth', ['{{root}}']),
  libraryCase('dir-readonly', 'readonly', ['{{root}}'], {setup: root => setReadonly(root, 'locked.json', true)}),
  libraryCase('dir-dependent', 'dependent', ['{{root}}/sample-data']),
  libraryCase('dir-empty', 'names', ['{{root}}/sub/empty-dir']),

  // Idempotence: the files 1.0.6 wrote are rewritten on a second run with the same bytes.
  libraryCase('dir-twice', 'shapes', ['{{root}}'], {setup(root) {
    formatJsonFiles(root);
    const {FIXED_TIME} = require('./capture-fixtures.cjs');
    for (const name of Object.keys(trees.shapes)) {
      fs.utimesSync(path.join(root, name), FIXED_TIME, FIXED_TIME);
    }
  }}),

  // The published bin.
  cliCase('cli-help', null, ['--help']),
  cliCase('cli-version', null, ['--version']),
  cliCase('cli-no-arguments', 'single', []),
  cliCase('cli-directory', 'single', ['{{root}}']),
  cliCase('cli-file', 'single', ['{{root}}/one.json']),
  cliCase('cli-invalid-file', 'single', ['{{root}}/bad.json']),
  cliCase('cli-nonexistent', 'single', ['{{root}}/missing']),
  cliCase('cli-relative-dot', 'single', ['.']),
  cliCase('cli-two-paths', 'single', ['one.json', 'one.txt']),
  cliCase('cli-unknown-flag', 'single', ['--sort-keys', '.']),
  cliCase('cli-short-flag', 'single', ['-h']),
  cliCase('cli-dependent', 'dependent', ['sample-data']),
];

const quirks = {
  fileSymlinks: 'Windows without developer mode refuses file symbolic links (EPERM); cases that needed one list it under "unavailable" and the golden test skips those files.',
  nonSyntaxErrorInParse: 'readJsonFileToObject swallows any non-SyntaxError from JSON.parse and returns undefined; JSON.parse of a Buffer only throws SyntaxError in practice, so no case reaches that branch.',
};

const header = {
  package: `format-json-files@${require('format-json-files/package.json').version}`,
  dependencies: {meow: require('meow/package.json').version},
  node: process.version,
  platform: process.platform,
  captured: new Date().toISOString().slice(0, 10),
  note: 'Golden outputs of the published 1.0.6; see test/golden/capture-1.0.6.cjs, capture-fixtures.cjs and codec.cjs for the format.',
  quirks,
};

const lines = cases.map(entry => JSON.stringify(entry));
process.stdout.write(`${JSON.stringify(header, null, '\t').slice(0, -2)},\n\t"cases": [\n\t\t${lines.join(',\n\t\t')}\n\t]\n}\n`);
