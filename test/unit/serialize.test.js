/*
The formatter's output (plan D6): with sortKeys off it is JSON.stringify(JSON.parse(text), null, indent), with the eol and
final newline options applied; with sortKeys on it is the same text with every object's keys in UTF-16 code unit order.
*/
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {builds} from '../helpers/builds.js';
import {byCodeUnit, makeTree} from '../helpers/tree.js';

function formatText(formatJsonFiles, text, options) {
  const tree = makeTree({'file.json': text});
  try {
    const report = formatJsonFiles(tree.at('file.json'), options);
    assert.deepEqual(report.skipped, []);
    return tree.read('file.json');
  } finally {
    tree.remove();
  }
}

// A fixed pseudo-random JSON generator, so a failure reproduces.
function makeRandom(seed) {
  let state = seed;
  const next = limit => {
    state = ((state * 1_103_515_245) + 12_345) % 2_147_483_648;
    return state % limit;
  };

  const keys = ['a', 'b', 'B', 'z', '10', '2', '_', 'é', '😀', '', 'key with space', '"q"'];
  const value = depth => {
    const kind = next(depth > 3 ? 4 : 6);
    switch (kind) {
      case 0: {
        return null;
      }

      case 1: {
        return next(2) === 0;
      }

      case 2: {
        return (next(2_000_000) - 1_000_000) / (1 + next(1000));
      }

      case 3: {
        return keys[next(keys.length)] + String(next(100));
      }

      case 4: {
        return Array.from({length: next(4)}, () => value(depth + 1));
      }

      default: {
        const object = {};
        for (let index = next(5); index > 0; index--) {
          object[keys[next(keys.length)]] = value(depth + 1);
        }

        return object;
      }
    }
  };

  return () => value(0);
}

// Every object's keys in code unit order, as a plain comparison would give; used only to state the expectation.
function sortedText(value, indent) {
  const write = (item, current) => {
    if (item === null || typeof item !== 'object') {
      return JSON.stringify(item);
    }

    const inner = current + indent;
    const [open, close, separator] = indent === '' ? ['', '', ','] : [`\n${inner}`, `\n${current}`, `,\n${inner}`];
    if (Array.isArray(item)) {
      return item.length === 0 ? '[]' : `[${open}${item.map(child => write(child, inner)).join(separator)}${close}]`;
    }

    const names = Object.keys(item).toSorted(byCodeUnit);
    return names.length === 0
      ? '{}'
      : `{${open}${names.map(name => `${JSON.stringify(name)}${indent === '' ? ':' : ': '}${write(item[name], inner)}`).join(separator)}${close}}`;
  };

  return write(value, '');
}

for (const {name, lib} of builds) {
  const formatJsonFiles = lib.default;

  describe(`formatted text (${name} build)`, () => {
    test('without sortKeys the output is JSON.stringify\'s, for every indent', () => {
      const random = makeRandom(7);
      for (let index = 0; index < 40; index++) {
        const value = random();
        const text = JSON.stringify(value);
        for (const [indent, gap] of [[undefined, 4], [2, 2], [0, 0], ['\t', '\t']]) {
          assert.equal(formatText(formatJsonFiles, text, indent === undefined ? {} : {indent}), JSON.stringify(value, null, gap));
        }
      }
    });

    test('with sortKeys every object\'s keys are in code unit order, integer-like keys included', () => {
      const random = makeRandom(11);
      for (let index = 0; index < 40; index++) {
        const value = random();
        for (const [indent, gap] of [[4, ' '.repeat(4)], [0, ''], ['\t', '\t']]) {
          assert.equal(formatText(formatJsonFiles, JSON.stringify(value), {sortKeys: true, indent}), sortedText(value, gap));
        }
      }

      assert.equal(
        formatText(formatJsonFiles, '{"b":1,"a":2,"10":3,"2":4,"c":{"z":1,"y":[{"q":1,"p":2}]}}', {sortKeys: true, indent: 2}),
        '{\n  "10": 3,\n  "2": 4,\n  "a": 2,\n  "b": 1,\n  "c": {\n    "y": [\n      {\n        "p": 2,\n        "q": 1\n      }\n    ],\n    "z": 1\n  }\n}',
      );
    });

    test('sortKeys keeps a __proto__ key as data', () => {
      assert.equal(
        formatText(formatJsonFiles, '{"z":1,"__proto__":{"x":1}}', {sortKeys: true, indent: 0}),
        '{"__proto__":{"x":1},"z":1}',
      );
    });

    test('eol and finalNewline', () => {
      const text = '{"a":[1]}';
      assert.equal(formatText(formatJsonFiles, text, {eol: 'crlf'}), '{\r\n    "a": [\r\n        1\r\n    ]\r\n}');
      assert.equal(formatText(formatJsonFiles, text, {finalNewline: true}), '{\n    "a": [\n        1\n    ]\n}\n');
      assert.equal(formatText(formatJsonFiles, text, {finalNewline: true, eol: 'crlf', indent: 0}), '{"a":[1]}\r\n');
      assert.equal(formatText(formatJsonFiles, '{\r\n"a":1}', {eol: 'auto'}), '{\r\n    "a": 1\r\n}');
      assert.equal(formatText(formatJsonFiles, '{\n"a":1}', {eol: 'auto', finalNewline: true}), '{\n    "a": 1\n}\n');
      assert.equal(formatText(formatJsonFiles, String.raw`"x\ny"`, {eol: 'crlf', finalNewline: true}), '"x\\ny"\r\n');
    });

    test('a byte order mark is dropped', () => {
      assert.equal(formatText(formatJsonFiles, '﻿{"a":1}', {}), '{\n    "a": 1\n}');
    });
  });
}
