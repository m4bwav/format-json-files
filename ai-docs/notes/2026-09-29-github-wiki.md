---
title: GitHub wiki written for 2.0.0
kind: note
date: 2026-09-29
verified: 2026-09-29
stale_after: 2027-03-29
tags: [wiki, docs, 2.0.0, github, golden, filesystem]
summary: "the wiki's pages, where their git working copy is, how every example was verified against the published 2.0.0 package on scratch copies of fixture trees (Windows and Linux, Node 24 and 20), the golden replay of 1.0.6, the facts found on the way, the inaccuracies in the shipped docs, and how to update the wiki; read before touching the wiki or the README sentences listed under inaccuracies"
---

# GitHub wiki for 2.0.0

## Summary

Asked for: the GitHub wiki for format-json-files, written with the wikiwright skill (0.5.0), with the page set for a library with a command line; every example and command verified against the published 2.0.0 on scratch copies of fixture trees; the golden capture of 1.0.6 replayed; a Node 20 run; the pages committed in the wiki working copy but not pushed.

Written: 10 pages plus the sidebar and footer, from the README, CHANGELOG, AGENTS.md, ai-docs, `src/`, the tests, the golden capture, the CI workflows, the registry and the GitHub issues and pull requests. Every output on a page comes from `2026-09-29-wiki-verify.mjs` (beside this note), run against `format-json-files@2.0.0` installed from npm. `wikiwright.py check`: 0 errors, 0 warnings. `wikiwright.py outputs` over the four saved outputs: 10 pages, 114 outputs checked, 0 missing, 0 skipped. everwrite's `tells.py` on the pages: 0 strong findings, 9 weak (long sentences, judged fine).

Pages: Home, Getting-Started, API-Reference, How-Files-Are-Formatted (the behaviour page), Commands, Edge-Cases-and-Errors, Recipes, Versions-and-Upgrading, FAQ, Development, `_Sidebar`, `_Footer`.

## Where the pages are

`D:\m4bwa\Claude\Projects\Ai\format-json-files.wiki` (a sibling of this clone, outside this repository), branch `master`, remote `origin` = `https://github.com/m4bwav/format-json-files.wiki.git`. Plain markdown links between pages (`[Recipes](Recipes)`), no wikilinks, LF line endings.

## How it was published

Preflight on 2026-09-29: state `placeholder` (Mark had saved the first page; one commit, `Home.md`). The pages were committed on top of the placeholder in the working copy (`c9f5fe5`, one commit ahead of `origin/master`) and **not pushed**, as asked. To publish: `git -C D:\m4bwa\Claude\Projects\Ai\format-json-files.wiki push` (a plain fast-forward), then `python <wikiwright>/scripts/wikiwright.py live m4bwav/format-json-files D:\m4bwa\Claude\Projects\Ai\format-json-files.wiki`. The live check has not run.

## Updating the wiki later

1. `git -C D:\m4bwa\Claude\Projects\Ai\format-json-files.wiki pull --ff-only`, then edit the pages. Page names are the file names with hyphens; links are `[Text](Page-Name)`.
2. Re-verify in a scratch folder outside the repository: copy `2026-09-29-wiki-verify.mjs` as `wiki-verify.mjs`, `2026-09-29-file-tree.mjs` as `file-tree.mjs` and `2026-09-29-linux-run.sh` as `linux-run.sh`; `npm init -y` and `npm install format-json-files@<new> typescript@6` there (run `npm init` with the folder as the working directory: `npm init -y --prefix <dir>` wrote `package.json` in the current folder instead). Bump `VERSION` in the script. Windows run: `BASH=<Git Bash's bash.exe> RT=<folder where npm install deno bun ran> GOLDEN=<clone>/test/golden OLD=<folder with format-json-files@1.0.6> OLDEST_NODE=20 node wiki-verify.mjs > wiki-verify.out.txt`. Linux run: `wsl -e env R=<scratch folder as /mnt/...> CLONE=<clone as /mnt/...> sh linux-run.sh > wiki-verify.linux.out.txt` (it needs `node-linux-x64@24` and `@20` and `npm@11` unpacked from `npm pack`, see the script's header).
3. `python <wikiwright>/scripts/wikiwright.py diffout 2026-09-29-wiki-verify.linux.out.txt <new linux output>` (and the same for the Windows and both Node 20 outputs): every difference is a page to fix. `diffout ... --save <file>` masks ports and local paths.
4. `wikiwright.py outputs <wiki dir> <the four new outputs> --address ''`, `wikiwright.py check <wiki dir> --version <new>`, and everwrite's `tells.py`.
5. Commit, `git push`, then `wikiwright.py live`. The pages that name the version: Home (current version and date), Getting-Started (`format-json-files@2.0.0` in the run-without-installing commands and Deno's `npm:` specifier), API-Reference (the "Since" columns), Versions-and-Upgrading (the releases table), Development (test counts), `_Footer`.

## How the examples were verified

- Script: `2026-09-29-wiki-verify.mjs`, with wikiwright's file-tree kit as `2026-09-29-file-tree.mjs` (unchanged from the skill, `templates/npm/file-tree.mjs`) and `2026-09-29-linux-run.sh`. Outputs: `2026-09-29-wiki-verify.out.txt` (Windows, Node 24.18.0), `2026-09-29-wiki-verify.node20.out.txt` (Windows, Node 20.20.2), `2026-09-29-wiki-verify.linux.out.txt` (Linux, Node 24.18.0) and `2026-09-29-wiki-verify.linux.node20.out.txt` (Linux, Node 20.20.2), each saved with `diffout --save` (ports and local paths masked).
- Every case builds a fresh tree under `./trees` with the kit's `treeCase`, runs, prints the case's own output, one line per file (not written, written with the same bytes, changed, created, deleted) and each written file before and after, under a header naming size, BOM, line endings and final newline; then removes the tree. No case sees another's rewrite; nothing ran against the repository, the wiki working copy or any real file.
- Command-line cases run in bash with `node_modules/.bin` first on PATH, as a user types them, and print a transcript: each command after `$ `, stdout and stderr merged in the order written, then `$ echo $?`.
- Windows: Windows 11, Git Bash, Node 24.18.0 and 20.20.2 (the template's `OLDEST_NODE=20`: npx fetched `node@20` from npm). Linux: Ubuntu in WSL 2 with Node 24.18.0 and 20.20.2 from npm's `node-linux-x64` packages and npm 11.16.0 from npm's `npm` package, PATH limited to those and `/usr/bin:/bin`. The Linux trees live on `/mnt/c` (drvfs), where symbolic links and read-only files behave as on Linux but folder modes are ignored.
- Runtimes and package managers (Windows only): pnpm 10.34.5 and Yarn 4.18.1 through corepack, Bun 1.4.2 and Deno 2.9.6 from npm, PowerShell 7.6.6, TypeScript 6.0.3. Each installed or fetched `format-json-files@2.0.0` from the registry.
- Network: nothing but package installs from the registries (npm, and corepack's pnpm and Yarn from npm). The package makes no requests.
- Node 20 against Node 24 (`diffout`, `shell node:` lines masked): the `JSON.parse` messages in `not valid JSON: ...` reasons lack `(line N column M)` on Node 20; the nesting limit differs (about 4,770 against 1,390 levels on Windows, 4,450 against 4,100 on Linux); 1.0.6's recording of `dir-invalid` differs for the same reason; npx ran the bin on the shell's Node in both runs (`npm exec -c "node --version"` printed v20.20.2 in the Node 20 run, and the process.execPath case agreed). Also changed, with nothing for a page: Node's own stack lines in the Yarn `ERR_MODULE_NOT_FOUND` case, and the junction's target (Node 20 reads it with a trailing `\`). Every other section was identical. The pages scope the parser messages with `<!-- outputs: node>=24 -->` and `node<24`.
- Windows against Linux: path separators; readdir order (byte order on Linux, case ignored on Windows); `EPERM` against `EACCES` for a read-only file; file symbolic links (Windows without developer mode refused them, `EPERM`); a junction on Windows in place of a folder link.
- The golden replay (`GOLDEN`, `OLD`): `test/golden/capture-1.0.6.cjs` with `capture-fixtures.cjs` and `codec.cjs` copied beside 1.0.6 (unchanged) and beside 2.0.0 (two lines patched: the bin's path from package.json, and meow's version as `none` when absent), run as child processes one after the other with `TEMP`, `TMP` and `TMPDIR` pointed at a scratch folder. Compared with `1.0.6.json` in nine views: library throws, library returns and prints, file bytes, written flags, links present, unavailable links, CLI exit status, stdout, stderr error lines.
  - 1.0.6 today, Windows, Node 24: identical in every view (15/15 throws, 18/18 returns, 45/45 files, 12/12 exit, stdout and stderr).
  - 1.0.6 today, Windows, Node 20: 17/18 returns (`dir-invalid`: the parser message).
  - 1.0.6 today, Linux, Node 24: 17/18 returns (`dir-readonly`: EACCES for EPERM), 44/45 files (`dir-links`: the file link exists on Linux, and 1.0.6 wrote through it to `target/real.json`), links present 42/45.
  - 2.0.0, both platforms, Node 24 and 20: 15/15 throws, 0/18 returns (the report), 39/45 files (`dir-shapes`, `dir-twice`: the four lossy files; `dir-invalid`: bom.json and latin1.json; `dir-names`: node_modules and .git; `cli-two-paths`: one.txt; `cli-unknown-flag`: one.json), 8/12 exit, 6/12 stdout, 10/12 stderr. Each difference is a CHANGELOG line; the table is on Versions-and-Upgrading.
- The repository's own tests, once, on this clone (`npm test`, Windows, Node 24.18.0, temporary trees redirected to a scratch folder): 145 tests, 141 pass, 0 fail, 4 skipped (file links and POSIX folder modes).
- Not tested: macOS; Node 22 and 26 (CI runs them); cmd.exe; Yarn 1; zsh; a folder the process cannot read (drvfs ignores folder modes; the walk test covers it in CI); running as root; `npm install` on Linux with a real `node_modules/.bin` symlink (the Linux run reused the Windows install's shims); the GitHub Actions step in Recipes (only its command ran); the CommonJS TypeScript consumers (CI's consumer fixtures cover them); 1.0.0 to 1.0.5.

## Facts verified while writing (not in the README)

1. A formatted file that ends with a line break is rewritten without it by default (15 bytes to 14), and a formatted file that only differs by a byte order mark is rewritten without the mark.
2. The walk does not sort: files come in `readdirSync` order, byte order in the Linux run and case-insensitive in the Windows run, so `--check` lists and reports differ in order between platforms.
3. Report paths are `path.join`ed from the argument: relative in, relative out; absolute in, absolute out; `\` on Windows.
4. Options are checked before the path exists (`formatJsonFiles('missing', {indent: 11})` throws the `TypeError`, not `Invalid path`); unknown option names are ignored; `null`, `0`, `false` and `NaN` as the path give `Error: Path argument not set`, not a `TypeError`.
5. `ignore` matches folder names at any depth and never files; an ignored name given as the path is still walked.
6. `not valid JSON:` reasons carry `JSON.parse`'s message, which differs by Node version: Node 24 adds `(line N column M)`, Node 20 does not. The message can quote the file across a line break, so one `path: reason` on stderr can span two lines.
7. Reasons cut long numbers and keys at 40 characters with `…`.
8. The nesting limit is far lower than 10,000 and depends on Node and platform: through the bin, about 4,450 and 4,100 levels on Linux (Node 24, 20), about 4,770 and 1,390 on Windows (Node 24, 20); in-process a little different. The exact number moves by a few levels between runs (4,767 then 4,774 for the bin on Windows, Node 24), so a rerun's diffout shows the `edge: nesting limit` section changing; the page gives rounded figures.
9. A read-only file that is already formatted is `unchanged`, with no error; `--check` lists a read-only file that needs formatting without an error.
10. A folder link or junction given as the path is `Invalid path`, as a file link is; a path through a folder link is followed.
11. `U+2028` escapes are written as the raw character; `-0.0` is refused like `-0`; `0e5` is accepted and written as `0`; 2^60 (an exact double) is refused because `JSON.stringify` writes other digits.
12. The command line: `--help` wins over paths; flags may follow paths; `--` before a path that starts with a dash; `--indent -1` is `parseArgs`' "ambiguous" error while `--indent=-1` gets the package's own message; `--check=yes` is refused; a missing path among several does not stop the others.
13. Globs are the shell's: bash expands `data/*.json` (and `**` with globstar); a quoted pattern, and PowerShell's unexpanded one, give `Error: Invalid path`.
14. `xargs` without `-r` on empty input runs the command with no path: `Error: Path argument not set`, exit 123.
15. Deno: without `--allow-write` the file is skipped with `cannot write: NotCapable: ...` and the process exits 0; without `--allow-read` the call throws `Invalid path`.
16. Yarn 4 (Plug'n'Play): `node app.mjs` fails with `ERR_MODULE_NOT_FOUND`; `yarn node app.mjs` and `yarn format-json-files` work. Bun prints the report in its own inspect layout.
17. The types reject `indent: 'tab'` (TS2322); tabs are `'\t'` in the API and `tab` on the command line.
18. `npx` ran the bin with the Node on PATH (v20 in the Node 20 run), not only the Node beside npx.

## Inaccuracies found in the shipped docs

Numbered; none is fixed. The README and CHANGELOG ship inside the package, so a fix reaches npm only with the next release; AGENTS.md and HANDOFF.md can be fixed any time.

1. **README, "Behaviour at the edges", nesting row.** Says nesting deeper than "about 10,000 levels" is skipped. The run: 5,000 and 10,000 levels were both skipped, and the deepest array nesting `format-json-files --check` formatted was about 4,450 (Linux, Node 24.18.0), 4,100 (Linux, Node 20.20.2), 4,770 (Windows, Node 24.18.0) and 1,390 (Windows, Node 20.20.2). Waits for the next release.
2. **README, "Limits and what it is not", last bullet** (also in the published 2.0.0 tarball). Says `"é"` is written as `"é"`, a no-op; the `\u00e9` escape was decoded when the line was written (the L-001 editor trap). Should read `"\u00e9"` as `"é"`. Waits for the next release.
3. **README, "API", the throws sentence.** "a `TypeError` when `path` is not a string": `null`, `0`, `false` and `NaN` are not strings but throw `Error('Path argument not set')` (the truthiness check comes first, as in 1.0.6). Waits for the next release.
4. **README, "Command line" block.** Presented as the usage, but it is not the bin's help text: the help says `(default lf; auto keeps each file's)`, `Replaces the default list (node_modules and .git)` and `Show this help`, and has usage, exit-code and example sections the README block lacks. Waits for the next release.
5. **The CLI's `--help` text** (`src/cli.ts`). "A file is left alone, and listed on stderr, when it is not valid UTF-8 JSON, when rewriting it would change a value ..., or when it is a symbolic link" reads as the full list, but files are also left alone for `cannot read`, `cannot write` (read-only) and `nested too deeply`. Needs a release.
6. **CHANGELOG 2.0.0, "Changed (breaking)", last bullet but one.** "A missing or invalid path prints 1.0.6's error line without the stack trace": it also prints a second line, `  path: <path>`. Incomplete rather than wrong. Waits for the next release.
7. **AGENTS.md, "What this is".** Still says 1.0.6 "is the published version until 2.0.0 ships" and "Until branch `v2` merges, `master` holds the 1.0.6 code". 2.0.0 shipped on 2026-09-27 and v2 merged on 2026-09-26. Can be fixed now.
8. **AGENTS.md, everlast section.** "system layout in CODEMAP.md": the repository has no CODEMAP.md. Can be fixed now.
9. **ai-docs/HANDOFF.md, "Current state" and "Standing work".** Says `next` is 2.0.0-beta.2 and "stays on 2.0.0-beta.2 until the next prerelease"; npm showed only `latest: 2.0.0` on 2026-09-29 (the tag was removed, as the maintainer's rule that `next` never points below `latest` requires). Can be fixed now.

## Gotchas

- The editor tool decoded `\u` escapes in the script and the pages (wikiwright L-001): write `\` and replace it (`String.fromCharCode(92)` in the script, `wikiwright.py unbs` in the pages). The README's `"é"` line has the same cause.
- `npm init -y --prefix <dir>` ignores `--prefix` and writes `package.json` in the current folder; a stray `package.json` above the scratch projects made Yarn 4 refuse to install ("doesn't seem to be part of the project").
- Output order: capture stdout and stderr through one pipe (`2>&1`) to show what a terminal shows; separate captures put `--check`'s stdout list before stderr's skip lines, the wrong way round.
- util.inspect escapes backslashes, so a Windows path in a report prints `C:\\...` and the kit's `<tree>` mask misses it.
- The kit shows everything under the tree: a case that runs `git init` in the tree listed every file under `.git`; the git recipe keeps its repository outside the tree with `GIT_DIR` and `GIT_WORK_TREE`.

Related: see also [../HANDOFF.md](../HANDOFF.md), [../log.md](../log.md), [2026-09-26-phase-0-survey-baseline-and-capture.md](2026-09-26-phase-0-survey-baseline-and-capture.md).
