/*
The walk on real temporary trees (plan D3 and D6): which files are chosen, the ignore list, check mode, unchanged files,
links, and files that cannot be written. Link cases run where the OS lets a normal user create links (Windows needs
developer mode for file links; CI's Linux and macOS jobs always run them).
*/
import assert from 'node:assert/strict';
import fs, {chmodSync, symlinkSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {describe, test} from 'node:test';
import {builds} from '../helpers/builds.js';
import {byCodeUnit, makeTree, relativePaths} from '../helpers/tree.js';

const RAW = '{"a":1}';
const FORMATTED = '{\n    "a": 1\n}';

function canLink(type) {
  const tree = makeTree({'target.json': RAW});
  try {
    symlinkSync(type === 'junction' ? tree.root : 'target.json', tree.at('link'), type);
    return true;
  } catch {
    return false;
  } finally {
    tree.remove();
  }
}

const fileLinks = canLink('file');
const directoryLinks = canLink(process.platform === 'win32' ? 'junction' : 'dir');

for (const {name, lib} of builds) {
  const formatJsonFiles = lib.default;

  describe(`walk (${name} build)`, () => {
    test('picks .json names in any case, recursing into every directory but node_modules and .git', t => {
      const tree = makeTree({
        'a.json': RAW, 'B.JSON': RAW, 'c.txt': RAW, 'dir.json/d.json': RAW, 'deep/er/e.json': RAW,
        'node_modules/p/package.json': RAW, '.git/x.json': RAW, 'sub/node_modules/y.json': RAW, '.hidden/h.json': RAW,
      });
      t.after(tree.remove);
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(relativePaths(tree, report.changed), ['.hidden/h.json', 'B.JSON', 'a.json', 'deep/er/e.json', 'dir.json/d.json']);
      assert.deepEqual(report.unchanged, []);
      assert.deepEqual(report.skipped, []);
      assert.equal(tree.read('node_modules/p/package.json'), RAW);
      assert.equal(tree.read('sub/node_modules/y.json'), RAW);
      assert.equal(tree.read('.git/x.json'), RAW);
      assert.equal(tree.read('c.txt'), RAW);
    });

    test('ignore: [] walks everything, as 1.0.6; a custom list replaces the default', t => {
      const tree = makeTree({'node_modules/a.json': RAW, '.git/b.json': RAW, 'build/c.json': RAW});
      t.after(tree.remove);
      assert.deepEqual(relativePaths(tree, formatJsonFiles(tree.root, {ignore: ['build'], check: true}).changed), ['.git/b.json', 'node_modules/a.json']);
      assert.deepEqual(relativePaths(tree, formatJsonFiles(tree.root, {ignore: []}).changed), ['.git/b.json', 'build/c.json', 'node_modules/a.json']);
    });

    test('an ignored name given as the path itself is still formatted', t => {
      const tree = makeTree({'node_modules/a.json': RAW});
      t.after(tree.remove);
      assert.equal(formatJsonFiles(tree.at('node_modules')).changed.length, 1);
    });

    test('check mode writes nothing and lists what would change', t => {
      const tree = makeTree({'raw.json': RAW, 'done.json': FORMATTED, 'bad.json': '{'});
      t.after(tree.remove);
      const report = formatJsonFiles(tree.root, {check: true});
      assert.deepEqual(relativePaths(tree, report.changed), ['raw.json']);
      assert.deepEqual(relativePaths(tree, report.unchanged), ['done.json']);
      assert.deepEqual(relativePaths(tree, report.skipped), ['bad.json']);
      for (const file of ['raw.json', 'done.json', 'bad.json']) {
        assert.equal(tree.written(file), false, file);
      }
    });

    test('a file already formatted is not written, so its modification time stays', t => {
      const tree = makeTree({'done.json': FORMATTED, 'raw.json': RAW});
      t.after(tree.remove);
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(relativePaths(tree, report.unchanged), ['done.json']);
      assert.equal(tree.written('done.json'), false);
      assert.equal(tree.written('raw.json'), true);
      // A second run changes nothing.
      const again = formatJsonFiles(tree.root);
      assert.deepEqual(again.changed, []);
      assert.equal(again.unchanged.length, 2);
    });

    test('lossy files are left byte for byte and reported with the reason', t => {
      const tree = makeTree({'id.json': '{"id":12345678901234567890}', 'dup.json': '{"a":1,"a":2}', 'ok.json': RAW});
      t.after(tree.remove);
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason]).toSorted(([a], [b]) => byCodeUnit(a, b)), [
        ['dup.json', 'duplicate key: "a"'],
        ['id.json', 'number cannot be kept exactly: 12345678901234567890'],
      ]);
      assert.equal(tree.read('id.json'), '{"id":12345678901234567890}');
      assert.equal(tree.read('dup.json'), '{"a":1,"a":2}');
      assert.equal(tree.written('id.json'), false);
    });

    test('report paths are joined as 1.0.6 joined them: relative in, relative out', t => {
      const tree = makeTree({'x/a.json': RAW});
      const previous = process.cwd();
      process.chdir(tree.root);
      // Leave the tree before removing it: Windows cannot remove the working directory.
      t.after(() => {
        process.chdir(previous);
        tree.remove();
      });
      assert.deepEqual(formatJsonFiles('x').changed, [path.join('x', 'a.json')]);
    });

    test('an entry that disappears between readdir and lstat is reported and the walk goes on', t => {
      const tree = makeTree({'a.json': RAW, 'b.json': RAW});
      t.after(tree.remove);
      // Simulate the race: readdir lists a name that is gone by the time the walk looks at it. syncBuiltinESMExports
      // carries the mock into the ESM build's named import.
      const realReaddir = fs.readdirSync;
      t.mock.method(fs, 'readdirSync', (...arguments_) => [...realReaddir(...arguments_), 'gone.json']);
      syncBuiltinESMExports();
      t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
      });
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason]), [['gone.json', 'cannot read: ENOENT']]);
      assert.equal(report.changed.length, 2);
    });

    test('a file that cannot be written is reported and the walk goes on', {skip: process.getuid?.() === 0 && 'root ignores file modes'}, t => {
      const tree = makeTree({'locked.json': RAW, 'open.json': RAW});
      t.after(() => {
        chmodSync(tree.at('locked.json'), 0o666);
        tree.remove();
      });
      chmodSync(tree.at('locked.json'), 0o444);
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason.replace(/EACCES|EPERM/u, 'E')]), [['locked.json', 'cannot write: E']]);
      assert.equal(tree.read('open.json'), FORMATTED);
      assert.equal(tree.read('locked.json'), RAW);
    });

    test('a directory that cannot be read is reported', {skip: (process.platform === 'win32' || process.getuid?.() === 0) && 'needs POSIX modes and a normal user'}, t => {
      const tree = makeTree({'shut/a.json': RAW, 'b.json': RAW});
      t.after(() => {
        chmodSync(tree.at('shut'), 0o755);
        tree.remove();
      });
      chmodSync(tree.at('shut'), 0o000);
      const report = formatJsonFiles(tree.root);
      assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason]), [['shut', 'cannot read: EACCES']]);
      assert.equal(tree.read('b.json'), FORMATTED);
    });

    test('the walk never writes through a file link; a link given as the path throws, as 1.0.6', {skip: !fileLinks && 'file links need developer mode on Windows'}, t => {
      const tree = makeTree({'outside/target.json': RAW, 'inside/plain.json': RAW});
      t.after(tree.remove);
      symlinkSync(path.join('..', 'outside', 'target.json'), tree.at('inside/link.json'), 'file');
      const report = formatJsonFiles(tree.at('inside'));
      assert.deepEqual(report.skipped.map(item => [path.basename(item.path), item.reason]), [['link.json', 'symbolic link']]);
      assert.equal(tree.read('outside/target.json'), RAW);
      assert.equal(tree.read('inside/plain.json'), FORMATTED);
      assert.throws(() => formatJsonFiles(tree.at('inside/link.json')), {message: 'Invalid path'});
    });

    test('the walk does not enter a directory link; a path through one is followed', {skip: !directoryLinks && 'no directory links here'}, t => {
      const tree = makeTree({'outside/o.json': RAW, 'inside/i.json': RAW});
      t.after(tree.remove);
      symlinkSync(process.platform === 'win32' ? tree.at('outside') : path.join('..', 'outside'), tree.at('inside/linked'), process.platform === 'win32' ? 'junction' : 'dir');
      const report = formatJsonFiles(tree.at('inside'));
      assert.deepEqual(relativePaths(tree, report.changed), ['inside/i.json']);
      assert.deepEqual(report.skipped, []);
      assert.equal(tree.read('outside/o.json'), RAW);
      formatJsonFiles(path.join(tree.at('inside/linked'), 'o.json'));
      assert.equal(tree.read('outside/o.json'), FORMATTED);
    });
  });
}
