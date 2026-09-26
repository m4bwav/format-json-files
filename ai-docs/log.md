# Log

Append-only. One line per operation: `## [YYYY-MM-DD] op | title` where op is one of add, update, supersede, verify, verify-failed, prune, handoff, index. Newest at the bottom. Never edited, only appended; this is the history the entries themselves do not carry.

## [2026-09-26] init | scaffolded

## [2026-09-26] add | Phase 0: survey, baseline, golden capture
- survey-npm.sh output, tarball diff (equal to master apart from CRLF), every version's scripts (no token), history grep (none), check-readme-images.mjs (6 of 7 to fix), cdlib/cdlib-ui call site and file format: ai-docs/notes/2026-09-26-phase-0-survey-baseline-and-capture.md.
- Baseline in a scratch clone on Node 24.18: snyk stops without a login, xo 0.23 crashes (util.isDate), ava 1 passes 5 tests, nyc 13 reports 0 percent.
- Golden capture of the published 1.0.6 (meow 5.0.0) in the scratchpad: 47 cases, 59 KB, two runs byte-identical (cmp). Committed as test/golden/1.0.6.json with capture-1.0.6.cjs, capture-fixtures.cjs and codec.cjs; frozen from this commit.
## [2026-09-26] index | rebuilt (1 entries)
