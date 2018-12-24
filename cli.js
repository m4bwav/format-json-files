#!/usr/bin/env node
'use strict';
const meow = require('meow')
  ;

const formatJsonFiles = require('./')
  ;

const cli = meow(`
  Usage
      $ format-json-files "<path>"
    
    Example
      $ format-json-files ".\\"

`);

const input = cli.input[0];

function init(targetPath) {
  formatJsonFiles(targetPath);
}

init(input);
