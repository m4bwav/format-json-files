// A TypeScript 5 consumer with an old CommonJS config: esModuleInterop off, node10 resolution. It type-checks the import
// forms such projects write against the published declaration, then runs the compiled JavaScript (argument checks only,
// which touch no file).
import assert = require('node:assert/strict');
import formatJsonFiles = require('format-json-files');
import * as namespace from 'format-json-files';

const options: formatJsonFiles.FormatOptions = {indent: 2, sortKeys: true};
const functions = [formatJsonFiles, namespace, formatJsonFiles.default, formatJsonFiles.formatJsonFiles];
for (const format of functions) {
  assert.equal(format, formatJsonFiles);
  assert.throws(() => format('', options), {message: 'Path argument not set'});
}

const report: formatJsonFiles.FormatReport | undefined = undefined;
assert.equal(report, undefined);
console.log('ts5-cjs-interop-off ok');
