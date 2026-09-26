import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXED_TIME = new Date('2001-01-01T00:00:00Z');

/**
Builds a temporary tree from {relativePath: string | Uint8Array} and returns helpers for it. Every test that writes uses
one of these; nothing outside os.tmpdir() is ever touched. The tree is removed by `remove()` (register it with t.after).
@param {Record<string, string | Uint8Array>} files The files to write, by path relative to the tree.
*/
export function makeTree(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fjf-test-'));
  const at = relative => path.join(root, ...relative.split('/'));
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(path.dirname(at(relative)), {recursive: true});
    writeFileSync(at(relative), content);
    utimesSync(at(relative), FIXED_TIME, FIXED_TIME);
  }

  return {
    root,
    at,
    read: relative => readFileSync(at(relative), 'utf8'),
    bytes: relative => readFileSync(at(relative)),
    written: relative => statSync(at(relative)).mtimeMs !== FIXED_TIME.getTime(),
    remove: () => rmSync(root, {recursive: true, force: true}),
  };
}

// Plain code unit order, as the report's paths are compared.
export const byCodeUnit = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));

// Report paths relative to the tree, with '/' separators, for comparisons.
export function relativePaths(tree, paths) {
  return paths.map(item => path.relative(tree.root, typeof item === 'string' ? item : item.path).split(path.sep).join('/')).toSorted(byCodeUnit);
}
