# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
2.0.0 released 2026-09-27 and verified from the registry (npm latest 2.0.0, next 2.0.0-beta.2; provenance, signatures, verify-published run 36282487927). 1.x (1.0.0 to 1.0.6) deprecated by Mark; issue #1 answered and closed. master is protected by ruleset 24055957 (required check ci), tags by 24055958 (admins only). No open pull requests or issues, 0 webhooks, 0 alerts. The tag v2.0.0-beta.1 exists but was never staged (release-notes lint failure, fixed in #3).

## Standing work
- Dependabot pull requests weekly: merge when ci is green; read release notes for majors. TypeScript 7 is held in dependabot.yml until xo supports it.
- Next major when Node 22 reaches end of life (2027-04-30): floor to 24.
- The `next` dist-tag stays on 2.0.0-beta.2 until the next prerelease.
- Possible minors, only if asked: a promise-based API, preserving number text.

## Decisions made
All in the plan (D1-D16, E1-E8) and `ai-docs/decisions/`. After the review: plain-integer numbers must be written back with the same digits; a non-object second argument is ignored as in 1.0.6.

## Dead ends hit
See the log: tsdown declaration traps for `export =` with types, xo cache hiding errors, xo --fix rewriting `null` and number-token keys, Windows captures lacking file links, release-notes.md linted in release.yml. All are skill lessons L-039 to L-043.

## Next single action
None in this repository. The next package is markdown-plain-link-replacer (see D:\m4bwa\Claude\Projects\Ai\package-modernization\inventory.md); its kickoff prompt still needs writing.
