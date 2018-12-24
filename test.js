
import fs from 'fs';
import test from 'ava';
import del from 'del';
import formatJsonFiles from '.';

global.Promise = Promise;

const baseTempTestDataDirectory = './tmp-test-data';
const tempSubDirectory = './tmp-test-data/second-level';
const tempTestFile = 'tmp-test-data/second-level/test-file.json';
const properTestOutput = `{
    "a": 2343,
    "b": "asdf"
}`;

test('Won\'t work without a path parameter', t => {
  try {
    formatJsonFiles();
  } catch (err) {
    t.pass();
  }
});

test('Won\'t work with a non string path', t => {
  try {
    formatJsonFiles(1232);
  } catch (err) {
    t.pass();
  }
});

test('Won\'t work with an invalid file name', t => {
  try {
    formatJsonFiles('afewaefagefwf123124');
  } catch (err) {
    t.pass();
  }
});

test('Should process a filename path', t => {
  setupStandardTempTestDirectoriesAndFiles();

  try {
    formatJsonFiles(tempTestFile);
  } catch (err) {
    console.log(err);
    t.fail();
    return;
  }

  testThatTempTestFileIsCorrectlyFormatted(t);

  deleteStandardTestTempDirectories();
});

test('Should process a directory path', t => {
  setupStandardTempTestDirectoriesAndFiles();

  try {
    formatJsonFiles(baseTempTestDataDirectory);
  } catch (err) {
    console.log(err);
    t.fail();
    return;
  }

  testThatTempTestFileIsCorrectlyFormatted(t);

  deleteStandardTestTempDirectories();
});
function setupStandardTempTestDirectoriesAndFiles() {
  createTestDataDirectories();
  createTestDataFiles();
}

function testThatTempTestFileIsCorrectlyFormatted(t) {
  const fileText = fs.readFileSync(tempTestFile);

  if (fileText.length !== properTestOutput.length) {
    console.log('Failure file `' + tempTestFile + '` text: `' + fileText + '`');
    console.log('Target output: `' + properTestOutput + '`');
    t.fail();
  } else if (fileText.indexOf(properTestOutput) === -1) {
    t.fail();
  } else {
    t.pass();
  }
}

function deleteStandardTestTempDirectories() {
  del.sync(baseTempTestDataDirectory);
}

function createTestDataFiles() {
  fs.writeFileSync(tempTestFile, '{"a":2343, "b":"asdf"}');
}

function createTestDataDirectories() {
  createDirectoryIfItDoesNotExist(baseTempTestDataDirectory);
  createDirectoryIfItDoesNotExist(tempSubDirectory);
}

function createDirectoryIfItDoesNotExist(directory) {
  if (fs.existsSync(directory)) {
    return;
  }

  fs.mkdirSync(directory);
}
