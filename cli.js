#!/usr/bin/env node
'use strict';
var meow = require('meow')
  ;

var formatJsonFiles = require('./')
  ;

var cli = meow(`
  Usage
      $ format-json-files "<path>"
    
    Example
      $ format-json-files ".\"

`);

var input = cli.input[0];

function init(targetPath) {
  formatJsonFiles(targetPath);
}

init(input);
