# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
Phases 0 to 2 done 2026-09-26. Branch v2 holds the 2.0.0 rewrite; pull request #2 is open (https://github.com/m4bwav/format-json-files/pull/2) with CI green (run 36277589680). Golden suite 78 of 78 against 1.0.6's recording, canary logged, golden files untouched since 7107861. master still holds 1.0.6. Evidence in `ai-docs/log.md`.

## In progress
Phase 3 done: 7 review findings fixed (see the log and the comment on pull request #2), CI green (run 36277900880). Stopped for Mark's review of pull request #2.

## Decisions made this session
- Mark accepted every recommendation of the plan (D1-D16, E1-E8).
- The lossless check requires exactness only for numbers written as plain integers; fraction and exponent forms are floats (plan D3).
- The CLI keeps 1.0.6's exact error line and prints the path on a second line.

## Dead ends hit
- tsdown's declaration bundler: `export =` with a namespace aliasing types under the same names wrote `type FormatOptions = FormatOptions`; direct property assignment on the function wrote `var formatJsonFiles: typeof formatJsonFiles` inside the namespace (TS2502). Fixed with short internal type names and the DefinitelyTyped `export {formatJsonFiles as default, formatJsonFiles}` form.
- Local xo passed while CI failed: xo's cache in node_modules/.cache/xo-linter hid errors in an edited file. Clear it before pushing.
- xo --fix changed the JSON `null` type to `undefined` and quoted number tokens in a test table into number literals.

## Next single action
After Mark's pull request review: Phase 4 (ruleset before the merge, merge, then the go list: webhook 72197148, tag ruleset, settings, scanning, private reporting, workflow permissions, branch v2).
