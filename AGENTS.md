# AGENTS.md

Rules for any AI agent (Claude Code, Copilot, Cursor, Codex) working in this repository. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

## What this is

The npm package `format-json-files`: reformats JSON files in place, one file or every `.json` file under a directory, with a command line tool. On npm since 2018; 1.0.6 (2018-12-24, one CommonJS file plus a meow 5 CLI, no build) is the published version until 2.0.0 ships. Version 2 is TypeScript in `src/`, built by tsdown into ESM and CommonJS with a declaration file for each, with no runtime dependencies. The plan is `ai-docs/plans/2026-09-26-modernization-and-v2-release.md`; start with `ai-docs/HANDOFF.md` to see how far it has got. Until branch `v2` merges, `master` holds the 1.0.6 code, whose `npm test` cannot run on Node 24 (snyk needs a login, xo 0.23 crashes; see the survey note).

## Rules

- **Never lose data, and never rewrite what 1.0.6 would have left alone differently.** For every tree in `test/golden/1.0.6.json`, 2.x picks the same files, writes the same bytes and throws the same errors as the published 1.0.6, except the exceptions the plan names, each listed once in the golden test with its changelog line. The golden file was captured from the published 1.0.6 by `test/golden/capture-1.0.6.cjs` over the trees in `capture-fixtures.cjs`, with `codec.cjs`, in a scratch project; never regenerate it from this repository, and never edit the golden JSON, the capture script, the fixtures or the codec (`scripts/check-golden-untouched.sh` in the package-modernize skill checks it). A fix that changes an old result needs a decision entry in `ai-docs/decisions/` and a changelog line.
- **Tests touch only their own temporary trees.** Every test that writes builds a tree under `os.tmpdir()` and removes it; never point the library or the bin at the repository, the home directory or any path a test did not create.
- **Availability.** The package must stay usable from `import` and `require`, ship types for both, and support every Node line in `engines`. The library reads and writes files, so it is Node-only by nature (`node:fs`, `node:path`); it still runs under Bun and Deno's Node compatibility, which the consumer fixtures test. No runtime dependency without a decision entry in `ai-docs/decisions/`.
- **Tests cover every artifact, not just the code.** Golden, unit, CLI, package shape (`publint`, `@arethetypeswrong/cli`), consumer fixtures for ESM, CJS and the type files, Bun and Deno, and post-publish verification from the registry. A behaviour change lands with its test. `npm test` never touches the network.
- **Nothing reaches npm without the maintainer.** Never run `npm publish` or `npm stage publish` from a machine, never create or store an npm token, and never approve anything on npmjs.com. Releases go through `release.yml`, which only stages; the maintainer approves each version with 2FA.
- **Releases follow one ritual.**
  1. Update `CHANGELOG.md`. A release's heading carries its date; a prerelease uses the section of the release it leads to (`## [2.0.0] - Unreleased`, never a bare `## [Unreleased]`).
  2. Run the package-modernize skill's `scripts/preflight-tag-npm.sh VERSION <this repo>`; it prints READY with the two commands.
  3. Run `npm version <version>`, then `git push --follow-tags`.
  4. `release.yml` builds, tests, stages the npm publish through trusted publishing, and a separate job creates the GitHub Release.
  5. The maintainer approves the staged version on npmjs.com; then `scripts/verify-registry-npm.sh` runs the checks, `verify-published.yml` included.
- **Dependencies.** Dependabot opens weekly pull requests (npm and GitHub Actions) with a cooldown; merge when the `ci` check is green, and read the release notes for a major first. `.npmrc` sets `min-release-age=3`: an install resolves only versions at least three days old. To take a younger one on purpose, pass `--min-release-age=0` on that one command and say why in the commit. Actions are pinned to commit SHAs with the version in a comment.
- **Research beats recall.** Node, npm and tool versions change; the notes under `ai-docs/notes/` carry the date each fact was verified. Re-verify any version number older than three months before relying on it.
- **Document for handoff.** Anything learned, decided or built goes into `ai-docs/` (at minimum a line in `ai-docs/log.md`) before you finish. Rewrite `ai-docs/HANDOFF.md` when work is left unfinished. A fresh session in any tool must be able to continue from disk alone.
- **No AI attribution anywhere**: no Co-Authored-By trailers, no "generated with" lines in commits, pull requests or files.
- **Windows note.** Write files with an editor tool, not shell heredocs (they lose backslashes). Check line endings by counting byte 13 with node; Git Bash's grep cannot see carriage returns. `.gitattributes` keeps the repository LF (the 1.0.6 tarball was published with CRLF files). File symbolic links need developer mode on Windows; the link tests run where the OS allows them (CI's Linux and macOS jobs).

## Commands (version 2)

```bash
npm ci
npm run build          # tsdown -> dist/ (index.mjs, index.cjs, index.d.mts, index.d.cts, cli.mjs, maps)
npm test               # build, then node --test: golden, unit, CLI, package shape (temporary trees only)
npm run test:dist      # the same suites against the dist/ already built
npm run test:consumers # build, pack, install the tarball into a scratch project, run the ESM, CJS, type and bin fixtures
npm run coverage       # c8 over the suites, mapped back to src/; fails under 95% lines or 90% branches
npm run lint           # xo
npm run typecheck      # tsc --noEmit
npm run check          # publint, attw --pack ., npm pack --dry-run (needs a build first)
```

tsdown needs Node 22.18+ or 24 to build; the built output and the tests run on Node 20 and up.

## Layout and traps

- `test/golden/1.0.6.json` holds one case per line: the tree it ran on (from `capture-fixtures.cjs`), the arguments with `{{root}}` for the tree's path, what the call returned or threw, what it printed, and every file's bytes afterwards with `written` (its mtime moved from the fixed 2001-01-01 stamp). Cases listing a link under `unavailable` ran without it (Windows refuses file symbolic links without developer mode).
- Tests import `dist/`, never `src/`, and run against both builds (`test/helpers/builds.js`). The npm scripts name every test file, because plain `node --test` would also run the fixtures and the capture scripts.
- `xo --fix` rewrites code: stage your work first and read the diff it makes to `src/`.
- The npm trusted publisher names `release.yml`, so renaming the file breaks publishing.

## everlast (session knowledge, load on demand)

- `ai-docs/INDEX.md` lists what past sessions learned here (solutions with verified commands, decisions with reasons, plans). At the start of a task, scan it and open only the entries whose title or tags match; no line matches: `everlast.py search "<key terms>"` before concluding nothing was recorded. Read `ai-docs/HANDOFF.md` when continuing unfinished work (everlast-resume skill).
- Before acting on an entry marked `(recheck due)`, run `everlast.py recheck <entry>`, re-run its Verified-by command only when that is read-only or safe (a build, a test, a version query), then record `everlast.py verify <entry>` or `verify <entry> --failed "what broke"`; a fix that changed is superseded, never reused blindly.
- Before finishing a task that hit a dead end, verified a non-obvious command, made a design choice, or taught you something about the user, record it (everlast-capture skill, or `everlast.py note` / `handoff`); rewrite `HANDOFF.md` when work is left unfinished. Say "nothing to record" when that is true.
- Anything naming a person, an internal host or name, a credential, or an opinion about people goes to the private sidecar (`--private`), never here. Lessons about the user or this machine go to the user tier (`--user`).
- Rules go in this file, system layout in CODEMAP.md; the doc set holds only what could not be re-derived from the code in a minute.
- Link documents together with relative markdown links: every markdown folder is reachable from an index whose lines say when to read each file (`ai-docs/INDEX.md` is generated from frontmatter; give entries a one-line `summary`), and an entry links the entries it relates to on a typed `Related:` line (`supersedes`, `contradicts`, `builds on`, `see also`). The set then reads as a graph for people in Obsidian and for agents alike. No wikilinks in the repo.
