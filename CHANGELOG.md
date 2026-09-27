# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-09-27

**The compatibility promise.** With default options, `require('format-json-files')(path)` picks the same files 1.0.6 picked and writes the same bytes to them: 4-space indent, LF line breaks, no final newline, and `JSON.stringify`'s number and key order. It throws the same errors for a missing, non-string or non-existent path. The test suite checks this against 33 library calls and 12 command-line runs recorded from the published 1.0.6 on temporary directory trees, on both builds and every supported Node line. The exceptions are listed below. Each one is either data 1.0.6 destroyed or noise it made: files whose rewrite would change a value are left alone, a byte order mark no longer stops a file being formatted, a file that is already formatted is not written again, `node_modules` and `.git` are skipped, the walk does not follow symbolic links, the function returns a report instead of printing, and the command-line tool reports problems on stderr and exits 1 when a file was skipped.

### Changed (breaking)

- Needs Node 20 or later. The package has an `exports` map, so deep imports such as `format-json-files/index.js` no longer resolve; import the package by its name.
- Files whose rewrite would change a value are left untouched and reported, never rewritten. 1.0.6 rewrote them with the loss:
  - an integer that would be written with other digits (`12345678901234567890` became `12345678901234567000`, and `1000000000000000000000` became `1e+21`);
  - a key repeated in one object (only the last value was kept);
  - `-0` (written as `0`) and numbers beyond the double range (`1e400` was written as `null`), or a non-zero number that rounds to 0;
  - bytes that are not UTF-8 (a Latin-1 `é` was written back as `�`).
  Numbers written with a fraction or an exponent are still rounded to the nearest double, as before (`0.1000000000000000055` is written as `0.1`).
- The function returns a report, `{changed, unchanged, skipped}`, and prints nothing. 1.0.6 returned `undefined` and printed each file it could not format on stdout.
- The walk does not enter directories named `node_modules` or `.git`. Pass `ignore: []` (or `--no-ignore`) to walk everything as 1.0.6 did.
- The command-line tool prints each skipped file on stderr as `path: reason` and exits 1 when any file was skipped. 1.0.6 printed them on stdout and exited 0. A missing or invalid path prints 1.0.6's error line without the stack trace.
- The command-line tool reads its flags strictly: an unknown flag is an error. In 1.0.6, `--sort-keys .` swallowed the `.` as the flag's value and lost the path. `-h` is now help.

### Changed

- A file is written only when its bytes change. 1.0.6 rewrote every matched file, touching every modification time.
- A file that starts with a UTF-8 byte order mark is formatted, and written without the mark. 1.0.6 could not parse it and skipped it.
- The walk skips symbolic links named `*.json` and reports them. 1.0.6 wrote through them, to wherever they pointed. Links to directories were never entered, and a link given as the path still throws `Invalid path`, as before.
- The command-line tool takes several paths. 1.0.6 ignored all but the first.
- A second argument that is not an object is still ignored, as in 1.0.6, so `paths.forEach(formatJsonFiles)` keeps working.

### Added

- `sortKeys` (`--sort-keys`): sorts object keys at every level, by UTF-16 code unit; arrays keep their order. Off by default. Answers [issue #1](https://github.com/m4bwav/format-json-files/issues/1).
- `check` (`--check`): writes nothing; `changed` lists the files that would be rewritten, and the command-line tool prints them and exits 1. For CI.
- `indent` (`--indent <0-10|tab>`), default 4.
- `finalNewline` (`--final-newline`) and `eol` (`--eol lf|crlf|auto`), defaults as 1.0.6: no final newline, LF.
- `ignore` (`--ignore <name>`, repeatable, and `--no-ignore`).
- `--help` and `--version` without meow.
- ES module build with a default and a named export; TypeScript declarations for both builds, including `FormatOptions` and `FormatReport`.
- Published from GitHub Actions through npm trusted publishing, with provenance.

### Security

- No runtime dependencies. 1.x depends on meow 5, whose tree carries three advisories.
- The walk no longer writes through symbolic links (see Changed), so a symbolic link inside a tree cannot make it rewrite a file outside the tree. A hard link is the file itself and is rewritten in place, as before.

[2.0.0]: https://github.com/m4bwav/format-json-files/compare/15891f9...v2.0.0
