# format-json-files

[![npm package](https://nodei.co/npm/format-json-files.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/format-json-files/)

[![Build Status](https://img.shields.io/travis/m4bwav/format-json-files/master.svg)](https://travis-ci.org/m4bwav/format-json-files)
[![Dependency Status](https://img.shields.io/david/m4bwav/format-json-files.svg)](https://david-dm.org/m4bwav/format-json-files)
[![Coverage Status](https://img.shields.io/coveralls/m4bwav/format-json-files/master.svg)](https://coveralls.io/github/m4bwav/format-json-files?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/format-json-files/badge.svg?style=flat-square)](https://snyk.io/test/npm/format-json-files)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![Gitter](https://badges.gitter.im/m4bwav/format-json-files.svg)](https://gitter.im/m4bwav/format-json-files?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Formats json files in the given path.  Files have to have the .json extension when a directory is supplied.

When a directory path is supplied format-json-files will search that directory and any sub-directories in a recursive manner and format any .json files found in these directories.  If a single file path is supplied, format-json-files will attempt to format the file assuming its a json file.

## Installation

Installation is easiest through npm:

`npm install format-json-files --save`


## Usage

**format-json-files** can be included as a reference.

```
var formatJsonFiles = require('format-json-files');

formatJsonFiles('./data');

```

## CLI

```
$ npm install --global format-json-files
```

```
$ format-json-files --help

  Usage
    $ format-json-files "<path>"

  Example
    $ format-json-files ".\"
```

`JSON.stringify(targetObj, null, 4);` is used to format the json files. `fs.readFileSync(targetPath)` is used to read the files. `fs.writeFileSync(targetPath, serializedObject);` is used to write the files. I would have provided options for any or all of these things and more, but I wasn't sure what would be worth spending time on.  So if anyone has any requests feel free to file one in github and if I have time I'll take a look.
## License

MIT © [Mark Rogers](http://www.markdavidrogers.com)
