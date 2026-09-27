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

## [2026-09-26] add | Phase 2 end: pull request, CI
- Fresh clone of v2 in the scratchpad: npm ci (0 vulnerabilities), lint, typecheck, npm test 137 pass 4 skipped, check clean.
- delete-branch-on-merge on (gh repo edit). Pull request #2 opened: https://github.com/m4bwav/format-json-files/pull/2
- First CI run 36277483722 failed: (1) lint: unicorn/no-named-default and no-top-level-side-effects in src/require.ts, which local xo had not reported because its cache (node_modules/.cache/xo-linter) predated the edit; (2) golden dir-links on every runner: the runners can create file links, so 2.x reported inside/file-link.json as "symbolic link", which the capture (Windows, no link) never saw. Fixed with the E6 named exception in the golden test and a require.ts lint override with reasons.
- CI run 36277589680: every job green (lint, package shape and coverage, Node 20/22/24/26 Linux, Windows, macOS, Bun, Deno, ci).
- Phase 3 review subagent running in the background (read-only).

## [2026-09-26] add | Phase 3: independent review
- Read-only review subagent (general-purpose, about 6 minutes): 7 findings, all verified by its own scripts against the build and the published 1.0.6 on scratch trees. Fixed in one commit: (1) string regex overflowed V8's backtrack stack at about 10M characters, now an indexOf loop, plus a per-file catch; (2) plain integers above 2^53 that are exact doubles were written with other digits (1152921504606846976, 1e21 and up), rule now "same digits written back"; (3) a non-object second argument threw (forEach passes an index), now ignored as 1.0.6 did; (4) lstat in the walk unguarded, now a cannot-read skip (mocked readdirSync test); (5) hard links rewrite in place, security wording narrowed to symbolic links; (6) --ignore help says it replaces the defaults; (7) reasons cut to 40 characters.
- After the fixes: xo (cache cleared) and tsc clean, 141 pass 4 skipped on Node 24 and 20, coverage 100 percent, golden files untouched since 7107861, CI run 36277900880 green. Review summary posted on pull request #2.
- Stop: Mark reviews pull request #2.

## [2026-09-27] add | Phase 4: merge and cleanup
- Mark merged pull request #2 himself on 2026-09-26T23:59:19Z as a merge commit (not squash): 5292dcf5a694b7f5427f400f84e894fade71bc18 (`gh pr view 2 --json mergeCommit,mergedAt`). Branch v2 deleted by delete-branch-on-merge. The master ruleset went on after the merge, not before (Mark merged before the go list ran).
- Mark's go for the whole cleanup list: "I merged, you test it out if you want but keep going" (answering the go list in the Phase 3 stop).
- post-merge-cleanup.sh --apply: webhook 72197148 (Travis) deleted; ruleset 24055957 (master, copied from get-title-at-url 24003504, required check ci) and 24055958 (tags admins only). Alerts 0, open pull requests 0, branches master only, webhooks 0.
- gh repo edit: description, homepage https://www.npmjs.com/package/format-json-files, topics, wiki and projects off. Secret scanning and push protection enabled; private vulnerability reporting on; default workflow permissions read, pull request approval off.
- CI on master after the merge: run 36281112143 green. check-readme-images.mjs on the README: every image works (the CI badge now resolves).

## [2026-09-27] add | Phase 5: rehearsal
- preflight-tag-npm.sh 2.0.0-beta.1 READY; `npm version 2.0.0-beta.1`, `git push --follow-tags` (tag and master through the admin bypass). release.yml run 36281331934 failed in the build job: xo linted the release-notes.md the workflow had just written (unused [2.0.0] link definition). Nothing staged; tag v2.0.0-beta.1 left in place, unused.
- Fix through pull request #3 (xo and git ignore release-notes.md), CI 36281385356 green, squash-merged 50ff9f1. Skill lesson L-039.
- preflight 2.0.0-beta.2 READY; tagged a0e9c48; release.yml run 36281483946 green: staged with id 3b707664-b7a5-46c8-aec1-81cdface1039 on tag next, provenance in the transparency log (logIndex 2969570815), GitHub Release v2.0.0-beta.2. This proves the trusted publisher Mark set up on 2026-09-26.
- Stop: Mark approves the staged 2.0.0-beta.2 on npmjs.com (Staged Packages tab).
