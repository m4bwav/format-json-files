/**
Xo 5 flat config. Every override carries its reason; a rule turned off without a reason is a review finding.
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
  {
    // The type fixture imports the built package, so it only resolves after a build; the consumer fixtures type-check it against the installed tarball instead.
    // The capture scripts and fixtures ran in a scratch project against the old package and are kept exactly as they were run; the golden JSON is captured data.
    // release-notes.md is written by release.yml from CHANGELOG.md before it lints; its link definition may go unused there.
    // The TypeScript 5 fixture uses `import = require()` on purpose and is compiled by its own TypeScript in the consumer workspace.
    ignores: ['ai-docs/**', 'release-notes.md', 'test/consumers/types/**', 'test/consumers/ts5-cjs-interop-off/**', 'test/golden/*.cjs', 'test/golden/*.json'],
  },
  {
    space: 2,
    rules: {
      // The `v` flag is a syntax error in older engines; `u` works everywhere the package runs.
      'require-unicode-regexp': ['error', {requireFlag: 'u'}],
    },
  },
  {
    files: ['package.json'],
    rules: {
      // The shape publint and attw approved in every resolution mode: main, module and types stay for older resolvers, and the declaration files are found by sibling name, so no types or default conditions.
      'package-json/prefer-exports': 'off',
      'package-json/require-default-condition': 'off',
      'package-json/require-types-in-exports': 'off',
      // Npm always publishes package.json, whatever `files` says.
      'package-json/prefer-files-field': 'off',
      // Trusted publishing matches repository.url exactly, so it stays spelled out.
      'package-json/prefer-shorthand': 'off',
      // Deliberate pins: tsdown is pre-1.0 and pinned exactly; TypeScript stays on the line xo and tsdown declare.
      'package-json/dependency-version-range': 'off',
    },
  },
  {
    // The CommonJS entry merges a namespace into the exported function so `export =` still carries the public types, re-exports
    // the function as `default` inside that namespace, and attaches `.default` and `.formatJsonFiles` at load: that is the
    // module's whole purpose (plan D2).
    files: ['src/require.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      'unicorn/no-named-default': 'off',
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
  {
    // The tokenizer is one loop over a switch; breaking out of each case is the clearest form of it.
    files: ['src/scan.ts'],
    rules: {
      'unicorn/no-break-in-nested-loop': 'off',
    },
  },
  {
    // The library is Node-only by nature (plan D9): it reads and writes files, and compares bytes with Buffer.
    files: ['src/**/*.ts'],
    rules: {
      'n/prefer-global/buffer': 'off',
    },
  },
  {
    files: ['test/**/*.{js,cjs,mjs,ts}'],
    rules: {
      // The test scripts name their files, so helpers, fixtures and capture scripts can live under test/.
      'node-test/no-import-test-files': 'off',
      // Table-driven tests: an assertion per row of a fixed, non-empty table.
      'node-test/no-conditional-assertion': 'off',
      'no-await-in-loop': 'off',
      // Skips that depend on the platform (file links, POSIX modes) or the runtime (Bun and Deno are opt-in), never forgotten ones.
      'node-test/no-skip-test': 'off',
      // Tests compare bytes read from disk.
      'n/prefer-global/buffer': 'off',
      // The suites share one imported assert, also inside helpers and table loops; `t` is taken only for cleanup (t.after).
      'node-test/prefer-test-context-assert': 'off',
      // One walk test proves relative paths are reported as 1.0.6 joined them, which needs a working directory; it restores it.
      'node-test/no-process-chdir-in-test': 'off',
    },
  },
  {
    // Each golden test calls the helper for its kind of case, and the helpers assert.
    files: ['test/golden/golden.test.js'],
    rules: {
      'node-test/require-assertion': 'off',
    },
  },
  {
    // CommonJS on purpose: this fixture proves require() works.
    files: ['test/consumers/cjs-node/**/*.js'],
    rules: {
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  {
    // The fixture projects model consumers: some are CommonJS on purpose, and none needs engines.
    files: ['test/consumers/**/package.json'],
    rules: {
      'package-json/prefer-type-module': 'off',
      'package-json/require-engines': 'off',
    },
  },
];

export default xoConfig;
