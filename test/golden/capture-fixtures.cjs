'use strict';
// Fixture trees for the format-json-files golden capture, shared by capture-1.0.6.cjs and golden.test.js so the two
// cannot drift. Recorded with the published 1.0.6 on 2026-09-26; never edited after the Phase 0 commit.
//
// A tree maps a relative path (always '/') to its content: a string (written as UTF-8), {base64} for raw bytes,
// {dir: true} for an empty directory, or {link, type} for a symbolic link ('file') or a directory junction ('junction').
// Links may be unavailable (Windows without developer mode refuses file links with EPERM); buildTree reports them.

const fs = require('node:fs');
const path = require('node:path');

// Written before every run so a rewrite shows as a changed mtime even when the bytes are equal.
const FIXED_TIME = new Date('2001-01-01T00:00:00Z');

const deep = depth => '['.repeat(depth) + ']'.repeat(depth);

const trees = {
  // Every JSON value shape and the number and string forms JSON.stringify changes.
  shapes: {
    'object.json': '{"a":2343, "b":"asdf"}',
    'array.json': '[1,2,[3,{"x":null}]]',
    'string.json': '"just a string"',
    'number.json': '42',
    'true.json': 'true',
    'null.json': 'null',
    'empty-object.json': '{}',
    'empty-array.json': '[]',
    'nested-empty.json': '{"a":{},"b":[],"c":[{}]}',
    'formatted-4.json': '{\n    "a": 1,\n    "b": [\n        2\n    ]\n}',
    'formatted-4-newline.json': '{\n    "a": 1\n}\n',
    'formatted-2.json': '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}\n',
    'tabs.json': '{\n\t"a": 1\n}\n',
    'crlf.json': '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n',
    'key-order.json': '{"b":1,"a":2,"10":3,"2":4,"c":{"z":1,"y":2}}',
    'numbers.json': '{"int":1,"float":1.5,"trailing":1.0,"exp":1e5,"exp2":1E+2,"neg":-3,"small":0.1,"tiny":5e-324}',
    'negative-zero.json': '{"z":-0,"z2":-0.0}',
    'big-integer.json': '{"id":12345678901234567890}',
    'big-float.json': '{"x":1e400,"y":-1e400}',
    'precise-float.json': '{"x":0.1000000000000000055511151231257827}',
    'duplicate-keys.json': '{"b":1,"b":2,"a":3}',
    'proto-key.json': '{"__proto__":{"polluted":true},"a":1}',
    'escapes.json': '{"slash":"a\\/b","unicode":"\\u00e9","control":"\\u0001","tab":"a\\tb","quote":"\\"","backslash":"\\\\"}',
    'separators.json': '{"ls":" ","ps":" "}',
    'lone-surrogate.json': '{"s":"\\ud800"}',
    'non-bmp.json': '{"emoji":"😀","escaped":"\\ud83d\\ude00"}',
    'unicode-key.json': '{"ключ":"значение","🔑":1}',
    'whitespace-around.json': '  \n {"a":1} \n\n',
    'deep-40.json': deep(40),
  },
  // Files 1.0.6 cannot parse or cannot write.
  invalid: {
    'empty.json': '',
    'whitespace-only.json': ' \n',
    'syntax-error.json': '{"a":1,}',
    'comments.json': '{\n  // a comment\n  "a": 1\n}',
    'single-quotes.json': "{'a':1}",
    'truncated.json': '{"a":[1,2',
    'two-values.json': '{"a":1}{"b":2}',
    'nan.json': '{"a":NaN}',
    'bom.json': '﻿{"a":1}',
    'utf16le-bom.json': {base64: Buffer.from('﻿{"a":1}', 'utf16le').toString('base64')},
    'latin1.json': {base64: Buffer.from([0x7B, 0x22, 0x61, 0x22, 0x3A, 0x22, 0xE9, 0x22, 0x7D]).toString('base64')},
    'valid.json': '{"ok":true}',
  },
  // Which files a directory walk picks.
  names: {
    'lower.json': '{"a":1}',
    'UPPER.JSON': '{"a":1}',
    'Mixed.Json': '{"a":1}',
    '.json': '{"a":1}',
    'no-extension': '{"a":1}',
    'data.txt': '{"a":1}',
    'data.jsonc': '{"a":1}',
    'data.json5': '{"a":1}',
    'data.json.bak': '{"a":1}',
    'data.geojson': '{"a":1}',
    'dir.json/inner.json': '{"a":1}',
    'dir.json/inner.txt': '{"a":1}',
    'with space.json': '{"a":1}',
    'sub/deeper/deepest/leaf.json': '{"a":1}',
    'sub/empty-dir': {dir: true},
    'node_modules/pkg/package.json': '{"name":"pkg","version":"1.0.0"}',
    '.git/config.json': '{"a":1}',
    '.hidden/h.json': '{"a":1}',
  },
  // Symbolic links and junctions.
  links: {
    'target/real.json': '{"a":1}',
    'outside-target/other.json': '{"b":2}',
    'inside/file-link.json': {link: '../target/real.json', type: 'file'},
    'inside/dir-junction': {link: 'outside-target', type: 'junction'},
    'inside/plain.json': '{"c":3}',
  },
  // Stack depth: JSON.parse copes, JSON.stringify of very deep input may not.
  depth: {
    'deep-10000.json': deep(10_000),
    'after.json': '{"a":1}',
  },
  // A file that cannot be written (read-only attribute, which Windows and POSIX both honour for a non-root user).
  readonly: {
    'locked.json': '{"a":1}',
    'open.json': '{"a":1}',
  },
  // The one known dependent's call: cdlib/cdlib-ui runs `format-json-files sample-data` in its package root.
  dependent: {
    'package.json': '{"name":"consumer"}',
    'sample-data/home.json': '{"title":"Home","items":[{"id":1,"name":"a"}]}',
    'sample-data/menu-items/main.json': '[{"label":"x","url":"/x"}]',
    'sample-data/README.md': '# data',
  },
  // One small file, for the argument and CLI cases.
  single: {
    'one.json': '{"a":2343, "b":"asdf"}',
    'one.txt': '{"a":1}',
    'bad.json': '{"a":',
  },
};

// Builds a tree under root. Returns the list of links that could not be created, as [relativePath, error code].
function buildTree(root, tree) {
  const unavailable = [];
  for (const [relative, content] of Object.entries(tree)) {
    const full = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(full), {recursive: true});
    if (typeof content === 'string') {
      fs.writeFileSync(full, content, 'utf8');
    } else if (content.base64 !== undefined) {
      fs.writeFileSync(full, Buffer.from(content.base64, 'base64'));
    } else if (content.dir) {
      fs.mkdirSync(full, {recursive: true});
    }
  }

  // Links after every target exists.
  for (const [relative, content] of Object.entries(tree)) {
    if (typeof content !== 'object' || !content.link) {
      continue;
    }

    const full = path.join(root, ...relative.split('/'));
    const target = content.type === 'junction'
      ? path.join(root, ...content.link.split('/'))
      : content.link.split('/').join(path.sep);
    try {
      fs.symlinkSync(target, full, content.type);
    } catch (error) {
      unavailable.push([relative, error.code]);
    }
  }

  for (const [relative, content] of Object.entries(tree)) {
    if (typeof content === 'string' || content.base64 !== undefined) {
      fs.utimesSync(path.join(root, ...relative.split('/')), FIXED_TIME, FIXED_TIME);
    }
  }

  return unavailable;
}

function encodeBytes(buffer) {
  const text = buffer.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buffer) ? text : {base64: buffer.toString('base64')};
}

// Every regular file under root (links not followed), with its bytes and whether it was written since buildTree.
function snapshotTree(root) {
  const files = {};
  const walk = directory => {
    for (const entry of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, entry);
      const relative = path.relative(root, full).split(path.sep).join('/');
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        files[relative] = {link: true};
      } else if (stat.isDirectory()) {
        walk(full);
      } else {
        files[relative] = {bytes: encodeBytes(fs.readFileSync(full)), written: stat.mtimeMs !== FIXED_TIME.getTime()};
      }
    }
  };

  walk(root);
  return files;
}

// Replaces the tree's absolute root (either separator) with {{root}} and turns separators inside those paths into '/'.
function normalizeOutput(text, root) {
  if (text === undefined || text === null) {
    return text;
  }

  let result = String(text);
  for (const form of new Set([root, root.split(path.sep).join('/'), root.split(path.sep).join('\\\\')])) {
    result = result.split(form).join('{{root}}');
  }

  return result.replaceAll(/\{\{root\}\}[^\s,`'"]*/g, match => match.replaceAll('\\', '/'));
}

function setReadonly(root, relative, readonly) {
  fs.chmodSync(path.join(root, ...relative.split('/')), readonly ? 0o444 : 0o666);
}

module.exports = {trees, buildTree, snapshotTree, normalizeOutput, setReadonly, FIXED_TIME};
