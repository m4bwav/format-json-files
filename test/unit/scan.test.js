/*
The lossless check (plan D3, E1), through the public API: one file per case in a temporary tree, one check-mode walk, and
the verdict read from the report. A number or key that a rewrite would change must be refused; everything else accepted.
*/
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {builds} from '../helpers/builds.js';
import {makeTree} from '../helpers/tree.js';

// [token, kept]: each token is the only value of {"v": token}; kept means a rewrite keeps it exactly. Tokens are strings,
// so a fixer cannot turn them into number literals.
const NUMBER_CASES = [
  ['0', true],
  ['-1', true],
  ['1.5', true],
  ['0.1', true],
  ['1.0', true],
  ['1e5', true],
  ['1E+2', true],
  ['5e-324', true],
  ['0.1000000000000000055511151231257827', true],
  ['9007199254740991', true],
  ['9007199254740992', true],
  ['9007199254740993', false],
  ['-9007199254740993', false],
  ['18014398509481984', true],
  ['12345678901234567890', false],
  ['12345678901234567168', false],
  ['1152921504606846976', false],
  ['18446744073709551616', false],
  ['1000000000000000000000', false],
  ['-18014398509481984', true],
  ['1.2345678901234567890e19', true],
  ['1.2345678901234567168e19', true],
  ['123456789012345678900e-1', true],
  ['1e21', true],
  ['1e22', true],
  ['1e23', true],
  ['1e308', true],
  ['1.7976931348623157e308', true],
  ['1e309', false],
  ['-1e400', false],
  ['1e-400', false],
  ['0e10', true],
  ['0.0', true],
  ['-0', false],
  ['-0.0', false],
  ['-0e5', false],
  ['100000000000000000000', true],
  ['100000000000000000001', false],
  ['6.02e23', true],
  ['12345678901234567890.0', true],
];

function verdicts(formatJsonFiles, bodies) {
  const files = Object.fromEntries(bodies.map((body, index) => [`case-${index}.json`, body]));
  const tree = makeTree(files);
  try {
    const report = formatJsonFiles(tree.root, {check: true});
    const skipped = new Map(report.skipped.map(item => [item.path.slice(tree.root.length + 1), item.reason]));
    return bodies.map((_, index) => skipped.get(`case-${index}.json`));
  } finally {
    tree.remove();
  }
}

for (const {name, lib} of builds) {
  describe(`number tokens (${name} build)`, () => {
    test('each listed token is accepted or refused as a rewrite would keep or change it', () => {
      const results = verdicts(lib.default, NUMBER_CASES.map(([token]) => `{"v":${token}}`));
      for (const [index, [token, expected]] of NUMBER_CASES.entries()) {
        assert.equal(results[index] === undefined, expected, `${token}: ${results[index] ?? 'accepted'}`);
        if (!expected) {
          assert.equal(results[index], `number cannot be kept exactly: ${token}`);
        }
      }
    });

    test('differential: random integers agree with an exact BigInt comparison, and exponent forms are accepted', () => {
      // A fixed linear congruential sequence, so a failure reproduces.
      let state = 20_260_926n;
      const next = limit => {
        state = ((state * 6_364_136_223_846_793_005n) + 1_442_695_040_888_963_407n) % (2n ** 64n);
        return Number(state % BigInt(limit));
      };

      const tokens = [];
      for (let index = 0; index < 400; index++) {
        const length = 1 + next(24);
        let digits = String(1 + next(9));
        for (let digit = 1; digit < length; digit++) {
          digits += String(next(10));
        }

        const sign = next(4) === 0 ? '-' : '';
        tokens.push(next(3) === 0 ? `${sign}${digits}e${next(12)}` : `${sign}${digits}`);
      }

      const results = verdicts(lib.default, tokens.map(token => `[${token}]`));
      for (const [index, token] of tokens.entries()) {
        const value = Number(token);
        // A plain integer is kept when the rewrite writes the same digits; an exponent form is a float.
        const isKeeps = token.includes('e') ? Number.isFinite(value) : String(value) === String(BigInt(token));
        assert.equal(results[index] === undefined, isKeeps, `${token}: ${results[index] ?? 'accepted'}`);
      }
    });
  });

  describe(`duplicate keys (${name} build)`, () => {
    test('a key repeated in one object is refused, at any depth, escaped or not', () => {
      const cases = [
        ['{"a":1,"a":1}', 'duplicate key: "a"'],
        ['{"x":{"a":1,"b":2,"a":3}}', 'duplicate key: "a"'],
        ['[{"a":1},{"k":1,"k":2}]', 'duplicate key: "k"'],
        ['{"a":1,"a":2}', 'duplicate key: "a"'],
        ['{"":1,"":2}', 'duplicate key: ""'],
        ['{"__proto__":1,"__proto__":2}', 'duplicate key: "__proto__"'],
      ];
      const results = verdicts(lib.default, cases.map(([body]) => body));
      for (const [index, [body, reason]] of cases.entries()) {
        assert.equal(results[index], reason, body);
      }
    });

    test('the same key in different objects, in arrays, or inside strings is accepted', () => {
      const bodies = [
        '[{"a":1},{"a":2}]',
        '{"a":{"a":{"a":1}}}',
        String.raw`{"a":"\"a\":1,\"a\":2","b":["a","a"]}`,
        '{"a":1,"A":2}',
        '{"a":[1,{"b":2}],"b":{"a":1}}',
      ];
      assert.deepEqual(verdicts(lib.default, bodies), bodies.map(() => undefined));
    });
  });

  describe(`other refusals (${name} build)`, () => {
    test('a string of ten million characters is scanned, and a huge number is cut short in the reason', () => {
      const escapes = String.raw`a\"b\\`.repeat(1000);
      const long = `{"k":"${'x'.repeat(10_000_000)}","e":"${escapes}","k2":1}`;
      const huge = `[${'9'.repeat(100_000)}]`;
      const [longResult, hugeResult] = verdicts(lib.default, [long, huge]);
      assert.equal(longResult, undefined);
      assert.equal(hugeResult, `number cannot be kept exactly: ${'9'.repeat(40)}…`);
    });

    test('invalid UTF-8, invalid JSON and deep nesting are reported with their reasons', () => {
      const deep = '['.repeat(20_000) + ']'.repeat(20_000);
      const results = verdicts(lib.default, [
        Buffer.from([0x22, 0xE9, 0x22]),
        Buffer.from('﻿{"a":1}', 'utf16le'),
        '{"a":',
        '',
        deep,
      ]);
      assert.equal(results[0], 'not UTF-8');
      assert.equal(results[1], 'not UTF-8');
      assert.match(results[2], /^not valid JSON: /u);
      assert.match(results[3], /^not valid JSON: /u);
      assert.equal(results[4], 'nested too deeply');
    });
  });
}
