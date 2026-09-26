/*
Argument and option checks (plan D7): the path errors are 1.0.6's (the golden suite pins them); invalid options throw a
TypeError before anything is read or written.
*/
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {builds} from '../helpers/builds.js';
import {makeTree} from '../helpers/tree.js';

for (const {name, lib} of builds) {
  const formatJsonFiles = lib.default;

  describe(`options (${name} build)`, () => {
    test('the module shapes: default, named, and require() returning the function', () => {
      assert.equal(typeof formatJsonFiles, 'function');
      assert.equal(lib.formatJsonFiles, name === 'esm' ? formatJsonFiles : lib);
      if (name === 'cjs') {
        assert.equal(lib.default, lib);
      }
    });

    test('invalid options throw a TypeError and touch nothing', t => {
      const tree = makeTree({'a.json': '{"a":1}'});
      t.after(tree.remove);
      for (const options of [
        {indent: -1},
        {indent: 11},
        {indent: 1.5},
        {indent: '  '},
        {indent: '4'},
        {indent: NaN},
        {sortKeys: 'yes'},
        {check: 1},
        {finalNewline: null},
        {eol: 'cr'},
        {eol: 'LF'},
        {ignore: 'node_modules'},
        {ignore: [1]},
        {ignore: null},
      ]) {
        assert.throws(() => formatJsonFiles(tree.root, options), TypeError, JSON.stringify(options));
      }

      assert.equal(tree.written('a.json'), false);
    });

    test('undefined, null and anything but an object mean the defaults, as 1.0.6 ignored a second argument', t => {
      const letters = ['a', 'b', 'c', 'd', 'e'];
      const tree = makeTree(Object.fromEntries(letters.map(letter => [`${letter}.json`, `{"${letter}":1}`])));
      t.after(tree.remove);
      formatJsonFiles(tree.at('a.json'), undefined);
      formatJsonFiles(tree.at('b.json'), null);
      formatJsonFiles(tree.at('c.json'), 'x');
      // Array#forEach passes the index as the second argument.
      for (const [index, file] of [tree.at('d.json'), tree.at('e.json')].entries()) {
        formatJsonFiles(file, index);
      }

      for (const letter of letters) {
        assert.equal(tree.read(`${letter}.json`), `{\n    "${letter}": 1\n}`);
      }
    });

    test('the path is checked before the options, as 1.0.6 checked it first', () => {
      assert.throws(() => formatJsonFiles('', {indent: 'bad'}), {name: 'Error', message: 'Path argument not set'});
      assert.throws(() => formatJsonFiles(5, {indent: 'bad'}), {name: 'TypeError', message: 'Target path argument is not a string'});
    });
  });
}
