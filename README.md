# format-json-files

[![npm package](https://nodei.co/npm/format-json-files.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/format-json-files/)

[![Build Status](https://img.shields.io/travis/m4bwav/format-json-files/master.svg)](https://travis-ci.org/m4bwav/format-json-files)
[![Dependency Status](https://img.shields.io/david/m4bwav/format-json-files.svg)](https://david-dm.org/m4bwav/format-json-files)
[![Coverage Status](https://img.shields.io/coveralls/m4bwav/format-json-files/master.svg)](https://coveralls.io/github/m4bwav/format-json-files?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/format-json-files/badge.svg?style=flat-square)](https://snyk.io/test/npm/format-json-files)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![Gitter](https://badges.gitter.im/m4bwav/format-json-files.svg)](https://gitter.im/m4bwav/format-json-files?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)  
  
[![NPM](https://nodei.co/npm-dl/format-json-files.png?months=3)](https://nodei.co/npm/format-json-files/)

Npm package to retrieve the title at a given url.  Largely combines articleTitle with request.


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

The formatJsonFiles will use the callback function with the following signature callback(title, requestError).
The requestError will be whatever error request passes back, the title will be empty if there was an issue.
## License

MIT © [Mark Rogers](http://www.markdavidrogers.com)
