/*
The golden suite: every case recorded from the published 1.0.6 (test/golden/1.0.6.json, captured by capture-1.0.6.cjs over
the trees in capture-fixtures.cjs) runs again against both builds and the bin, on a fresh copy of the same tree.

The contract (plan D1): the same files chosen, the same bytes written, the same argument errors thrown, the same exit status
and error lines from the bin. Never regenerate the JSON from this repository's code and never loosen a comparison. What 2.x
changes on purpose is listed once, below, as a named exception with its changelog line (plan D3, E1 to E8).
*/
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readdirSync, lstatSync, readFileSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {builds, version} from '../helpers/builds.js';

const load = createRequire(import.meta.url);
const {decode, capture} = load('./codec.cjs');
const {trees, buildTree, normalizeOutput, setReadonly} = load('./capture-fixtures.cjs');
const golden = JSON.parse(readFileSync(new URL('1.0.6.json', import.meta.url), 'utf8'));
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url));

// E1 (CHANGELOG: Changed, breaking): files whose rewrite would change a value are left alone and reported.
const LOSSY_FILES = new Set(['big-integer.json', 'duplicate-keys.json', 'negative-zero.json', 'big-float.json', 'latin1.json']);
// E2 (CHANGELOG: Changed): a UTF-8 byte order mark is dropped and the file formatted.
const FORMATTED_WITH_BOM_DROPPED = {'bom.json': '{\n    "a": 1\n}'};
// E5 (CHANGELOG: Changed, breaking): the walk does not enter node_modules or .git by default.
const isIgnoredByDefault = relative => /^(?:node_modules|\.git)\//u.test(relative);
// E4 (CHANGELOG: Changed, breaking): the library logs nothing and returns a report instead of undefined; the bin prints
// skipped files on stderr, so nothing reaches stdout unless asked for (help, version, --check).
// E7 (CHANGELOG: Changed, breaking): the bin exits 1 when a file was skipped, parses its flags strictly, takes several paths.
const TREE_OF_ONE = {'one.json': '{\n    "a": 2343,\n    "b": "asdf"\n}'};
const CLI_EXCEPTIONS = {
  'cli-help': {name: 'E7 new help text', stdout: stdout => assert.match(stdout, /--sort-keys/u)},
  'cli-version': {name: 'E7 the version is 2.x', stdout: stdout => assert.equal(stdout, `${version}\n`)},
  'cli-directory': {name: 'E7 exit 1 when bad.json is skipped', status: 1},
  'cli-invalid-file': {name: 'E7 exit 1 when bad.json is skipped', status: 1},
  'cli-relative-dot': {name: 'E7 exit 1 when bad.json is skipped', status: 1},
  'cli-unknown-flag': {name: 'E7 --sort-keys is a flag, so "." is the path: one.json formatted, bad.json skipped', status: 1, stderrErrors: [], files: TREE_OF_ONE},
  'cli-short-flag': {name: 'E7 -h is help', status: 0, stderrErrors: [], stdout: stdout => assert.match(stdout, /Usage/u)},
  'cli-two-paths': {name: 'E7 every path is formatted', files: {'one.txt': '{\n    "a": 1\n}'}},
};

const originalBytes = content => (typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content.base64, 'base64'));
const encodeBytes = buffer => {
  const text = buffer.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buffer) ? text : {base64: buffer.toString('base64')};
};

const substitute = (value, root) => {
  if (typeof value === 'string') {
    return value.replaceAll('{{root}}', root);
  }

  return Array.isArray(value) ? value.map(item => substitute(item, root)) : value;
};

// Every regular file's bytes, and which paths are links (not followed).
function readTree(root) {
  const files = {};
  const links = new Set();
  const walk = directory => {
    for (const entry of readdirSync(directory)) {
      const full = path.join(directory, entry);
      const relative = path.relative(root, full).split(path.sep).join('/');
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) {
        links.add(relative);
      } else if (stat.isDirectory()) {
        walk(full);
      } else {
        files[relative] = readFileSync(full);
      }
    }
  };

  walk(root);
  return {files, links};
}

// Builds the case's tree, runs `run(root)` and returns what it returned with the tree before and after.
function inTree(entry, setup, run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fjf-golden-'));
  try {
    if (entry.tree) {
      buildTree(root, trees[entry.tree]);
    }

    setup?.(root);
    const before = readTree(root);
    const outcome = run(root);
    return {root, outcome, before, after: readTree(root)};
  } finally {
    for (const relative of Object.keys(trees.readonly)) {
      try {
        setReadonly(root, relative, false);
      } catch {}
    }

    rmSync(root, {recursive: true, force: true});
  }
}

// The bytes each recorded file must hold after the run, with the file-level exceptions applied.
function expectedFiles(entry, fileOverrides = {}) {
  const tree = trees[entry.tree] ?? {};
  const walkedFromTreeRoot = entry.kind === 'library' ? entry.args.at(0) === '{{root}}' : entry.args.includes('{{root}}');
  const expected = {};
  for (const [relative, recorded] of Object.entries(entry.files)) {
    if (recorded.link) {
      continue;
    }

    const name = relative.split('/').at(-1);
    let bytes = recorded.bytes;
    if (recorded.written && LOSSY_FILES.has(name)) {
      bytes = encodeBytes(originalBytes(tree[relative]));
    } else if (FORMATTED_WITH_BOM_DROPPED[name] !== undefined && entry.tree === 'invalid') {
      bytes = FORMATTED_WITH_BOM_DROPPED[name];
    } else if (walkedFromTreeRoot && isIgnoredByDefault(relative)) {
      bytes = encodeBytes(originalBytes(tree[relative]));
    }

    expected[relative] = fileOverrides[relative] ?? bytes;
  }

  return expected;
}

function assertFiles(entry, run, fileOverrides) {
  const expected = expectedFiles(entry, fileOverrides);
  const actual = Object.fromEntries(Object.entries(run.after.files).map(([relative, bytes]) => [relative, encodeBytes(bytes)]));
  assert.deepEqual(actual, expected);

  // E3 (CHANGELOG: Changed): a file is written only when its bytes change, so an unchanged file keeps its mtime. The
  // recording's `written` flags differ from 2.x's on purpose; bytes are what the promise covers.
  for (const [relative, recorded] of Object.entries(entry.files)) {
    if (recorded.link) {
      assert.ok(run.after.links.has(relative), `${relative} is still a link`);
    }
  }
}

// Paths 1.0.6 reported as skipped, from its log lines.
function skippedBy106(lines) {
  return lines.flatMap(line => {
    const match = /^Error processing target file: (.*), skipping\.$/u.exec(line);
    return match ? [match[1]] : [];
  });
}

const libraryCases = golden.cases.filter(entry => entry.kind === 'library');
const cliCases = golden.cases.filter(entry => entry.kind === 'cli');

for (const {name, lib} of builds) {
  const formatJsonFiles = lib.default;

  describe(`1.0.6 golden library cases (${name} build)`, () => {
    for (const entry of libraryCases) {
      test(entry.id, () => {
        const setup = entry.id === 'dir-twice' ? root => formatJsonFiles(root) : (entry.id === 'dir-readonly' ? root => setReadonly(root, 'locked.json', true) : undefined);
        const printed = [];
        const run = inTree(entry, setup, root => {
          const saved = {log: console.log, error: console.error, warn: console.warn};
          const previousDirectory = process.cwd();
          console.log = (...items) => printed.push(items.join(' '));
          console.error = console.log;
          console.warn = console.log;
          let report;
          try {
            if (entry.cwd) {
              process.chdir(path.join(root, entry.cwd));
            }

            const result = capture(() => {
              report = formatJsonFiles(...substitute(decode(entry.args), root));
              return report;
            });
            return {result, report, normalize: text => normalizeOutput(text, root)};
          } finally {
            Object.assign(console, saved);
            process.chdir(previousDirectory);
          }
        });

        const {result, report, normalize} = run.outcome;
        // E4: nothing printed.
        assert.deepEqual(printed, []);
        if (entry.result.$throws === undefined) {
          // E4: a report instead of undefined. Every file 1.0.6 skipped is skipped here, and every other skip is a named exception.
          assert.deepEqual(Object.keys(report), ['changed', 'unchanged', 'skipped']);
          const skipped = report.skipped.map(item => normalize(item.path));
          for (const path106 of skippedBy106(entry.stdout)) {
            if (FORMATTED_WITH_BOM_DROPPED[path106.split('/').at(-1)] !== undefined) {
              continue;
            }

            assert.ok(skipped.includes(path106), `${path106} is reported as skipped`);
          }

          for (const [index, skippedPath] of skipped.entries()) {
            const baseName = skippedPath.split('/').at(-1);
            const reason = report.skipped[index].reason;
            const known = skippedBy106(entry.stdout).includes(skippedPath) || LOSSY_FILES.has(baseName);
            assert.ok(known, `${skippedPath} (${reason}) was not skipped by 1.0.6 and is no named exception`);
          }
        } else {
          assert.deepEqual({...result, $throws: normalize(result.$throws)}, entry.result);
        }

        assertFiles(entry, run);
      });
    }
  });
}

describe('1.0.6 golden bin cases', () => {
  for (const entry of cliCases) {
    test(entry.id, () => {
      const exception = CLI_EXCEPTIONS[entry.id];
      const run = inTree(entry, undefined, root => {
        const child = spawnSync(process.execPath, [cli, ...substitute(entry.args, root)], {
          cwd: path.join(root, entry.cwd),
          encoding: 'utf8',
          env: {...process.env, NO_COLOR: '1'},
        });
        return {
          status: child.status,
          stdout: normalizeOutput(child.stdout, root).replaceAll('\r\n', '\n'),
          stderr: normalizeOutput(child.stderr, root),
        };
      });
      const {status, stdout, stderr} = run.outcome;
      const stderrErrors = stderr.split(/\r?\n/u).filter(line => /^[A-Za-z]*Error\b/u.test(line));

      assert.equal(status, exception?.status ?? entry.status);
      assert.deepEqual(stderrErrors, exception?.stderrErrors ?? entry.stderrErrors);
      if (exception?.stdout) {
        exception.stdout(stdout);
      } else {
        // E4: 1.0.6 printed skipped files on stdout; 2.x prints them on stderr, one "path: reason" line each.
        assert.equal(stdout, '');
        for (const path106 of skippedBy106(entry.stdout.split('\n'))) {
          assert.ok(stderr.split(/\r?\n/u).some(line => line.startsWith(`${path106}: `)), `${path106} is listed on stderr`);
        }
      }

      assertFiles(entry, run, exception?.files);
    });
  }
});
