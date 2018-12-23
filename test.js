import test from 'ava';
import formatJsonFiles from './';

global.Promise = Promise;

var validUrl = 'http://www.google.com';
var fourOhFourUrl = 'http://www.google.com/aa';
var httpsTestUrls = [
  'https://www.reddit.com',
  'https://www.google.com',
  'https://twitter.com/',
  'https://www.amazon.com',
  'https://www.npmjs.com/',
  'https://stackexchange.com'
];

test('Won\'t work with an invalid url', function (t) {
    formatJsonFiles('afewaefaefwf');
});
