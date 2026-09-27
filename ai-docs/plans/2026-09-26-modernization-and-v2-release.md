---
title: Modernization and v2 release
kind: plan
status: active
date: 2026-09-26
verified: 2026-09-26
stale_after: never
tags: [v2, plan, npm, github-actions, tests, release, filesystem]
summary: "the living plan for format-json-files 2.0.0: survey, what 1.0.6 gets wrong, decisions D1-D16, the v2 API, build and test strategy, phases 0-7 with checkboxes, dispositions, security, verification checklist"
---

# Modernization and v2.0.0 release plan: format-json-files

The plan for taking format-json-files from 1.0.6 (2018) to a verified 2.0.0, run with the package-modernize skill (npm reference) after the stack-exchange-markdown-retriever run of the same day. Evidence goes to [../log.md](../log.md) as it lands; the survey and the capture findings are in [../notes/2026-09-26-phase-0-survey-baseline-and-capture.md](../notes/2026-09-26-phase-0-survey-baseline-and-capture.md).

## Status

Active. Phases 0 to 4 done; 2.0.0-beta.2 staged 2026-09-27 (beta.1 burned by a release-notes lint failure). Waiting for Mark's approval on npmjs.com.

## Goal

- Works from `import` and `require` with types; `require('format-json-files')(path)` keeps working.
- Never loses data: a file 2.x cannot rewrite exactly is left alone and reported, never rewritten with loss.
- For every tree 1.0.6 handled without loss, 2.x picks the same files and writes the same bytes by default (the golden file proves it); the one known dependent's files stay untouched.
- Answers issue #1 with a `sortKeys` option; adds a check mode for CI; zero runtime dependencies; Node 20, 22, 24, 26 on three OSes plus Bun and Deno.
- Released through trusted publishing with Mark's approval, verified from the registry.

## Where it stands (survey 2026-09-26)

| Fact | Value | Evidence |
|---|---|---|
| Published version, date, downloads a month, dependents | 1.0.6 of 2018-12-24 (all seven versions that day); 31 a month; registry 0; code search 1: cdlib/cdlib-ui runs `format-json-files sample-data` | survey note |
| Source, build, tests, language level | `index.js` CommonJS, synchronous, returns undefined; `cli.js` meow 5 with shebang; `test.js` ava 1; no build, no `engines`, no `exports` | survey note |
| Entry points and how the old README says to call it | `var formatJsonFiles = require('format-json-files'); formatJsonFiles('./data');` and `format-json-files "<path>"` | README |
| Runtime dependencies and distance from current | meow ^5 (5.0.0 resolves; latest 14.1.0); 3 runtime alerts come through it | survey note |
| Issues, pull requests, forks | Issue #1 (bertyhell, 2019-12-06) "sorting keys would be a useful option", open; no pull requests, forks, tags or other branches | survey note |
| Dependabot alerts, webhooks, secrets, security features | 103 alerts (100 dev, 3 runtime); webhook 72197148 (Travis); no secrets; scanning, push protection off; workflow permissions write | survey note |
| Dead services | Travis (badge, `.travis.yml`, webhook 72197148); Snyk (badge, `.snyk`, `snyk test` in scripts; no webhook, OAuth app revoked 2026-09-25 by Mark); Coveralls (badge, scripts); David, nodei.co, Gitter (badges) | survey note |
| README images and badges | 7 images, 6 to fix; the published README equals the repository's | check-readme-images.mjs output in the survey note |
| Leaked credentials | None (every version's scripts, history grep) | survey note |
| Baseline: old build and tests as they are | snyk stops without a login; xo 0.23 crashes on Node 24; ava 1 passes 5 tests; nyc reports 0 percent | log |
| Golden capture: cases, quirks, claims | 45 cases (33 library, 12 CLI) over 8 fixture trees, 59 KB, two runs identical; every kickoff claim confirmed, five more found (next section) | `test/golden/1.0.6.json` |

## What the old version gets wrong, confirmed, and what v2 does

1. **Big integers are rewritten** (`big-integer.json`: 12345678901234567890 becomes 12345678901234567000). v2 refuses the file: left untouched, reported as skipped with the reason. Changelog: Changed (breaking), files whose numbers cannot be kept exactly are no longer rewritten.
2. **Duplicate keys are dropped** (`duplicate-keys.json`: `"b":1,"b":2` keeps only `"b":2`). v2 refuses the file, as 1.
3. **-0 becomes 0, and numbers beyond the double range become null** (`negative-zero.json`, `big-float.json`; `1e400` is written as `null`). v2 refuses the file, as 1. A number that underflows to 0 (`1e-400`) is refused too.
4. **Invalid UTF-8 becomes U+FFFD** (`latin1.json`: the byte 0xE9 is rewritten as the replacement character). v2 refuses the file, as 1.
5. **A UTF-8 BOM makes the file unparseable** (`bom.json` skipped). v2 strips the BOM and formats the file. Changelog: Changed.
6. **Every error goes to stdout and the CLI exits 0** after skipping files (`dir-invalid`, `cli-invalid-file`). v2's library logs nothing and returns a report; the CLI prints each skipped file and its reason on stderr and exits 1 when any file was skipped. Changelog: Changed (breaking).
7. **Every matched file is rewritten, even when nothing changes** (`dir-twice`: 29 of 29 written again). v2 writes only files whose bytes change. Changelog: Changed.
8. **The walk descends into node_modules and .git** (`dir-names`: node_modules/pkg/package.json and .git/config.json rewritten). v2 skips directories named `node_modules` and `.git` by default (option `ignore`). Changelog: Changed (breaking).
9. **The walk writes through file symbolic links** (code reading; the capture could not create one on Windows). v2's walk skips symbolic links and junctions of every kind and reports them; a path given explicitly behaves as in 1.0.6 (a link as the argument throws `Invalid path`, a path through a junction is followed). Changelog: Changed.
10. **The CLI loses the path after an unknown flag** (`cli-unknown-flag`: `--sort-keys .` throws "Path argument not set"), `-h` is not help, a second path is ignored, and every failure prints a stack trace. v2's CLI uses `node:util` `parseArgs` (strict), knows its flags, takes several paths, prints one-line errors. Changelog: Changed.
11. **Deeply nested input overflows the stack** (`deep-10000.json`). Kept as a skip, now with the reason "nested too deeply" in the report. Changelog: none beyond 6.
12. **Integer-like keys move to the front** (`key-order.json`), and numbers and escapes are normalised (`1.0` to `1`, `"a\/b"` to `"a/b"`). Kept: that is 1.0.6's format, the dependent's files are in it, and no value changes. README "Limits" says so. `sortKeys` gives a real order.

## Decisions (recommendation first; Mark rules in the plan review, silence means the recommendation stands)

| # | Question | Recommendation | Why | Alternative |
|---|---|---|---|---|
| D1 | The compatibility promise | For every golden case, 2.x with default options chooses the same files, writes the same bytes and throws the same argument errors (class and message) as 1.0.6, except the named exceptions E1 to E8 below, each listed once in the golden test with its changelog line. A later fix that would change a default result goes behind an option. | The dependent's files are exactly 1.0.6's output; the golden file proves the promise per case. | Promise only "valid JSON is formatted", with no byte promise (cheaper, but the dependent would see churn from any change). |
| D2 | Export shape | Default export `formatJsonFiles(path, options?)` plus the same function as the named export `formatJsonFiles`; `require()` returns the function (the replace-string-at-position recipe: two tsdown configs, `cjsDefault`); types for both; `exports` map with `import`, `require`, `./package.json`; bin `format-json-files` at dist/cli.mjs. | The old README's `require()` line must keep working. | ESM only (breaks every CommonJS caller). |
| D3 | Behaviour at the edges (named exceptions) | E1 lossy files refused: numbers written as plain integers that are not exact doubles (numbers with a fraction or exponent are floats, as always), duplicate keys, -0, overflow to Infinity, non-zero numbers that underflow to 0, invalid UTF-8 (items 1 to 4). E2 BOM stripped, file formatted, written without the BOM (5). E3 unchanged files are not written (7). E4 the library returns a report and logs nothing (6). E5 node_modules and .git skipped by default (8). E6 links skipped by the walk (9). E7 CLI: stderr, exit 1 on any skip, several paths, strict flags, new help and version text (10). E8 UTF-16 files: still skipped, now with the reason "not UTF-8". Everything else keeps 1.0.6's bytes, including item 12. | Each is either data loss or noise; none changes the bytes of a file 1.0.6 formatted without loss, except E5. | Keep the BOM when writing (E2); keep walking node_modules (E5) and make skipping an option. |
| D4 | Whether a major is warranted | Yes: 2.0.0. The return value, the refusals, the CLI exit code, the node_modules default and the Node floor all break something. | A minor would hide the exit-code change from the dependent's CI. A patch could only fix the BOM and the stdout noise, not the data loss. | 1.1.0 with the refusals behind an option (keeps the data loss as the default). |
| D5 | Runtime dependencies | None. meow goes for `node:util` `parseArgs` (stable since Node 20). The lossless check is a small JSON scanner in `src/` (about 150 lines). | Zero dependencies, three runtime alerts gone. | A parser dependency that keeps number text (json-bigint, lossless-json): adds a dependency for one check. |
| D6 | Names: kept, added | Kept: the default export and its argument errors. Added, each with its reason: `indent` (number or `'\t'`, default 4; teams use 2 or tabs), `sortKeys` (default false; issue #1), `check` (write nothing, report what would change; for CI), `finalNewline` (default false; editors and POSIX tools expect one, and 1.0.6 fights them), `eol` (`'lf'` default, `'crlf'`, or `'auto'` to keep each file's; Windows repositories otherwise churn), `ignore` (directory names the walk skips, default `['node_modules', '.git']`; `[]` walks everything like 1.0.6). CLI: `--indent`, `--sort-keys`, `--check`, `--final-newline`, `--eol`, `--ignore` (repeatable), `--no-ignore`, `--help`, `--version`. | Each answers a real use; defaults keep 1.0.6's output. | Trim `eol` and `finalNewline` to a later minor. |
| D7 | Errors | Argument errors throw exactly as 1.0.6 (golden). Invalid options throw `TypeError`. Per-file failures never throw: they go in the report as `{path, reason}`. | The golden cases pin the argument errors; a walk should finish. | Throw an AggregateError at the end when anything was skipped. |
| D8 | Node floor and CI matrix | Overlay standing decision: `engines >=20`, Node 20, 22, 24, 26 on Linux, plus Windows and macOS on 24, Bun and Deno fixtures. | Nothing here needs newer. | none |
| D9 | Language, build, lint, tests, coverage | The npm defaults: TypeScript, tsdown pinned, xo, `node:test` against `dist/`, c8 95/90, publint, attw. Portability: the library is Node-only by nature (`node:fs`, `node:path`), so the template's "no Node APIs" shape test is replaced by a check that the library imports only `node:` built-ins; Bun and Deno still run the consumer fixtures. | Standing decision; the portability default does not fit a filesystem library. | none |
| D10 | Lockfile and old bot pull requests | Regenerate `package-lock.json` (v3). There are no bot pull requests. | Closes the 103 alerts. | none |
| D11 | Dead services, badges and images | Remove `.travis.yml`, `.snyk`, the Travis webhook 72197148 and all seven images; the README gets the three standard badges (npm version, CI, downloads). The XO badge goes too (standing three-badge rule). | Table below. | Keep the XO badge (it still answers). |
| D12 | Old files to remove | `index.js`, `cli.js`, `test.js`, `.travis.yml`, `.snyk`, `package-lock.json` (regenerated). | Replaced by `src/`, `test/` and the templates. | none |
| D13 | Release and version | `2.0.0-beta.1` rehearsal on `next`, then `2.0.0` on `latest`; trusted publisher already set up by Mark (overlay); deprecate 1.x afterwards in Mark's terminal with the full message given. | The skill's ritual. | none |
| D14 | Default branch, extras | Keep `master`. No async API in 2.0.0 (a promise-based named export can come in a minor if asked for). No JSR. | Do not gold-plate. | An async `formatJsonFilesAsync` now. |
| D15 | Dependents | cdlib/cdlib-ui (^1.0.6) is not moved by 2.0.0. If it upgrades, its files are already in 1.0.6's format, so 2.x writes nothing to them and exits 0. No pull request to them. | The capture's `cli-dependent` case plus their real files. | Open an issue there announcing 2.0.0 (not recommended: unsolicited). |
| D16 | Issue #1 | Answer when 2.0.0 is live: `sortKeys` / `--sort-keys` sort object keys recursively by UTF-16 code unit order (arrays keep their order), with the version; then close. | The one issue, answered with a real answer. | none |

Questions for Mark at this stop: none beyond the table. Applying repo settings, secret scanning and the rulesets through `gh` is standing-authorized; the Phase 4 go list (webhook, rulesets, settings, scanning, the issue answer, deleting the merged v2 branch) comes in one message before the cleanup.

## Proposed public API (v2)

```ts
export interface FormatOptions {
  indent?: number | '\t';            // 0 to 10, default 4
  sortKeys?: boolean;                 // default false
  check?: boolean;                    // default false: write nothing, report what would change
  finalNewline?: boolean;             // default false
  eol?: 'lf' | 'crlf' | 'auto';      // default 'lf'
  ignore?: readonly string[];         // directory names skipped by the walk, default ['node_modules', '.git']
}

export interface FormatReport {
  changed: string[];                  // written, or in check mode would be written
  unchanged: string[];                // already formatted; not written
  skipped: Array<{path: string; reason: string}>;
}

export default function formatJsonFiles(path: string, options?: FormatOptions): FormatReport;
export {formatJsonFiles};
```

- Throws `Error('Path argument not set')` for a falsy path, `TypeError('Target path argument is not a string')` for a non-string, `Error('Invalid path')` when the path is neither a file nor a directory (lstat), exactly as 1.0.6. Throws a TypeError for an invalid option.
- A file path is formatted whatever its extension; a directory is walked recursively in `readdir` order and every file whose name ends in `.json` (case-insensitive) is formatted, as 1.0.6.
- Report paths are `path.join(directory, entry)`, as 1.0.6 built them.
- Skip reasons (stable strings, tested): `not valid JSON: <parser message>`, `not UTF-8`, `number cannot be kept exactly: <token>`, `duplicate key: <key>`, `nested too deeply`, `symbolic link`, `cannot write: <code>`, `cannot read: <code>`.
- CLI: `format-json-files [options] <path...>`; exit 0 when every file was formatted or unchanged, 1 when any file was skipped, when `--check` found a file to change, or on a usage error; `--check` lists the files that would change on stdout.

## Build and package specifics

- src/index.ts (the export and the walk), src/format.ts (one file's text to formatted text, or a skip reason), src/scan.ts (the lossless check: numbers, duplicate keys), src/serialize.ts (JSON.stringify's output with sorted keys; used only when `sortKeys` is on, so the default path stays `JSON.stringify(value, null, indent)`), src/cli.ts.
- Two tsdown configs (ESM with default and named exports; CommonJS whose export is the function with `default` and `formatJsonFiles` attached), `platform: 'node'`, `banner` `'use strict'` on CommonJS; the CLI as a third entry with the shebang.
- `package.json`: `files` [`dist`, minus maps], `bin` `{"format-json-files": "dist/cli.mjs"}`, `engines` `>=20`, `sideEffects: false`, `repository.url` `git+https://github.com/m4bwav/format-json-files.git`, author and homepage per the overlay.

## Phases

### Phase 0: survey and baseline (2026-09-26, no package code changed)
- [x] Cloned to `D:\m4bwa\Claude\Projects\Ai\format-json-files`; survey output in the survey note
- [x] Old build and tests run as they are: snyk login, xo crash, ava 5 passed, nyc 0 percent
- [x] Golden capture from the published 1.0.6 committed under `test/golden/` with its script, fixtures and codec (commit 7107861: these files stay as they are from here on)
- [x] everlast registered (mode repo, sync push); AGENTS.md, CLAUDE.md (the AGENTS.md import line), Copilot pointer
### Phase 1: plan
- [x] This plan and the decision record. **Stop**: Mark rules on the table.
### Phase 2: rewrite on branch v2
- [x] Remove the dead files; add the templates; deny dev-only install scripts
- [x] Golden test first, green on the first build; canary: a planted line in src/ turns it red, reverted, green (both logged); golden files unchanged since 7107861 (`check-golden-untouched.sh`); then src/, the rest of test/, README, CHANGELOG, SECURITY.md, AGENTS.md
- [x] Verified on Node 20, 22, 24, 26 and from a fresh clone (log)
- [x] Workflows and Dependabot added, actionlint and check-workflow-shell clean; delete-branch-on-merge on
- [x] Pushed; pull request opened with a "For review" list. **Stop.**
### Phase 3: review
- [x] Independent read-only review (prompts/review-subagent.md); findings fixed or answered; summary on the pull request
### Phase 4: CI, settings, merge, cleanup
- [x] CI green (36277900880, master 36281112143); merged by Mark as merge commit 5292dcf; ruleset 24055957 after the merge
- [x] One go from Mark for the whole cleanup list (dry run of post-merge-cleanup.sh with ai-docs/notes/dispositions.tsv), then `--apply --tag-ruleset`: alerts 0; tag ruleset; webhook removed; repo settings; secret scanning, push protection, private vulnerability reporting; workflow permissions read; merged v2 branch deleted
### Phase 5: release rehearsal
- [x] Trusted publisher: already set up by Mark (overlay, 2026-09-26); proven by the beta.2 staging (run 36281483946)
- [ ] `preflight-tag-npm.sh 2.0.0-beta.1` READY; tagged; `watch-run.sh` shows the stage id; **stop** for the approval; `verify-registry-npm.sh` VERIFIED
### Phase 6: release
- [ ] Changelog dated; preflight READY; `2.0.0` tagged and staged; **stop** for the approval; `verify-registry-npm.sh` VERIFIED
- [ ] Issue #1 answered and closed
- [ ] 1.x deprecated by Mark in his terminal with the full message; read back with `--prefer-online`
### Phase 7: wrap-up
- [ ] HANDOFF.md around standing work; inventory row; lessons into the skill; the kickoff's corrections section

## Test strategy: every artifact, every runtime, and the behaviour itself

| Layer | What it proves | How | Runs where |
|---|---|---|---|
| Golden | Every 1.0.6 case: same files, same bytes, same throws, exceptions E1 to E8 named once | test/golden/golden.test.js rebuilds each tree from `capture-fixtures.cjs` in a temp dir, runs both builds (library cases) and dist/cli.mjs (CLI cases) | every Node line, three OSes |
| Unit | scanner (numbers at the safe-integer edge, exponents, -0, underflow, duplicate keys in nested objects, escaped keys that collide), serializer equals JSON.stringify on random values when sortKeys is off, options validation | `test/unit/*.test.js` | every Node line |
| Functional | walk order, ignore, links (file links and junctions where the OS allows), read-only files, check mode writes nothing, eol auto, BOM | temp trees | three OSes |
| CLI | flags, several paths, exit codes, stderr lines, `--check` output | spawn dist/cli.mjs | every Node line |
| Package shape | publint, attw, pack list, the library imports only `node:` built-ins | test/package/shape.test.js, `npm run check` | Node 24 |
| Consumers | ESM, CJS, four TypeScript modes, the bin, Bun, Deno | `test/consumers/` from the packed tarball | CI |
| Registry | the published version installs and runs everywhere | `verify-published.yml` | after each approval |

| Artifact | Runtime lines | Other OSes | Other runtimes | Bare engine |
|---|---|---|---|---|
| dist/index.mjs, index.cjs | 20, 22, 24, 26 | Windows, macOS (24) | Bun, Deno | not applicable (Node-only) |
| dist/cli.mjs | 20, 22, 24, 26 | Windows, macOS (24) | Bun, Deno (bin fixture) | not applicable |
| type files | TypeScript 5.9 and 6 | | | |

## Pull requests, issues and forks: disposition

| Item | What it is | Disposition | Comment to post |
|---|---|---|---|
| Issue #1 | bertyhell, 2019-12-06: sorting keys | Answer and close once 2.0.0 is live | "Thanks for the suggestion, and sorry it took this long. format-json-files 2.0.0 adds it: `formatJsonFiles(path, {sortKeys: true})` or `format-json-files --sort-keys <path>` sorts object keys recursively (arrays keep their order). It is off by default, so existing output does not change." |
| Branch v2 | the rewrite, after its squash merge | Delete (in the go list) | |
| Webhook 72197148 | Travis CI, dead service | Delete (in the go list) | |

## Security

- No leaked credentials found (history, every version's scripts). Snyk's OAuth app was revoked by Mark on 2026-09-25; this repository has no Snyk webhook.
- Webhook 72197148 (Travis) removed in Phase 4 with the go.
- Secret scanning, push protection and private vulnerability reporting turned on; default workflow permissions read, approval of pull requests off.
- Alerts: 103 today, 0 after the lockfile regeneration (3 runtime ones go with meow).
- Workflows from the templates: actions pinned to SHAs, `contents: read` by default, the publish job alone with id-token set to write, installs nothing; tag ruleset admins only; `.npmrc` `min-release-age=3`.
- What the library does: reads and writes only the files it was pointed at or finds by walking. v2's walk no longer follows links (1.0.6 wrote through file links, so a link inside a tree could make it rewrite a file anywhere). No network, no `eval`, no child processes. README "What it is not": not a validator or a linter, not a JSON5 or JSONC formatter, not safe to run on a tree you do not own the files of.
- SECURITY.md with private reporting and supported versions (2.x).

## Badges and images: disposition

| Image or badge | What it shows now | Decision | New URL or reason |
|---|---|---|---|
| nodei.co npm card | unmaintained service | Replace | shields.io npm version badge |
| Travis build | "not found" | Replace | `https://github.com/m4bwav/format-json-files/actions/workflows/ci.yml/badge.svg` |
| David dependencies | "not found" | Remove | Dependabot covers it |
| Coveralls | "not found" | Remove | no coverage service (standing decision) |
| Snyk | dead | Remove | Dependabot and `npm audit` in CI |
| XO code style | answers | Remove | three-badge rule |
| Gitter | dead | Remove | no chat |
| npm downloads (new) | | Add | `https://img.shields.io/npm/dm/format-json-files` |

## Verification checklist (what "done" means)

| Claim | Command or place | Expected |
|---|---|---|
| Installs clean | `npm ci` in a fresh clone | no deprecation warnings, 0 vulnerabilities |
| Zero runtime dependencies | `npm ls --omit=dev --all` | nothing under the package |
| Old behaviour kept | `npm test`, CI, verify-published | every golden case on both builds, every Node line |
| Old call pattern works | `node -e "require('format-json-files')('<tmp>')"` | the captured bytes |
| Dependent unaffected | the golden `cli-dependent` case; 2.x on cdlib-ui's real sample-data in a temp copy | nothing written, exit 0 |
| Dual output is correct | `npx publint`, `npx attw --pack .` | no errors in any mode |
| Every Node line | the CI matrix | all green |
| Published with provenance | `verify-registry-npm.sh format-json-files 2.0.0 m4bwav/format-json-files` | VERIFIED |
| No alerts | `gh api "repos/m4bwav/format-json-files/dependabot/alerts?state=open" --jq length` | 0 |
| Repo tidy | `gh pr list`, `git ls-remote --heads origin`, hooks | no open pull requests, only master, 0 webhooks |
| Badges and images work | `check-readme-images.mjs` on the new README and the registry's | exit 0 |
| Scanning on | `gh api repos/m4bwav/format-json-files --jq .security_and_analysis` | secret scanning and push protection enabled |

## Risks and open points

- The lossless scanner is new code in the one place data loss can hide: it gets unit tests at every number edge and a differential test (scanner verdict against a BigInt-exact reparse) on generated inputs.
- File symbolic links were not captured (Windows EPERM); their behaviour is tested only in 2.x's functional suite on Linux and macOS.
- V8's JSON.parse messages appear in skip reasons and differ between Node lines; tests match the prefix only.

## Appendix: cleanup commands (all paths absolute)

`ai-docs/notes/dispositions.tsv` for scripts/post-merge-cleanup.sh (tab-separated; `{SHA}` becomes the merge commit):

~~~
branch	v2
hook	72197148
~~~

## Next single action

Mark rules on the decisions table (silence means the recommendations stand); then Phase 2 on branch v2, golden test first.

Related: builds on [../notes/2026-09-26-phase-0-survey-baseline-and-capture.md](../notes/2026-09-26-phase-0-survey-baseline-and-capture.md); see also [../decisions/2026-09-26-v2-promise-refuse-lossy-files-keep-1.0.6-bytes.md](../decisions/2026-09-26-v2-promise-refuse-lossy-files-keep-1.0.6-bytes.md).
