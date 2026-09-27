# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
2.0.0 rewrite merged to master (pull request #2, merge commit 5292dcf; the release-notes lint fix in #3, 50ff9f1). Phase 4 cleanup done: rulesets 24055957 (master, required check ci) and 24055958 (tags admins only), Travis webhook gone, scanning, push protection and private reporting on, workflow permissions read, alerts 0. `2.0.0-beta.2` is STAGED on npm (release run 36281483946, stage id 3b707664-b7a5-46c8-aec1-81cdface1039, tag next). The tag v2.0.0-beta.1 exists but was never staged (lint failure; see the log). Evidence in `ai-docs/log.md`.

## In progress
Phase 5 stop: Mark approves 2.0.0-beta.2 in npmjs.com's Staged Packages tab.

## Next steps, in order
1. After the approval: `bash <skill>/scripts/verify-registry-npm.sh format-json-files 2.0.0-beta.2 m4bwav/format-json-files` (skill at C:\Users\m4bwa\.claude\skills\package-modernize). It must print VERIFIED; `latest` must still be 1.0.6.
2. Phase 6: date the CHANGELOG heading (`## [2.0.0] - YYYY-MM-DD`), commit through the admin bypass, `preflight-tag-npm.sh 2.0.0 .` READY, `npm version 2.0.0 && git push --follow-tags origin master` in the main session, `watch-run.sh m4bwav/format-json-files release.yml`, stop for Mark's approval, then verify-registry-npm.sh 2.0.0.
3. Answer issue #1 with the comment in the plan's disposition table (sortKeys ships in 2.0.0), then close it.
4. Give Mark the deprecation for his own terminal (the agent shell gets EOTP), with the full message, then read it back with `npm view format-json-files@1.0.6 deprecated --prefer-online`:
   npm deprecate format-json-files@"<2" "1.x can silently change data (big integers, duplicate keys, -0, 1e400) and depends on meow 5; use 2.x"
5. Phase 7: the inventory row in D:\m4bwa\Claude\Projects\Ai\package-modernization\inventory.md, the kickoff's "what the run found wrong" section (prompts/2026-09-26-format-json-files-kickoff.md), standing work below, and the next package (markdown-plain-link-replacer). Skill lessons L-039 to L-043 are already in the skill's LEARNINGS.md; templates/npm/xo.config.js and .gitignore still need `release-notes.md` (L-039).

## Standing work (after 2.0.0)
- Dependabot pull requests weekly; merge when ci is green. TypeScript 7 is held in dependabot.yml until xo supports it.
- Next major when Node 22 reaches end of life (2027-04-30): floor to 24.
- The `next` dist-tag stays on the last beta.

## Decisions made this session
Mark accepted every plan recommendation. The review's 7 findings are fixed (comment on pull request #2). Numbers written as plain integers must be written back with the same digits; fraction and exponent forms are floats.
