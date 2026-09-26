#!/usr/bin/env node
import {createRequire} from 'node:module';
import process from 'node:process';
import {parseArgs} from 'node:util';
import {formatJsonFiles, type FormatOptions} from './format-json-files.js';

const HELP = `
  Format JSON files in place: one file, or every .json file in a directory
  and its subdirectories.

  Usage
    $ format-json-files [options] <path> [<path> ...]

  Options
    --indent <n|tab>     Spaces per level, 0 to 10, or "tab" (default 4)
    --sort-keys          Sort object keys, at every level
    --check              Write nothing; list the files that would change
    --final-newline      End each file with a line break
    --eol <lf|crlf|auto> Line breaks to write (default lf; auto keeps each file's)
    --ignore <name>      A directory name not to enter; repeatable
                         (default node_modules and .git)
    --no-ignore          Enter every directory, node_modules and .git too
    -h, --help           Show this help
    -v, --version        Show the version

  A file is left alone, and listed on stderr, when it is not valid UTF-8 JSON,
  when rewriting it would change a value (a number that cannot be kept
  exactly, a duplicate key), or when it is a symbolic link.

  Exit codes
    0  every file was formatted or already formatted
    1  a file was left alone, --check found a file to change, or bad arguments

  Example
    $ format-json-files ./data
`;

function readOptions(values: Record<string, string | boolean | string[] | undefined>): FormatOptions {
  const options: FormatOptions = {
    sortKeys: values['sort-keys'] === true,
    check: values.check === true,
    finalNewline: values['final-newline'] === true,
  };
  if (typeof values.indent === 'string') {
    const indent = values.indent === 'tab' ? '\t' : Number(values.indent);
    if (indent !== '\t' && (values.indent.trim() === '' || !Number.isSafeInteger(indent) || indent < 0 || indent > 10)) {
      throw new TypeError(`--indent takes 0 to 10 or "tab", not ${JSON.stringify(values.indent)}`);
    }

    options.indent = indent;
  }

  if (typeof values.eol === 'string') {
    if (values.eol !== 'lf' && values.eol !== 'crlf' && values.eol !== 'auto') {
      throw new TypeError(`--eol takes lf, crlf or auto, not ${JSON.stringify(values.eol)}`);
    }

    options.eol = values.eol;
  }

  if (values['no-ignore'] === true) {
    options.ignore = [];
  } else if (Array.isArray(values.ignore)) {
    options.ignore = values.ignore;
  }

  return options;
}

function main(argv: string[]): number {
  let parsed;
  let options: FormatOptions;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        indent: {type: 'string'},
        'sort-keys': {type: 'boolean'},
        check: {type: 'boolean'},
        'final-newline': {type: 'boolean'},
        eol: {type: 'string'},
        ignore: {type: 'string', multiple: true},
        'no-ignore': {type: 'boolean'},
        help: {type: 'boolean', short: 'h'},
        version: {type: 'boolean', short: 'v'},
      },
    });
    options = readOptions(parsed.values);
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    console.error('Run format-json-files --help for the usage.');
    return 1;
  }

  const {values, positionals} = parsed;
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  if (values.version) {
    // A relative require inside the package reaches package.json without going through the exports map.
    const {version} = createRequire(import.meta.url)('../package.json') as {version: string};
    console.log(version);
    return 0;
  }

  // As 1.0.6 did, a missing path is the library's "Path argument not set", now without the stack trace.
  const paths = positionals.length === 0 ? [''] : positionals;
  let status = 0;
  for (const target of paths) {
    try {
      const report = formatJsonFiles(target, options);
      for (const {path, reason} of report.skipped) {
        console.error(`${path}: ${reason}`);
        status = 1;
      }

      if (options.check) {
        for (const path of report.changed) {
          console.log(path);
          status = 1;
        }
      }
    } catch (error) {
      const {name, message} = error as Error;
      // The error line is 1.0.6's (the golden capture pins it); the path follows on its own line.
      console.error(`${name}: ${message}`);
      if (target !== '') {
        console.error(`  path: ${target}`);
      }

      status = 1;
    }
  }

  return status;
}

process.exitCode = main(process.argv.slice(2));
