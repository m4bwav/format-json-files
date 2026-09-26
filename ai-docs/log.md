# Log

Append-only. One line per operation: `## [YYYY-MM-DD] op | title` where op is one of add, update, supersede, verify, verify-failed, prune, handoff, index. Newest at the bottom. Never edited, only appended; this is the history the entries themselves do not carry.

## [2026-09-26] init | scaffolded

## [2026-09-26] add | Phase 0: survey, baseline, golden capture
- survey-npm.sh output, tarball diff (equal to master apart from CRLF), every version's scripts (no token), history grep (none), check-readme-images.mjs (6 of 7 to fix), cdlib/cdlib-ui call site and file format: ai-docs/notes/2026-09-26-phase-0-survey-baseline-and-capture.md.
- Baseline in a scratch clone on Node 24.18: snyk stops without a login, xo 0.23 crashes (util.isDate), ava 1 passes 5 tests, nyc 13 reports 0 percent.
- Golden capture of the published 1.0.6 (meow 5.0.0) in the scratchpad: 47 cases, 59 KB, two runs byte-identical (cmp). Committed as test/golden/1.0.6.json with capture-1.0.6.cjs, capture-fixtures.cjs and codec.cjs; frozen from this commit.
## [2026-09-26] index | rebuilt (1 entries)
- Correction: the capture holds 45 cases (33 library, 12 CLI), not 47.

## [2026-09-26] add | Phase 1: plan and decision record
- ai-docs/plans/2026-09-26-modernization-and-v2-release.md (D1-D16, exceptions E1-E8) and ai-docs/decisions/2026-09-26-v2-promise-refuse-lossy-files-keep-1.0.6-bytes.md (proposed). Stop: waiting for Mark's rulings.
## [2026-09-26] index | rebuilt (3 entries)

## [2026-09-26] update | Plan ruled
- Mark accepted every recommendation in the decisions table (D1-D16, E1-E8). Decision record status accepted. Phase 2 starts on branch v2.

## [2026-09-26] add | Phase 2: golden test green, canary, untouched
- Branch v2: old index.js, cli.js, test.js, .travis.yml, .snyk and the lockfile removed; src/ (scan, serialize, format, format-json-files, index, require, cli) and test/golden/golden.test.js written. npm install: 493 packages, 0 vulnerabilities.
- First full golden run on the first green build: 78 of 78 (33 library cases on each build, 12 bin cases). Before that, two fixes in src/cli.ts and the test's E2 skip-check (the bin's error line had the path appended; 1.0.6's line is exact).
- Canary: `indent = 4` changed to `indent = 3` in src/format-json-files.ts, build, `node --test test/golden/golden.test.js`: pass 40, fail 38. Reverted with `git checkout -- src/`, rebuilt: pass 78, fail 0.
- check-golden-untouched.sh: 1.0.6.json, capture-1.0.6.cjs, capture-fixtures.cjs and codec.cjs unchanged since 7107861.
- Declaration trap: an `export =` function merged with a namespace re-exporting types under their own names made tsdown write `type FormatOptions = FormatOptions`; the types are now declared as Options, Report and Skipped and exported under the public names.

## [2026-09-26] add | Phase 2: suites, docs, workflows, verification
- Scanner rule narrowed while writing its tests: only numbers written as plain integers must be exact doubles; numbers with a fraction or exponent are floats and accepted unless they overflow, underflow or are -0 (otherwise 6.02e23 and 1e23 would be refused). Plan D3 item 1 and the decision record say so.
- Suites: golden 78, unit (scan with a 400-token differential, serialize with generated values, options), functional walk, CLI, package shape: 141 tests, 137 pass, 4 skipped on Windows (file links, POSIX modes; they run on Linux and macOS). The same on Node 20.20.2, 22.23.2 and 26.10.0 (npx -p node@N node --test ...) and 24.18.
- Coverage (c8, src/ remapped): 100 percent lines, branches and functions on every file.
- npm run check: publint all good, attw no problems in node10, node16-cjs, node16-esm and bundler; tarball 11 files, 18.2 kB.
- Consumers (npm run test:consumers): 8 pass, 5 skipped (Bun and Deno, CI only). Two declaration traps fixed: `type FormatOptions = FormatOptions` (types declared under short names) and `var formatJsonFiles: typeof formatJsonFiles` inside the namespace (TS2502 for every CommonJS consumer; now `export {formatJsonFiles as default, formatJsonFiles}` in an ambient namespace plus Object.assign).
- xo --fix traps met again: it turned the JSON `null` type into `undefined` (restored, rule off with a reason) and turned quoted number tokens in a test table into number literals (the table is now string pairs).
- actionlint 1.7.12 clean, check-workflow-shell.py clean, zizmor --offline no findings. check-readme-images.mjs: npm badges ok, the CI badge 404s until ci.yml is on master.
- Dependent check: 2.x bin on cdlib/cdlib-ui's 20 sample-data files (downloaded to the scratchpad): exit 0, md5 of every file unchanged, --check exit 0.
