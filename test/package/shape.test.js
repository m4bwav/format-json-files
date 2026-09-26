/*
The package-shape suite. Every assertion guards a promise the plan made: what ships, that require() returns the function
(plan D2) while import sees a default and a named export, and that the library reaches nothing beyond Node's built-ins
(plan D9: Node-only by nature, no runtime dependencies).
*/
import assert from 'node:assert/strict';
import {exec} from 'node:child_process';
import {access, readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const packageJson = JSON.parse(await read('package.json'));

// Exactly what `npm pack` may contain; the CLI's source map stays out through `files`.
const PUBLISHED_FILES = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'dist/cli.mjs',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.cts',
  'dist/index.d.mts',
  'dist/index.mjs',
  'dist/index.mjs.map',
  'package.json',
];

// Set from the first build (about 26 kB); the two source maps are most of it.
const TARBALL_BUDGET = 40_000;

test('the tarball holds exactly the built files and the docs, and stays under the size budget', async () => {
  // --ignore-scripts: prepack would rebuild dist/ while the other test files are reading it.
  const stdout = await new Promise((resolve, reject) => {
    exec('npm pack --dry-run --json --ignore-scripts', {cwd: root, encoding: 'utf8'}, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
  const [packed] = JSON.parse(stdout);
  assert.deepEqual(new Set(packed.files.map(file => file.path)), new Set(PUBLISHED_FILES));
  assert.ok(packed.size < TARBALL_BUDGET, `the tarball is ${packed.size} bytes`);
});

test('package.json: entry points exist, the bin, no runtime dependencies, the Node floor', async () => {
  assert.equal(packageJson.type, 'module');
  assert.deepEqual(packageJson.exports, {
    '.': {import: './dist/index.mjs', require: './dist/index.cjs'},
    './package.json': './package.json',
  });
  assert.equal(packageJson.main, './dist/index.cjs');
  assert.equal(packageJson.module, './dist/index.mjs');
  assert.equal(packageJson.types, './dist/index.d.cts');
  assert.deepEqual(packageJson.bin, {'format-json-files': './dist/cli.mjs'});
  for (const file of ['dist/index.mjs', 'dist/index.cjs', 'dist/index.d.mts', 'dist/index.d.cts', 'dist/cli.mjs']) {
    await access(new URL(`../../${file}`, import.meta.url));
  }

  // A runtime dependency needs a decision entry; the default is none.
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.equal(packageJson.engines.node, '>=20');
  assert.equal(packageJson.sideEffects, false);
  // Trusted publishing matches this URL exactly.
  assert.equal(packageJson.repository.url, 'git+https://github.com/m4bwav/format-json-files.git');
});

test('the builds import only Node built-ins, by their node: names, and use no browser globals', async () => {
  for (const file of ['dist/index.mjs', 'dist/index.cjs', 'dist/cli.mjs']) {
    const code = await read(file);
    // Array.from, not Iterator#toArray: iterator helpers arrived in Node 22.
    const specifiers = Array.from(code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\(\s*)["'](?<specifier>[^"']+)["']/gu), match => match.groups.specifier);
    assert.ok(specifiers.length > 0, `${file} imports something`);
    for (const specifier of specifiers) {
      assert.match(specifier, /^node:/u, `${file} imports ${specifier}`);
    }

    assert.doesNotMatch(code, /\b(?:window|document)\b/u, `${file} uses a browser global`);
    assert.doesNotMatch(code, /\beval\(|new Function\(|child_process/u, `${file} runs code or processes`);
  }
});

test('the CLI starts with its shebang', async () => {
  const cli = await read('dist/cli.mjs');
  assert.ok(cli.startsWith('#!/usr/bin/env node\n'));
});

test('the declaration files need no Node types', async () => {
  for (const file of ['dist/index.d.mts', 'dist/index.d.cts']) {
    const types = await read(file);
    assert.doesNotMatch(types, /\bNodeJS\.|\bBuffer\b|node:|reference types=/u, file);
    assert.doesNotMatch(types, /sourceMappingURL/u, `${file} points at a declaration map that is not published`);
  }
});

test('the declaration files describe the two shapes: default and named in ESM, the callable `export =` in CommonJS', async () => {
  const [esm, cjs] = await Promise.all([read('dist/index.d.mts'), read('dist/index.d.cts')]);
  const signature = 'function formatJsonFiles(targetPath: string, options?: Options): Report;';
  assert.ok(esm.includes(`export declare ${signature}`), esm);
  assert.match(esm, /export \{[^}]*type Options as FormatOptions[^}]*formatJsonFiles as default \};/u);
  assert.ok(cjs.includes(`declare ${signature}`), cjs);
  assert.match(cjs, /type FormatOptions = Options;/u);
  assert.match(cjs, /\nexport = formatJsonFiles;/u);
  assert.doesNotMatch(cjs, /\nexport (?:\{|default|declare)/u, 'the CommonJS declaration has no ESM-style exports');
});
