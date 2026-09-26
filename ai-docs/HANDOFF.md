# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
Phase 0 done 2026-09-26 (commit 7107861): survey, baseline and the golden capture of the published 1.0.6 (`test/golden/1.0.6.json`, 45 cases; frozen from that commit). Phase 1 plan written: `ai-docs/plans/2026-09-26-modernization-and-v2-release.md` with decisions D1-D16 and exceptions E1-E8, and the decision record in `ai-docs/decisions/`. master still holds the 1.0.6 code.

## In progress
Stopped at the plan review. Mark rules on the decisions table; silence means the recommendations stand.

## Decisions made this session
Proposed, not yet ruled: default output byte-identical to 1.0.6; lossy files refused and reported; library returns a report; CLI on parseArgs with stderr and exit 1 on skips; node_modules and .git skipped by default; options indent, sortKeys, check, finalNewline, eol, ignore.

## Dead ends hit
- Bash heredocs turn backslashes into nothing; a regex in the capture script had to be fixed with Python and chr(92).
- The first capture was 2.4 MB, then 16 MB (a 2000-deep array formats into a huge file); the depth tree now holds only a 10000-deep array (stringify overflows, file untouched) and shapes a 40-deep one.
- Windows refuses file symbolic links without developer mode (EPERM); junctions work. File-link behaviour is left to 2.x's functional tests on Linux and macOS.

## Next single action
After Mark's ruling: Phase 2 on branch v2, starting with test/golden/golden.test.js against the first build.
