# format-json-files

[![npm version](https://img.shields.io/npm/v/format-json-files.svg)](https://www.npmjs.com/package/format-json-files)
[![CI](https://github.com/m4bwav/format-json-files/actions/workflows/ci.yml/badge.svg)](https://github.com/m4bwav/format-json-files/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/format-json-files.svg)](https://www.npmjs.com/package/format-json-files)

Format JSON files in place: one file, or every `.json` file in a directory and its subdirectories. It never rewrites a file it cannot keep exactly: a file with a 20-digit id, a repeated key or bytes that are not UTF-8 is left alone and reported. It can also sort keys, and check a tree in CI without writing anything. There is a command-line tool too.

- TypeScript types, ES module and CommonJS builds, no dependencies.
- Node 20 and later. Bun and Deno run it through their Node compatibility.

## Install

```sh
npm install format-json-files
```

## Usage

```js
import formatJsonFiles from 'format-json-files';

const report = formatJsonFiles('./data');
// {changed: ['data/a.json'], unchanged: ['data/b.json'], skipped: [{path: 'data/c.json', reason: 'duplicate key: "id"'}]}
```

**CommonJS**, as in 1.x:

```js
const formatJsonFiles = require('format-json-files');

formatJsonFiles('./data', {indent: 2, sortKeys: true});
```

**Command line:**

```sh
npx format-json-files ./data
npx format-json-files --sort-keys --indent 2 config.json settings.json
npx format-json-files --check .    # in CI: lists the files that would change, exits 1 if any
```

## API

### formatJsonFiles(path, options?)

Formats the file at `path` whatever its name, or, when `path` is a directory, every file whose name ends in `.json` (in any case) in it and its subdirectories. It works synchronously and returns a report:

| Field | What it holds |
|---|---|
| `changed` | Files rewritten; with `check`, the files that would be rewritten |
| `unchanged` | Files already formatted; they are not written, so their modification times stay |
| `skipped` | `{path, reason}` for each file left alone |

Options (the defaults give 1.x's output):

| Option | Default | What it does |
|---|---|---|
| `indent` | `4` | Spaces per level, 0 to 10, or `'\t'` for tabs |
| `sortKeys` | `false` | Sort object keys at every level, by UTF-16 code unit; arrays keep their order |
| `check` | `false` | Write nothing; report what would change |
| `finalNewline` | `false` | End each file with a line break |
| `eol` | `'lf'` | `'lf'`, `'crlf'`, or `'auto'` to keep each file's (CRLF when the file has any) |
| `ignore` | `['node_modules', '.git']` | Directory names the walk does not enter; `[]` walks everything |

It throws an `Error('Path argument not set')` when `path` is empty or missing, a `TypeError` when `path` is not a string or an option is invalid, and an `Error('Invalid path')` when `path` is neither a file nor a directory. A problem with a single file never throws: the file goes in `skipped`.

The function is also exported by name (`import {formatJsonFiles} from 'format-json-files'`), and the types `FormatOptions`, `FormatReport` and `SkippedFile` are exported for both module systems.

### Command line

```text
format-json-files [options] <path> [<path> ...]

--indent <n|tab>     Spaces per level, 0 to 10, or "tab" (default 4)
--sort-keys          Sort object keys, at every level
--check              Write nothing; list the files that would change
--final-newline      End each file with a line break
--eol <lf|crlf|auto> Line breaks to write (default lf)
--ignore <name>      A directory name not to enter; repeatable
--no-ignore          Enter every directory, node_modules and .git too
-h, --help           Show the help
-v, --version        Show the version
```

It prints nothing when every file was formatted. Each skipped file goes to stderr as `path: reason`. It exits 1 when a file was skipped, when `--check` found a file to change, or on a usage error.

## Behaviour at the edges

| Input | What happens |
|---|---|
| A number written as an integer beyond 2^53 that a JavaScript number cannot hold (`12345678901234567890`) | Skipped: `number cannot be kept exactly` |
| A number written with a fraction or exponent (`0.1000000000000000055`, `6.02e23`) | Rounded to the nearest double as `JSON.parse` does, and formatted (`0.1`, `6.02e+23`) |
| `-0`, `1e400`, `1e-400` | Skipped (they would become `0`, `null` and `0`) |
| A key repeated in one object | Skipped: `duplicate key` |
| Bytes that are not UTF-8, or a UTF-16 file | Skipped: `not UTF-8` |
| A UTF-8 byte order mark | Dropped; the file is formatted |
| Invalid JSON, JSON with comments, an empty file | Skipped: `not valid JSON: ...` |
| Nesting deeper than the JavaScript stack allows (about 10,000 levels) | Skipped: `nested too deeply` |
| Keys that look like numbers (`"10"`, `"2"`) | Written first, in numeric order, as `JSON.stringify` does; `sortKeys` gives a plain sorted order |
| A symbolic link named `*.json` inside the directory | Skipped: `symbolic link` (the walk never writes through a link) |
| A link to a directory inside the directory | Not entered |
| A file that cannot be written (read-only) | Skipped: `cannot write: EPERM` or `EACCES` |

## Migrating from 1.x

- `formatJsonFiles(path)` still works and writes the same bytes for every file 1.x formatted without loss. Files 1.x would have damaged are now left alone; check `report.skipped` (or the command line's exit code) to see them.
- 1.x printed problems with `console.log` and returned nothing. Read the returned report instead.
- `node_modules` and `.git` are no longer walked. Pass `{ignore: []}` or `--no-ignore` to keep 1.x's walk.
- The command-line tool exits 1 when a file was skipped. A script that ran it on files it could not parse, and relied on exit code 0, needs to fix or exclude those files.
- Node 20 or later.

## Limits and what it is not

- It rewrites files in place. Run it on files you have committed or backed up.
- It is synchronous, and reads each whole file into memory.
- It is not a validator or a linter, and it does not read JSON5 or JSON with comments.
- It does not keep the text of numbers. `1.0` is written as `1`, `1e5` as `100000`, and `"é"` as `"é"`, as `JSON.stringify` writes them.

## License

MIT, see [LICENSE](LICENSE).
