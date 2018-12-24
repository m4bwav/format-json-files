import test from 'ava';
import formatJsonFiles from './';

global.Promise = Promise;

test('Won\'t work with an invalid file name', t => {
  try {
    formatJsonFiles('afewaefagefwf123124');
  } catch (err) {
    t.pass();
  }
});
