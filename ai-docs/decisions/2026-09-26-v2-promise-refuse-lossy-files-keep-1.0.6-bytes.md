---
title: "v2 keeps 1.0.6's bytes by default and refuses files it cannot rewrite exactly"
kind: decision
status: proposed
date: 2026-09-26
verified: 2026-09-26
stale_after: never
tags: [v2, compatibility, golden, data-loss, api]
summary: "read before changing a default or the lossless check: why 2.x writes 1.0.6's exact bytes by default, why lossy files are refused rather than rewritten, and the named exceptions E1-E8"
---

# v2 keeps 1.0.6's bytes by default and refuses lossy files

## Context

1.0.6 formats with `JSON.stringify(JSON.parse(text), null, 4)`. The golden capture showed it silently changes data: big integers, duplicate keys, -0, numbers beyond the double range (written as `null`) and invalid UTF-8. The one known dependent (cdlib/cdlib-ui) keeps its sample data in exactly 1.0.6's output format and runs the bin on it.

## Decision

- Default output stays 1.0.6's (4 spaces, LF, no final newline, JSON.stringify's number and key order), proven per case by `test/golden/1.0.6.json`.
- A file whose rewrite would change a value is left untouched and reported, never rewritten with loss (a small scanner in `src/scan.ts` checks numbers and duplicate keys; invalid UTF-8 is detected with a fatal TextDecoder).
- The named exceptions E1 to E8 in the plan's D3 are the only departures, each named once in the golden test with its changelog line.

## Reasons

- Data loss in a tool that rewrites files in place is the worst bug it can have; refusing is always safe, since the file stays as it was.
- The dependent's files already match 1.0.6's output, so keeping the bytes means 2.x writes nothing for them.
- New formatting choices (indent, final newline, line endings, key sorting) are options, so no default changes.

## Alternatives rejected

- Preserve number text through a lossless parser dependency: adds a runtime dependency and changes output for files 1.0.6 handled.
- Rewrite lossy files with a warning: the data is still lost.

Related: builds on [../notes/2026-09-26-phase-0-survey-baseline-and-capture.md](../notes/2026-09-26-phase-0-survey-baseline-and-capture.md); see also [../plans/2026-09-26-modernization-and-v2-release.md](../plans/2026-09-26-modernization-and-v2-release.md).
